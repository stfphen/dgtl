/* DGTL Creator Publication Kit — block interactions (progressive enhancement). */
(function () {
  /* 12 · Featured Project Spotlight — click a thumb to swap the main panel.
     Works with real <img> (data-img) or gradient tiles (data-cls: ph/ph-2/ph-3). */
  var GRADS = ['ph', 'ph-2', 'ph-3'];
  document.querySelectorAll('[data-spotlight]').forEach(function (root) {
    var main = root.querySelector('.spot-main');
    var img = main.querySelector('img');
    var kick = main.querySelector('.kick');
    var ttl = main.querySelector('.ttl');
    var desc = main.querySelector('.desc');
    root.querySelectorAll('.spot-thumb').forEach(function (th) {
      th.addEventListener('click', function () {
        root.querySelectorAll('.spot-thumb').forEach(function (t) { t.classList.remove('active'); });
        th.classList.add('active');
        if (th.dataset.img && img) img.src = th.dataset.img;
        if (th.dataset.cls) { GRADS.forEach(function (g) { main.classList.remove(g); }); main.classList.add(th.dataset.cls); }
        if (kick) kick.textContent = th.dataset.kick || kick.textContent;
        if (ttl) ttl.textContent = th.dataset.title || ttl.textContent;
        if (desc) desc.textContent = th.dataset.desc || desc.textContent;
      });
    });
  });

  /* 03 · Table of Contents — highlight active heading on scroll */
  var toc = document.querySelector('[data-toc]');
  if (toc && 'IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a'));
    var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('active'); });
          var m = toc.querySelector('a[href="#' + e.target.id + '"]');
          if (m) m.classList.add('active');
        }
      });
    }, { rootMargin: '-10% 0px -70% 0px' });
    targets.forEach(function (t) { tio.observe(t); });
  }

  /* 09 · Follow button toggle (cosmetic demo) */
  document.querySelectorAll('.btn-follow').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.classList.toggle('on');
      b.textContent = on ? 'Following' : 'Follow';
    });
  });
})();
