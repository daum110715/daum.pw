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
   Signature Rotator (typewriter)
   ======================================== */

const Signature = {
  INTERVAL: 8000,
  TYPE_SPEED: 38,
  ERASE_SPEED: 18,
  PAUSE_AFTER_TYPE: 2200,
  PAUSE_AFTER_ERASE: 300,

  _timer: null,
  _sigs: [],
  _idx: 0,
  _el: null,
  _abortCtrl: null,

  init() {
    this._el = document.getElementById('heroLine1');
    if (!this._el || !window.signatures?.length) return;
    this._sigs = window.signatures;
    this._idx = Math.floor(Math.random() * this._sigs.length);
    this._el.textContent = '';
    this._el.classList.add('typing');
    this._run();
  },

  _current() {
    const s = this._sigs[this._idx];
    return s.line1 + (s.line2 ? '\n' + s.line2 : '');
  },

  async _run() {
    while (true) {
      const text = this._current();
      await this._type(text);
      await this._wait(this.PAUSE_AFTER_TYPE);
      await this._erase(text.length);
      await this._wait(this.PAUSE_AFTER_ERASE);
      this._idx = (this._idx + 1) % this._sigs.length;
    }
  },

  _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  _type(text) {
    return new Promise(r => {
      let i = 0;
      const tick = () => {
        if (i > text.length) { r(); return; }
        const chunk = text.slice(0, i);
        this._el.innerHTML = chunk.replace(/\n/g, '<br>');
        i++;
        setTimeout(tick, this.TYPE_SPEED + (Math.random() * 18 | 0));
      };
      tick();
    });
  },

  _erase(length) {
    return new Promise(r => {
      let i = length;
      const tick = () => {
        if (i < 0) { r(); return; }
        const text = this._current().slice(0, i);
        this._el.innerHTML = text.replace(/\n/g, '<br>');
        i--;
        setTimeout(tick, this.ERASE_SPEED);
      };
      tick();
    });
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
  baseUrl: '/api/data',
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
   Bootstrap
   ======================================== */

(async function bootstrap() {
  Theme.init();
  MobileNav.init();

  await DataLoader.load();

  ProjectCards.init();
  HorizontalScroll.init();
  Timeline.init();
  ClawdVideoKeyer.init();
  Signature.init();
  Badge.init();
})();
