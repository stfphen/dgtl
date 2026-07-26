/* DGTL Influence Journal — shared behavior (progressive enhancement only).
   Degrades gracefully; respects prefers-reduced-motion. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- mobile nav overlay --- */
  var toggle = document.querySelector('.nav-toggle');
  var overlay = document.querySelector('.nav-overlay');
  if (toggle && overlay) {
    var closeEls = overlay.querySelectorAll('[data-close]');
    function open() { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { overlay.classList.remove('open'); document.body.style.overflow = ''; }
    toggle.addEventListener('click', open);
    overlay.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    closeEls.forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* --- scroll reveal --- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* --- count-up on metrics (data-count / data-suffix / data-decimals) --- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    var decimals = (el.getAttribute('data-decimals') | 0);
    if (reduce) { el.textContent = prefix + target.toFixed(decimals) + suffix; return; }
    var start = null, dur = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var metrics = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    var mio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); mio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    metrics.forEach(function (el) { mio.observe(el); });
  } else { metrics.forEach(countUp); }

  /* --- statement line typewriter (gold finale) --- */
  var fin = document.querySelector('.statement .fin[data-type]');
  if (fin) {
    var full = fin.getAttribute('data-type');
    if (reduce) { fin.textContent = full; }
    else {
      fin.textContent = '';
      var started = false;
      function type() {
        if (started) return; started = true;
        var i = 0;
        (function tick() {
          fin.textContent = full.slice(0, i++);
          if (i <= full.length) setTimeout(tick, 55);
        })();
      }
      if ('IntersectionObserver' in window) {
        var sio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { type(); sio.disconnect(); } });
        }, { threshold: 0.6 });
        sio.observe(fin);
      } else { type(); }
    }
  }

  /* --- sticky bottom CTA: show after hero, hide near footer / on dismiss --- */
  var sticky = document.querySelector('.sticky-cta');
  if (sticky) {
    var dismissed = false;
    var closeBtn = sticky.querySelector('.x');
    if (closeBtn) closeBtn.addEventListener('click', function () { dismissed = true; sticky.classList.remove('show'); });
    var footer = document.querySelector('.foot');
    window.addEventListener('scroll', function () {
      if (dismissed) return;
      var y = window.scrollY || window.pageYOffset;
      var nearFooter = footer && (footer.getBoundingClientRect().top < window.innerHeight + 40);
      if (y > 640 && !nearFooter) sticky.classList.add('show'); else sticky.classList.remove('show');
    }, { passive: true });
  }

  /* --- category filter pills (hub) --- */
  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-filter]').forEach(function (b) { b.classList.remove('active'); b.removeAttribute('aria-current'); });
      btn.classList.add('active'); btn.setAttribute('aria-current', 'true');
    });
  });

  /* --- demo forms: acknowledge, never actually submit --- */
  document.querySelectorAll('form[data-demo]').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var note = f.parentElement.querySelector('[data-note]') || f.querySelector('[data-note]');
      if (note) { note.textContent = 'Thanks — you’re on the list.'; note.style.color = 'var(--gold)'; }
      f.reset();
    });
  });
})();
