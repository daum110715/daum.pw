(function() {
  var THEME_KEY = 'theme'
  var DEFAULT_THEME = 'sketch'

  var VALID_THEMES = ['dark','flat','neumorphism','cyberpunk','terminal','material','vaporwave','sketch','clay','brutalist','pixel','editorial','swiss','bento','noir','parchment','bauhaus','synthwave']
  function getSavedTheme() {
    try {
      var raw = localStorage.getItem(THEME_KEY)
      if (raw) {
        if (raw === 'default' || raw === 'glass') return DEFAULT_THEME
        if (VALID_THEMES.indexOf(raw) >= 0) return raw
      }
    } catch (e) {}
    return DEFAULT_THEME
  }

  var saved = getSavedTheme()
  document.documentElement.setAttribute('data-theme', saved)

  function buildCustomDropdown(select) {
    var options = Array.prototype.slice.call(select.options)
    var wrapper = document.createElement('div')
    wrapper.className = 'custom-dropdown'

    var listId = 'custom-dropdown-list-' + Math.random().toString(36).slice(2, 8)

    var trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'custom-dropdown-trigger'
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', listId)
    trigger.textContent = select.options[select.selectedIndex]
      ? select.options[select.selectedIndex].text
      : ''
    var list = document.createElement('div')
    list.id = listId
    list.className = 'custom-dropdown-list'
    list.setAttribute('role', 'listbox')
    list.hidden = true

    options.forEach(function(opt) {
      var item = document.createElement('div')
      item.className = 'custom-dropdown-item'
      if (opt.value === select.value) item.classList.add('is-active')
      item.dataset.value = opt.value
      item.textContent = opt.text
      item.setAttribute('role', 'option')
      list.appendChild(item)
    })

    wrapper.appendChild(trigger)
    wrapper.appendChild(list)
    select.style.display = 'none'
    select.parentNode.insertBefore(wrapper, select)

    var closeTimer = null
    function close() {
      list.classList.remove('is-open')
      trigger.classList.remove('is-open')
      if (closeTimer) clearTimeout(closeTimer)
      closeTimer = setTimeout(function() { list.hidden = true; closeTimer = null }, 180)
    }

    function open() {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
      trigger.setAttribute('aria-expanded', 'true')
      list.hidden = false
      requestAnimationFrame(function() {
        list.classList.add('is-open')
        trigger.classList.add('is-open')
        var active = list.querySelector('.is-active')
        if (active) active.scrollIntoView({ block: 'nearest' })
      })
    }

    function setValue(value) {
      select.value = value
      trigger.textContent = select.options[select.selectedIndex].text
      var items = list.querySelectorAll('.custom-dropdown-item')
      for (var i = 0; i < items.length; i++) {
        var active = items[i].dataset.value === value
        items[i].classList.toggle('is-active', active)
        items[i].setAttribute('aria-selected', active ? 'true' : 'false')
      }
      select.dispatchEvent(new Event('change', { bubbles: true }))
      close()
    }

    trigger.addEventListener('click', function(e) {
      e.stopPropagation()
      if (list.hidden) open(); else close()
    })

    list.addEventListener('click', function(e) {
      var item = e.target.closest('.custom-dropdown-item')
      if (item) setValue(item.dataset.value)
    })

    document.addEventListener('click', function(e) {
      if (!wrapper.contains(e.target)) close()
    })

    trigger.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (list.hidden) { open(); return }
        var items = Array.prototype.slice.call(list.querySelectorAll('.custom-dropdown-item'))
        var current = list.querySelector('.is-active')
        var idx = items.indexOf(current)
        if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1)
        else idx = Math.max(idx - 1, 0)
        setValue(items[idx].dataset.value)
        open()
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (list.hidden) open(); else { close(); trigger.focus() }
      } else if (e.key === 'Escape') {
        if (!list.hidden) { e.preventDefault(); close(); trigger.focus() }
      }
    })

    select.addEventListener('change', function() {
      trigger.textContent = select.options[select.selectedIndex].text
      var items = list.querySelectorAll('.custom-dropdown-item')
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-active', items[i].dataset.value === select.value)
      }
    })

    select._updateCustomDropdown = function() {
      trigger.textContent = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : ''
      var items = list.querySelectorAll('.custom-dropdown-item')
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-active', items[i].dataset.value === select.value)
      }
    }
  }

  window.buildCustomDropdown = buildCustomDropdown

  function applyTheme(value) {
    document.documentElement.setAttribute('data-theme', value)
    try { localStorage.setItem(THEME_KEY, value) } catch (e) {}
  }

  function initThemeSwitcher() {
    var select = document.getElementById('theme-switcher')
    if (!select) return
    select.value = saved
    select.addEventListener('change', function() {
      applyTheme(this.value)
    })
    buildCustomDropdown(select)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeSwitcher)
  } else {
    initThemeSwitcher()
  }
})()
