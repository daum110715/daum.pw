/**
 * daum.pw - Main Script
 * Modules: Theme, Horizontal Scroll, Signature, Badge, Project Cards, Timeline
 */

/* init calls moved to bottom */

/* ========================================
   Safe Storage (wraps localStorage)
   ======================================== */

const safeStorage = {
  get(key, fallback = null) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }
};

const escapeHTML = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[char]);

const textToHTML = (value = '') => escapeHTML(String(value ?? '').replace(/<br\s*\/?>/gi, '\n')).replace(/\n/g, '<br>');

const safeURL = (value, fallback = '#') => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '#') return fallback;

  try {
    const url = new URL(raw, window.location.href);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
};

const renderLines = (el, line1 = '', line2 = '') => {
  const fragment = document.createDocumentFragment();
  fragment.append(document.createTextNode(line1));

  if (line2) {
    fragment.append(document.createElement('br'), document.createTextNode(line2));
  }

  el.replaceChildren(fragment);
};

/* ========================================
   Grain Texture (canvas, one-time render)
   ======================================== */

const Grain = {
  init() {
    const el = document.querySelector('.grain');
    if (!el) return;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 18;
    }
    ctx.putImageData(img, 0, 0);
    el.style.backgroundImage = `url(${canvas.toDataURL()})`;
  }
};

/* ========================================
   Dynamic Blob Background
   ======================================== */

const BlobBackground = {
  MIN_DIST: 32,
  MAX_TRIES: 60,

  BLOBS: [
    { size: 780, dur: 22, delay:  0, dark: { c1: '#F5B842', c2: '#E8723A', opacity: 0.42 }, light: { c1: '#F5B842', c2: '#FB923C', opacity: 0.28 } },
    { size: 720, dur: 30, delay: -9, dark: { c1: '#0d9488', c2: '#3B82F6', opacity: 0.38 }, light: { c1: '#38BDF8', c2: '#34D399', opacity: 0.24 } },
    { size: 620, dur: 19, delay: -5, dark: { c1: '#7c3aed', c2: '#a855f7', opacity: 0.26 }, light: { c1: '#C084FC', c2: '#F472B6', opacity: 0.20 } },
  ],

  _place() {
    const placed = [];
    return this.BLOBS.map(() => {
      let cx, cy, tries = 0;
      do {
        cx = 12 + Math.random() * 76;
        cy = 12 + Math.random() * 76;
        tries++;
      } while (tries < this.MAX_TRIES && placed.some(([px, py]) => {
        const dx = px - cx, dy = py - cy;
        return Math.sqrt(dx * dx + dy * dy) < this.MIN_DIST;
      }));
      placed.push([cx, cy]);
      return { cx, cy };
    });
  },

  init() {
    const container = document.querySelector('.bg-blobs');
    if (!container) return;

    const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';
    const positions = this._place();

    const render = () => {
      container.innerHTML = '';
      // animation-delay 用墙钟对齐:主题切换触发重渲染时 blob 动画相位由
      // Date.now() 驱动,重渲染瞬间相位连续,避免 blob 因动画重新开始而跳一下
      // (原 delay 0/-9/-5 作为 per-blob 错开偏移保留)。
      const nowSec = Date.now() / 1000;
      this.BLOBS.forEach(({ size, dur, delay, dark, light }, i) => {
        const { c1, c2, opacity } = isDark() ? dark : light;
        const { cx, cy } = positions[i];
        const el = document.createElement('div');
        el.className = 'bg-blob';
        const half = size / 2;
        const phaseDelay = -(((nowSec + delay) % dur + dur) % dur);
        el.style.cssText =
          `width:${size}px;height:${size}px;` +
          `left:calc(${cx}% - ${half}px);top:calc(${cy}% - ${half}px);` +
          `background:radial-gradient(circle at 45% 42%, ${c1} 0%, ${c2} 40%, transparent 68%);` +
          `opacity:${opacity};animation-duration:${dur}s;animation-delay:${phaseDelay}s;`;
        container.appendChild(el);
      });
    };

    render();
    new MutationObserver(render).observe(
      document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }
    );
  }
};

