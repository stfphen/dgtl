/* ============================================================
   POLISH STONE — motion & interaction engine
   Framework-free. Every module feature-detects its markup and
   bails under prefers-reduced-motion. 60fps: transforms only,
   one rAF loop for scroll-driven work.
   ============================================================ */
(function () {
  "use strict";
  var doc = document, win = window;
  doc.documentElement.classList.add("js");
  var REDUCED = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = win.matchMedia("(pointer: fine)").matches;

  /* ---------- preloader (once per session) ---------- */
  var pre = doc.querySelector(".pre");
  if (pre) {
    var seen = false;
    try { seen = sessionStorage.getItem("ps_seen") === "1"; } catch (e) {}
    if (seen || REDUCED) {
      pre.parentNode.removeChild(pre);
    } else {
      try { sessionStorage.setItem("ps_seen", "1"); } catch (e) {}
      doc.documentElement.classList.add("lock");
      win.setTimeout(function () {
        pre.classList.add("done");
        doc.documentElement.classList.remove("lock");
        win.setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 1000);
      }, 1450);
    }
  }

  /* ---------- page curtain transitions ---------- */
  var curtain = doc.querySelector(".curtain");
  if (curtain && !REDUCED) {
    doc.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || a.target === "_blank" ||
          /^(mailto:|tel:|https?:\/\/)/.test(href) || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      curtain.classList.add("on");
      win.setTimeout(function () { win.location.href = href; }, 520);
    });
    win.addEventListener("pageshow", function (ev) {
      if (ev.persisted) { curtain.classList.remove("on", "off"); }
    });
  }

  /* ---------- custom cursor ---------- */
  var cursor = doc.querySelector(".cursor");
  if (cursor && FINE && !REDUCED) {
    var label = cursor.querySelector(".cursor__label");
    var cx = -100, cy = -100, tx = -100, ty = -100, cursorOn = false;
    doc.addEventListener("mousemove", function (e) { tx = e.clientX; ty = e.clientY; cursorOn = true; });
    (function loopCursor() {
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      cursor.style.transform = "translate(" + cx + "px," + cy + "px)";
      requestAnimationFrame(loopCursor);
    })();
    doc.addEventListener("mouseover", function (e) {
      var t = e.target;
      var lbl = t.closest ? t.closest("[data-cursor]") : null;
      var lnk = t.closest ? t.closest("a,button,.mat figure") : null;
      if (lbl) {
        cursor.classList.add("is-label"); cursor.classList.remove("is-link");
        if (label) label.textContent = lbl.getAttribute("data-cursor");
      } else if (lnk) {
        cursor.classList.add("is-link"); cursor.classList.remove("is-label");
      } else {
        cursor.classList.remove("is-link", "is-label");
      }
    });
  }

  /* ---------- magnetic buttons ---------- */
  if (FINE && !REDUCED) {
    doc.querySelectorAll(".btn").forEach(function (b) {
      b.addEventListener("mousemove", function (e) {
        var r = b.getBoundingClientRect();
        var mx = (e.clientX - r.left - r.width / 2) * 0.18;
        var my = (e.clientY - r.top - r.height / 2) * 0.3;
        b.style.transform = "translate(" + mx + "px," + my + "px)";
      });
      b.addEventListener("mouseleave", function () { b.style.transform = ""; });
    });
  }

  /* ---------- nav: solid state, hide on scroll down, menu ---------- */
  var nav = doc.querySelector(".nav");
  if (nav) {
    var lastY = 0;
    var onNavScroll = function () {
      var y = win.scrollY;
      nav.classList.toggle("nav--solid", y > 60);
      if (y > 500 && y > lastY + 6) nav.classList.add("nav--hide");
      else if (y < lastY - 6 || y < 500) nav.classList.remove("nav--hide");
      lastY = y;
    };
    win.addEventListener("scroll", onNavScroll, { passive: true });
    onNavScroll();
  }
  var menu = doc.querySelector(".menu");
  var burger = doc.querySelector(".burger");
  if (menu && burger) {
    var closeBtn = menu.querySelector(".menu__close");
    var toggleMenu = function (open) {
      menu.classList.toggle("open", open);
      doc.body.classList.toggle("lock", open);
      menu.querySelectorAll("a.menu__l").forEach(function (l, i) {
        l.style.transitionDelay = open ? (0.08 + i * 0.05) + "s" : "0s";
      });
    };
    burger.addEventListener("click", function () { toggleMenu(!menu.classList.contains("open")); });
    if (closeBtn) closeBtn.addEventListener("click", function () { toggleMenu(false); });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { toggleMenu(false); });
    });
  }

  /* ---------- word-mask text reveals ---------- */
  var splitWords = function (el) {
    if (el.dataset.split) return;
    el.dataset.split = "1";
    var walk = function (node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (k) {
        if (k.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          k.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(" ")); return; }
            var w = doc.createElement("span"); w.className = "w";
            var wi = doc.createElement("span"); wi.className = "wi";
            wi.textContent = part; w.appendChild(wi); frag.appendChild(w);
          });
          node.replaceChild(frag, k);
        } else if (k.nodeType === 1 && !k.classList.contains("w")) {
          walk(k);
        }
      });
    };
    walk(el);
    el.querySelectorAll(".wi").forEach(function (wi, i) {
      wi.style.transitionDelay = (i * 0.045) + "s";
    });
  };

  if (!REDUCED) {
    doc.querySelectorAll(".rv-t").forEach(splitWords);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    doc.querySelectorAll(".rv, .rv-t, .rv-img").forEach(function (el) { io.observe(el); });
  } else {
    doc.querySelectorAll(".rv, .rv-t, .rv-img").forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- counters ---------- */
  var counters = doc.querySelectorAll("[data-count]");
  if (counters.length && !REDUCED) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var el = en.target, to = parseFloat(el.getAttribute("data-count")) || 0;
        var t0 = null, dur = 1400;
        var tick = function (t) {
          if (!t0) t0 = t;
          var p = Math.min(1, (t - t0) / dur);
          p = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(to * p));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  /* ---------- shared rAF scroll loop ---------- */
  var jobs = [];
  var addJob = function (fn) { jobs.push(fn); };
  if (!REDUCED) {
    (function raf() {
      var y = win.scrollY, vh = win.innerHeight;
      for (var i = 0; i < jobs.length; i++) jobs[i](y, vh);
      requestAnimationFrame(raf);
    })();
  }

  /* hero parallax */
  var heroBg = doc.querySelector(".hero__bg");
  if (heroBg && !REDUCED) {
    addJob(function (y) {
      if (y < win.innerHeight * 1.2) heroBg.style.transform = "translateY(" + y * 0.28 + "px)";
    });
  }

  /* generic parallax: data-plx="0.2" */
  doc.querySelectorAll("[data-plx]").forEach(function (el) {
    if (REDUCED) return;
    var f = parseFloat(el.getAttribute("data-plx")) || 0.2;
    addJob(function (y, vh) {
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var mid = r.top + r.height / 2 - vh / 2;
      el.style.transform = "translateY(" + (-mid * f) + "px)";
    });
  });

  /* ---------- craft scrollytelling ---------- */
  var craft = doc.querySelector(".craft");
  if (craft) {
    var steps = craft.querySelectorAll(".craft__step");
    var imgs = craft.querySelectorAll(".craft__media img");
    var bar = craft.querySelector(".craft__bar");
    var setStep = function (idx) {
      steps.forEach(function (s, i) { s.classList.toggle("on", i === idx); });
      imgs.forEach(function (im, i) { im.classList.toggle("on", i === idx); });
    };
    if (REDUCED) { setStep(0); }
    else {
      craft.style.height = (steps.length * 90 + 100) + "vh";
      addJob(function (y, vh) {
        var r = craft.getBoundingClientRect();
        var total = craft.offsetHeight - vh;
        var p = Math.min(1, Math.max(0, -r.top / total));
        if (r.bottom < 0 || r.top > vh) return;
        var idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
        setStep(idx);
        if (bar) bar.style.transform = "scaleX(" + p + ")";
      });
    }
  }

  /* ---------- horizontal work gallery ---------- */
  var hwork = doc.querySelector(".hwork");
  if (hwork) {
    var track = hwork.querySelector(".hwork__track");
    if (track && !REDUCED) {
      var sizeH = function () {
        var extra = track.scrollWidth - win.innerWidth;
        hwork.style.height = (win.innerHeight + Math.max(0, extra)) + "px";
      };
      sizeH();
      win.addEventListener("resize", sizeH);
      addJob(function (y, vh) {
        var r = hwork.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var total = hwork.offsetHeight - vh;
        var p = Math.min(1, Math.max(0, -r.top / total));
        var extra = track.scrollWidth - win.innerWidth;
        track.style.transform = "translateX(" + (-p * Math.max(0, extra)) + "px)";
      });
    }
  }

  /* ---------- services image-trail ---------- */
  var svcList = doc.querySelector(".svc__list");
  var svcImg = doc.querySelector(".svc__img");
  if (svcList && svcImg && FINE && !REDUCED) {
    var sImgs = {}, ix = 0, iy = 0, gx = 0, gy = 0;
    svcImg.querySelectorAll("img").forEach(function (im) { sImgs[im.getAttribute("data-key")] = im; });
    svcList.addEventListener("mousemove", function (e) { gx = e.clientX + 30; gy = e.clientY - 90; });
    (function loopImg() {
      ix += (gx - ix) * 0.12; iy += (gy - iy) * 0.12;
      svcImg.style.transform = "translate(" + ix + "px," + iy + "px)";
      requestAnimationFrame(loopImg);
    })();
    svcList.querySelectorAll(".svc__row").forEach(function (row) {
      row.addEventListener("mouseenter", function () {
        var key = row.getAttribute("data-img");
        Object.keys(sImgs).forEach(function (k) { sImgs[k].classList.toggle("on", k === key); });
        svcImg.classList.add("on");
      });
    });
    svcList.addEventListener("mouseleave", function () { svcImg.classList.remove("on"); });
  }

  /* ---------- materials accordion (tap support) ---------- */
  doc.querySelectorAll(".mat figure").forEach(function (f) {
    f.addEventListener("click", function () {
      doc.querySelectorAll(".mat figure").forEach(function (o) { o.classList.toggle("on", o === f && !f.classList.contains("on")); });
    });
  });

  /* ---------- FAQ accordion ---------- */
  doc.querySelectorAll(".faq__q").forEach(function (q) {
    q.addEventListener("click", function () {
      var open = q.getAttribute("aria-expanded") === "true";
      var a = q.nextElementSibling;
      q.setAttribute("aria-expanded", String(!open));
      if (a) a.style.maxHeight = open ? "" : a.scrollHeight + "px";
    });
  });

  /* ---------- quote carousel ---------- */
  var quotes = doc.querySelectorAll(".quote");
  if (quotes.length > 1) {
    var qi = 0, qTimer = null;
    var idxEl = doc.querySelector(".quotes__idx");
    var showQ = function (n) {
      qi = (n + quotes.length) % quotes.length;
      quotes.forEach(function (q, i) { q.classList.toggle("on", i === qi); });
      if (idxEl) idxEl.textContent = (qi + 1) + " / " + quotes.length;
    };
    var restart = function () {
      if (qTimer) clearInterval(qTimer);
      if (!REDUCED) qTimer = setInterval(function () { showQ(qi + 1); }, 6500);
    };
    var prevB = doc.querySelector("[data-q-prev]"), nextB = doc.querySelector("[data-q-next]");
    if (prevB) prevB.addEventListener("click", function () { showQ(qi - 1); restart(); });
    if (nextB) nextB.addEventListener("click", function () { showQ(qi + 1); restart(); });
    showQ(0); restart();
  }

  /* ---------- demo form ---------- */
  doc.querySelectorAll("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = f.querySelector(".form__ok");
      var btn = f.querySelector("button[type=submit]");
      if (ok) ok.style.display = "block";
      if (btn) btn.innerHTML = "Request Sent&nbsp;&nbsp;✓";
    });
  });

  /* ---------- footer year ---------- */
  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
