/* ============================================================
   Aviral Garg — Portfolio interactions
   Vanilla JS. No dependencies.
   ============================================================ */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ============================================================
     Synapse field — the hero signature.
     A sparse constellation of drifting nodes. Nearby nodes are
     linked by faint edges. Periodically a node "fires": a bright
     pulse travels along its edges to neighbours, which glow and
     may fire onward — activations propagating through a network.
     ============================================================ */
  (function synapseField() {
    var canvas = document.getElementById("synapse");
    var hero = document.getElementById("hero");
    if (!canvas || !hero) return;

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var nodes = [];
    var pulses = [];
    var mouse = { x: -9999, y: -9999 };
    var running = false;
    var rafId = null;
    var lastFire = 0;

    var LINK_DIST = 150;        // px — max distance for an edge
    var MOUSE_RADIUS = 190;     // px — mouse attraction range
    var FIRE_EVERY = [900, 1700]; // ms — random interval between spontaneous firings
    var CHAIN_PROB = 0.45;      // chance a pulse propagates another hop
    var MAX_DEPTH = 3;          // max chain length
    var MAX_PULSES = 14;        // safety cap

    function resize() {
      var rect = hero.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedNodes();
    }

    function seedNodes() {
      var target = Math.max(26, Math.min(78, Math.round((W * H) / 22000)));
      nodes = [];
      for (var i = 0; i < target; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: 1.1 + Math.random() * 1.5,
          glow: 0 // 0..1, decays after firing
        });
      }
    }

    function neighboursOf(i) {
      var out = [];
      var a = nodes[i];
      for (var j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < LINK_DIST * LINK_DIST) out.push(j);
      }
      return out;
    }

    function fire(i, depth) {
      if (pulses.length >= MAX_PULSES) return;
      nodes[i].glow = 1;
      var ns = neighboursOf(i);
      if (!ns.length) return;
      // send a pulse down 1–2 random edges
      var count = Math.min(ns.length, 1 + (Math.random() < 0.4 ? 1 : 0));
      for (var k = 0; k < count; k++) {
        var j = ns[Math.floor(Math.random() * ns.length)];
        pulses.push({ from: i, to: j, t: 0, depth: depth });
      }
    }

    function step(now) {
      ctx.clearRect(0, 0, W, H);

      // spontaneous firing
      if (now - lastFire > FIRE_EVERY[0] + Math.random() * (FIRE_EVERY[1] - FIRE_EVERY[0])) {
        fire(Math.floor(Math.random() * nodes.length), 0);
        lastFire = now;
      }

      // move nodes
      var i, n;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        // gentle mouse attraction
        var mdx = mouse.x - n.x, mdy = mouse.y - n.y;
        var md2 = mdx * mdx + mdy * mdy;
        if (md2 < MOUSE_RADIUS * MOUSE_RADIUS && md2 > 1) {
          var md = Math.sqrt(md2);
          n.vx += (mdx / md) * 0.012;
          n.vy += (mdy / md) * 0.012;
        }
        // damping + drift
        n.vx *= 0.985; n.vy *= 0.985;
        n.x += n.vx; n.y += n.vy;
        // soft wrap
        if (n.x < -10) n.x = W + 10; if (n.x > W + 10) n.x = -10;
        if (n.y < -10) n.y = H + 10; if (n.y > H + 10) n.y = -10;
        if (n.glow > 0) n.glow = Math.max(0, n.glow - 0.02);
      }

      // edges
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            var alpha = 0.14 * (1 - Math.sqrt(d2) / LINK_DIST);
            ctx.strokeStyle = "rgba(45, 212, 191," + alpha.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // travelling pulses
      for (i = pulses.length - 1; i >= 0; i--) {
        var p = pulses[i];
        var from = nodes[p.from], to = nodes[p.to];
        p.t += 0.028;
        if (p.t >= 1) {
          // pulse arrives: bloom, maybe chain onward
          if (p.depth < MAX_DEPTH && Math.random() < CHAIN_PROB) {
            fire(p.to, p.depth + 1);
          } else {
            nodes[p.to].glow = 1;
          }
          pulses.splice(i, 1);
          continue;
        }
        var px = from.x + (to.x - from.x) * p.t;
        var py = from.y + (to.y - from.y) * p.t;
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(52, 211, 153, 0.9)";
        ctx.fillStyle = "rgba(169, 245, 211, 0.95)";
        ctx.beginPath();
        ctx.arc(px, py, 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // nodes
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var base = 0.35 + n.glow * 0.65;
        if (n.glow > 0.02) {
          ctx.save();
          ctx.shadowBlur = 16 * n.glow;
          ctx.shadowColor = "rgba(52, 211, 153, 0.85)";
        }
        ctx.fillStyle = "rgba(169, 245, 211," + base.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.glow * 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (n.glow > 0.02) ctx.restore();
      }

      if (running) rafId = requestAnimationFrame(step);
    }

    function drawStatic() {
      // Reduced motion: draw one calm frame, no animation.
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            var alpha = 0.12 * (1 - Math.sqrt(d2) / LINK_DIST);
            ctx.strokeStyle = "rgba(45, 212, 191," + alpha.toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        ctx.fillStyle = "rgba(169, 245, 211, 0.4)";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    function start() {
      if (running || prefersReducedMotion) return;
      running = true;
      rafId = requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    resize();
    window.addEventListener("resize", function () { resize(); if (prefersReducedMotion) drawStatic(); }, { passive: true });

    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    hero.addEventListener("mouseleave", function () { mouse.x = -9999; mouse.y = -9999; });

    if (prefersReducedMotion) {
      drawStatic();
      return;
    }

    // Only animate while the hero is on screen and the tab is visible.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start(); else stop();
        });
      }, { threshold: 0.05 }).observe(hero);
    } else {
      start();
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else if (hero.getBoundingClientRect().bottom > 0) start();
    });
  })();

  /* ---------- Typewriter roles ---------- */
  (function typewriter() {
    var el = document.querySelector(".hero-roles-typing");
    if (!el) return;
    var roles;
    try { roles = JSON.parse(el.getAttribute("data-roles") || "[]"); } catch (e) { roles = []; }
    if (!roles.length) return;

    if (prefersReducedMotion) {
      el.textContent = roles[0];
      return;
    }

    var index = 0, charIndex = 0, deleting = false;
    function tick() {
      var current = roles[index] || "";
      if (!deleting) {
        charIndex++;
        if (charIndex >= current.length + 4) {
          deleting = true;
          setTimeout(tick, 1100);
          return;
        }
      } else {
        charIndex--;
        if (charIndex <= 0) {
          deleting = false;
          index = (index + 1) % roles.length;
        }
      }
      el.textContent = current.slice(0, Math.max(charIndex, 0));
      setTimeout(tick, deleting ? 40 : 75);
    }
    tick();
  })();

  /* ---------- Stat counters ---------- */
  (function counters() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;

    function animate(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (prefersReducedMotion) { el.textContent = target; return; }
      var duration = 1200;
      var startTime = null;
      function frame(now) {
        if (!startTime) startTime = now;
        var t = Math.min((now - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
      return;
    }
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          seen.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { seen.observe(el); });
  })();

  /* ---------- Scroll reveal ---------- */
  (function reveal() {
    var revealEls = document.querySelectorAll(".reveal");
    if (!revealEls.length) return;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("reveal-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { observer.observe(el); });
  })();

  /* ---------- Courses toggle ---------- */
  (function coursesToggle() {
    var buttons = document.querySelectorAll(".pill-toggle-btn");
    var panels = document.querySelectorAll(".courses-panel");
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-target");
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        panels.forEach(function (panel) {
          panel.classList.toggle("active", panel.id === targetId);
        });
      });
    });
  })();

  /* ---------- Mobile navigation ---------- */
  (function mobileNav() {
    var toggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (!toggle || !navLinks) return;
    toggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      toggle.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  })();

  /* ---------- Scroll progress bar ---------- */
  (function progressBar() {
    var bar = document.getElementById("scrollProgress");
    if (!bar) return;
    window.addEventListener("scroll", function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + "%";
    }, { passive: true });
  })();

  /* ---------- Scrollspy ---------- */
  (function scrollspy() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("section[id]"));
    var anchors = document.querySelectorAll(".nav-links a[href^='#']");
    if (!sections.length || !anchors.length) return;

    var ticking = false;
    function updateActive() {
      var reference = window.scrollY + 140;
      var currentId = sections[0].id;
      sections.forEach(function (section) {
        if (section.offsetTop <= reference) currentId = section.id;
      });
      anchors.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + currentId);
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(updateActive);
        ticking = true;
      }
    }, { passive: true });
    updateActive();
  })();

  /* ---------- Back to top ---------- */
  (function backToTop() {
    var btn = document.getElementById("backToTop");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("visible", window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  })();

})();