/* ========================================
   Mouse Interaction (glow + parallax)
   ======================================== */

const MouseInteraction = {
  LERP: 0.07,
  DEPTHS: [50, 30, 45, 20, 38], // px, per blob depth layer

  init() {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const root = document.documentElement;
    const blobContainer = document.querySelector('.bg-blobs');

    const glow = document.createElement('div');
    glow.className = 'mouse-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let tx = mx, ty = my;
    let rafId = null;

    const update = () => {
      const dx = tx - mx, dy = ty - my;
      if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15) { rafId = null; return; }

      mx += dx * this.LERP;
      my += dy * this.LERP;

      root.style.setProperty('--mx', mx.toFixed(1) + 'px');
      root.style.setProperty('--my', my.toFixed(1) + 'px');

      if (blobContainer) {
        const cx = mx / window.innerWidth  - 0.5; // -0.5 ~ 0.5
        const cy = my / window.innerHeight - 0.5;
        blobContainer.querySelectorAll('.bg-blob').forEach((blob, i) => {
          const d = this.DEPTHS[i % this.DEPTHS.length];
          blob.style.translate = `${(cx * d).toFixed(1)}px ${(cy * d * 0.7).toFixed(1)}px`;
        });
      }

      rafId = requestAnimationFrame(update);
    };

    document.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      glow.style.opacity = '1';
      if (!rafId) rafId = requestAnimationFrame(update);
    });

    document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  }
};

/* ========================================
   Theme Toggle
   ======================================== */

const Theme = {
  key: 'theme',

  init() {
    this.html = document.documentElement;
    this.toggle = document.getElementById('themeToggle');
    if (!this.toggle) return;

    const saved = safeStorage.get(this.key);
    if (saved) this.html.setAttribute('data-theme', saved);

    this.toggle.addEventListener('click', () => this.switch());
  },

  switch() {
    const current = this.html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    this.html.setAttribute('data-theme', next);
    safeStorage.set(this.key, next);
    safeStorage.set('daum-theme', next);
  }
};

/* ========================================
   Horizontal Scroll (GSAP)
   ======================================== */

const HorizontalScroll = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      console.warn('GSAP not loaded');
      return;
    }

    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;
    if (isMobile) return;

    gsap.registerPlugin(ScrollTrigger);

    const section = document.querySelector('.section-projects');
    const track = document.querySelector('.projects-track');
    if (!section || !track) return;

    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    gsap.to(track, {
      x: () => -distance(),
      ease: 'power1.inOut',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + distance(),
        scrub: 1,
        pin: true,
        invalidateOnRefresh: true
      }
    });

    window.addEventListener('resize', () => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    }
  }
};

/* ========================================
   Signature Rotator (typewriter state machine)
   ======================================== */

const Signature = {
  TYPE_SPEED: 38,
  ERASE_SPEED: 18,
  PAUSE_AFTER_TYPE: 4500,
  PAUSE_AFTER_ERASE: 350,

  _sigs: [],
  _idx: 0,
  _el: null,
  _tid: null,
  _text: '',
  _pos: 0,

  init() {
    this._el = document.getElementById('heroLine1');
    if (!this._el || !window.signatures?.length) return;
    this._sigs = window.signatures;
    this._idx = Math.floor(Math.random() * this._sigs.length);
    this._el.classList.add('typing');

    const btn = document.getElementById('sigNext');
    if (btn) btn.addEventListener('click', () => this.next());

    this._startTyping();
  },

  _getText() {
    const s = this._sigs[this._idx];
    return (s.line1 || '') + (s.line2 ? '\n' + s.line2 : '');
  },

  _render(str) {
    this._el.innerHTML = str.replace(/\n/g, '<br>');
  },

  _startTyping() {
    this._text = this._getText();
    this._pos = 0;
    this._typeTick();
  },

  _typeTick() {
    if (this._pos > this._text.length) {
      this._tid = setTimeout(() => this._startErasing(), this.PAUSE_AFTER_TYPE);
      return;
    }
    this._render(this._text.slice(0, this._pos));
    this._pos++;
    this._tid = setTimeout(() => this._typeTick(), this.TYPE_SPEED + (Math.random() * 18 | 0));
  },

  _startErasing() {
    this._pos = this._text.length;
    this._eraseTick();
  },

  _eraseTick() {
    if (this._pos < 0) {
      this._idx = (this._idx + 1) % this._sigs.length;
      this._tid = setTimeout(() => this._startTyping(), this.PAUSE_AFTER_ERASE);
      return;
    }
    this._render(this._text.slice(0, this._pos));
    this._pos--;
    this._tid = setTimeout(() => this._eraseTick(), this.ERASE_SPEED);
  },

  next() {
    clearTimeout(this._tid);
    this._render('');
    this._idx = (this._idx + 1) % this._sigs.length;
    this._tid = setTimeout(() => this._startTyping(), this.PAUSE_AFTER_ERASE);
  }
};

