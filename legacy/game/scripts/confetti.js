/* ===== Shared Confetti ===== */
(function() {
  var DEFAULT_COLORS = ['#ff3b30','#ff9500','#ffcc00','#4cd964','#5ac8fa','#007aff','#5856d6','#ff2d55'];

  function fireConfetti(opts) {
    opts = opts || {};
    var colors = opts.colors || DEFAULT_COLORS;
    var count = opts.count || 80;
    var durationMin = opts.durationMin || 2;
    var durationMax = opts.durationMax || 3.5;
    var delayMax = opts.delayMax || 0.8;
    var widthMin = opts.widthMin || 4;
    var widthMax = opts.widthMax || 12;
    var heightMin = opts.heightMin || 4;
    var heightMax = opts.heightMax || 16;
    var removeAfter = opts.removeAfter || 5000;

    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = (Math.random() * 100) + 'vw';
      el.style.width = (widthMin + Math.random() * (widthMax - widthMin)) + 'px';
      el.style.height = (heightMin + Math.random() * (heightMax - heightMin)) + 'px';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      el.style.animationDuration = (durationMin + Math.random() * (durationMax - durationMin)) + 's';
      el.style.animationDelay = (Math.random() * delayMax) + 's';
      document.body.appendChild(el);
      setTimeout(function(node) {
        return function() { if (node.parentNode) node.parentNode.removeChild(node); };
      }(el), removeAfter);
    }
  }

  window.fireConfetti = fireConfetti;
  window.launchConfetti = fireConfetti;
})();