/* ========================================
   Badge Joke
   ======================================== */

const Badge = {
  async init() {
    const jokeEl = document.getElementById('jokeText');
    if (!jokeEl) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch('https://60s.viki.moe/v2/dad-joke', { signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      jokeEl.textContent = json.data?.content ?? '';
    } catch {
      jokeEl.textContent = '代码能跑就行，跑得稳更重要';
    } finally {
      clearTimeout(timeout);
    }
  }
};

/* ========================================
   Project Cards
   ======================================== */

const ProjectCards = {
  init() {
    document.querySelectorAll('.project-card[data-url]').forEach(card => {
      const openCard = () => {
        const url = safeURL(card.dataset.url);
        if (url === '#') return;
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
      };

      card.setAttribute('role', 'link');
      card.tabIndex = 0;
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openCard();
      });
    });
  }
};

/* ========================================
   Timeline Animation
   ======================================== */

const Timeline = {
  init() {
    const section = document.querySelector('.section-timeline');
    const cards = document.querySelectorAll('.timeline-wheel .timeline-card');
    const dots = document.querySelectorAll('.timeline-dots .dot');
    const total = cards.length;

    if (!section || total === 0) return;

    let current = 0;

    const setActive = (index) => {
      current = index;
      cards.forEach((card, i) => {
        card.classList.remove('active', 'prev', 'next', 'far');
        if (i === index) card.classList.add('active');
        else if (i === index - 1) card.classList.add('prev');
        else if (i === index + 1) card.classList.add('next');
        else card.classList.add('far');
      });
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    };

    setActive(0);
    dots.forEach((dot, i) => dot.addEventListener('click', () => setActive(i)));

    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;
    if (isMobile || total <= 1) return;

    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * (total - 1) * 0.8}`,
      pin: true,
      scrub: 0.5,
      onUpdate: (self) => {
        const idx = Math.min(total - 1, Math.floor(self.progress * total));
        if (idx !== current) setActive(idx);
      }
    });
  }
};

/* ========================================
   Mobile Bottom Tab Navigation
   ======================================== */

const MobileNav = {
  init() {
    this.tabBar = document.querySelector('.mobile-tab-bar');
    if (!this.tabBar) return;

    this.tabs = this.tabBar.querySelectorAll('.tab-item');
    this.sections = ['hero', 'projects', 'timeline', 'links'];
    this.lastScrollY = window.scrollY;
    this.scrollThreshold = 10;
    this.ticking = false;

    this.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const id = tab.dataset.section;
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          this.setActive(id);
          this.show();
        }
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.setActive(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );

    this.sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
  },

  onScroll() {
    if (this.ticking) return;
    this.ticking = true;
    window.requestAnimationFrame(() => {
      this.updateVisibility();
      this.ticking = false;
    });
  },

  updateVisibility() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - this.lastScrollY;

    if (currentScrollY < 50) {
      this.show();
    } else if (delta > this.scrollThreshold) {
      this.hide();
    } else if (delta < -this.scrollThreshold) {
      this.show();
    }

    this.lastScrollY = currentScrollY;
  },

  show() {
    this.tabBar.classList.remove('hidden');
  },

  hide() {
    this.tabBar.classList.add('hidden');
  },

  setActive(sectionId) {
    this.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === sectionId);
    });
  }
};

/* ========================================
   Data Loader
   ======================================== */

const DataLoader = {
  // 相对路径:静态部署(GitHub Pages)下从 ./data/ 加载,无需 server.js 后端
  baseUrl: 'data',
  timeoutMs: 5000,

  async fetchJSON(name) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/${name}.json`, { signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.warn(`[DataLoader] failed to load ${name}.json:`, err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  },

  renderProjects(data) {
    const track = document.getElementById('projectsTrack');
    if (!track) return;
    track.innerHTML = data.map(p => `
      <div class="project-card" data-url="${escapeHTML(safeURL(p.url))}">
        <span class="project-num">${escapeHTML(p.num ?? '')}</span>
        <div class="project-info">
          <h3>${escapeHTML(p.name ?? '')}</h3>
          <p>${textToHTML(p.desc ?? '')}</p>
        </div>
        <span class="project-status${p.off ? ' off' : ''}">${escapeHTML(p.status ?? '')}</span>
      </div>
    `).join('');
  },

  renderTimeline(data) {
    const wheel = document.getElementById('timelineWheel');
    const dots = document.querySelector('.timeline-dots');
    if (!wheel) return;

    wheel.innerHTML = data.map((t, i) => {
      const variants = Array.isArray(t.variants) ? t.variants : [];
      const variant = variants.length ? variants[Math.floor(Math.random() * variants.length)] : null;
      const tags = Array.isArray(variant?.tags) ? variant.tags : (Array.isArray(t.tags) ? t.tags : []);
      const desc = variant?.desc ?? t.desc ?? '';
      const icon = typeof t.icon === 'string' ? t.icon : '';
      const yearHtml = icon
        ? `<span class="card-year" style="font-size:0;letter-spacing:0;">${icon}</span>`
        : `<span class="card-year">${escapeHTML(t.num ?? '')}</span>`;
      const videoUrl = safeURL(t.video, '');
      const mediaHtml = videoUrl
        ? `<div class="card-pet"><div class="clawd-video-keyer"><video class="clawd-video-source" src="${escapeHTML(videoUrl)}" autoplay muted loop playsinline preload="auto" aria-label="${escapeHTML(t.title ?? '')} 动画"></video><canvas class="clawd-video" aria-hidden="true"></canvas></div></div>`
        : (t.svg ? `<div class="card-pet">${t.svg}</div>` : '');
      const tagsHtml = tags.length ? `<div class="card-tags">${tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join('')}</div>` : '';

      return `
        <article class="timeline-card" data-index="${i}">
          ${yearHtml}
          <div class="card-body">
            <h3>${escapeHTML(t.title ?? '')}</h3>
            <p>${textToHTML(desc)}</p>
            ${mediaHtml}
            ${tagsHtml}
          </div>
        </article>
      `;
    }).join('');

    if (dots) {
      dots.innerHTML = data.map((t, i) => `
        <button class="dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="${escapeHTML(t.num ?? '')}"></button>
      `).join('');
    }
  },

  async load() {
    const [projects, timeline, signatures] = await Promise.all([
      this.fetchJSON('projects'),
      this.fetchJSON('timeline'),
      this.fetchJSON('signatures'),
    ]);

    if (Array.isArray(projects) && projects.length > 0) this.renderProjects(projects);
    if (Array.isArray(timeline) && timeline.length > 0) this.renderTimeline(timeline);
    if (Array.isArray(signatures) && signatures.length > 0) window.signatures = signatures;

    return !!(projects || timeline || signatures);
  }
};

/* ========================================
   Chroma Key Video
   ======================================== */

const ClawdVideoKeyer = {
  init() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.clawd-video-keyer').forEach(root => {
      if (reduce) {
        root.classList.add('is-fallback');
        return;
      }
      this.setup(root);
    });
  },

  setup(root) {
    const video = root.querySelector('.clawd-video-source');
    const canvas = root.querySelector('.clawd-video');
    if (!video || !canvas || canvas.dataset.ready) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.dataset.ready = 'true';
    let stopped = false;
    let lastFrame = 0;

    const sizeCanvas = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const keyWhite = () => {
      if (video.readyState < 2 || video.paused || video.ended) return;

      sizeCanvas();
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = frame.data;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const whiteness = (r + g + b) / 3;

          if (whiteness > 248 && max - min < 12) {
            pixels[i + 3] = 0;
          } else if (whiteness > 228 && max - min < 28) {
            pixels[i + 3] = Math.max(0, (248 - whiteness) * 9);
          }
        }

        ctx.putImageData(frame, 0, 0);
      } catch {
        root.classList.add('is-fallback');
        stopped = true;
      }
    };

    const tick = (now) => {
      if (stopped) return;
      if (now - lastFrame > 33) {
        keyWhite();
        lastFrame = now;
      }
      requestAnimationFrame(tick);
    };

    video.addEventListener('loadeddata', () => {
      sizeCanvas();
      video.play().catch(() => {});
      requestAnimationFrame(tick);
    }, { once: true });

    if (video.readyState >= 2) {
      sizeCanvas();
      video.play().catch(() => {});
      requestAnimationFrame(tick);
    }
  }
};

/* ========================================
   Arrive from New Version (虹膜开孔到岸)
   index.html 首帧前挂 data-from-new + 满幅幕布(新版 --bg),
   此处双 rAF 触发 mask 开孔自点击同轴位置放大揭示,
   与 ReturnNew 离场虹膜严格互逆,同语言同节奏,往返零跳变。
   ======================================== */

const ArriveNew = {
  OPEN_MS: 950,

  init() {
    const root = document.documentElement;
    if (root.getAttribute('data-from-new') !== '1') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('from-new-open');
      setTimeout(() => {
        root.removeAttribute('data-from-new');
        root.classList.remove('from-new-open');
        root.style.removeProperty('--tx');
        root.style.removeProperty('--ty');
        root.style.removeProperty('--from-new-bg');
      }, this.OPEN_MS);
    }));
  }
};

/* ========================================
   Return to New Version (虹膜收合离场)
   与新版「旧版」入场转场同一语言:circle clip-path +
   cubic-bezier(0.65,0,0.2,1) 0.85s;幕布色 = 新版当前主题 --bg,
   抵达新版后同色幕布虹膜展开,往返零跳变。
   ======================================== */

const ReturnNew = {
  VEIL_MS: 850,
  NAV_DELAY_MS: 880,
  NEW_BG: { light: '#fcfaf6', dark: '#1a1410' },

  init() {
    this.link = document.getElementById('returnNew');
    if (!this.link) return;
    this.reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.leaving = false;
    this.link.addEventListener('click', (e) => this.go(e));
  },

  go(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (this.leaving) return;
    this.leaving = true;

    const href = this.link.getAttribute('href');
    if (this.reduced) {
      window.location.assign(href);
      return;
    }

    // 目标站主题(新版 daum-theme 已与旧版 theme 双向同步)
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';

    const veil = document.createElement('div');
    veil.className = 'return-veil';
    veil.style.background = this.NEW_BG[dark ? 'dark' : 'light'];
    veil.style.setProperty('--tx', e.clientX + 'px');
    veil.style.setProperty('--ty', e.clientY + 'px');
    document.body.appendChild(veil);

    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      veil.classList.add('is-open');
    }));

    setTimeout(() => window.location.assign(href), this.NAV_DELAY_MS);
  }
};

/* ========================================
   Bootstrap
   ======================================== */

(async function bootstrap() {
  ArriveNew.init();
  Grain.init();
  BlobBackground.init();
  MouseInteraction.init();
  Theme.init();
  MobileNav.init();
  ReturnNew.init();

  await DataLoader.load();

  ProjectCards.init();
  HorizontalScroll.init();
  Timeline.init();
  ClawdVideoKeyer.init();
  Signature.init();
  Badge.init();
})();
