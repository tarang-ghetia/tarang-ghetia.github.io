/* =========================================================
   Tarang Ghetia — Portfolio
   Vanilla JS · no dependencies · performance-first
   ========================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Year ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Theme toggle (dark default, light optional) ---------- */
  const isLight = () => document.documentElement.getAttribute("data-theme") === "light";
  window.__isLight = isLight; // shared with rl-demo / name-arm
  const themeBtn = $("#themeToggle");
  function themeLabel() {
    if (themeBtn) themeBtn.setAttribute("aria-label", isLight() ? "Switch to dark theme" : "Switch to light theme");
  }
  themeLabel();
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = isLight() ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      themeLabel();
      window.dispatchEvent(new CustomEvent("themechange"));
    });
  }

  /* ---------- Nav: shadow on scroll + scroll progress ---------- */
  const nav = $("#nav");
  const scrollBar = $("#scrollBar");
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 24);
    if (scrollBar) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      scrollBar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const toggle = $("#navToggle");
  const menu = $("#mobileMenu");
  if (toggle && menu) {
    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(menu.hidden));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------- Reveal on scroll (scroll-based; robust everywhere) ---------- */
  const revealEls = $$("[data-reveal]");
  if (prefersReduced) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    let pending = revealEls.slice();
    const check = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      let batch = 0; // stagger everything that reveals in the same pass
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > 0) {
          el.style.transitionDelay = Math.min(batch * 70, 420) + "ms";
          batch++;
          el.classList.add("is-visible");
          el.addEventListener("transitionend", function clearDelay() {
            el.style.transitionDelay = "";
            el.removeEventListener("transitionend", clearDelay);
          });
          return false;
        }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener("scroll", onCheck);
        window.removeEventListener("resize", onCheck);
      }
    };
    let scheduled = false;
    const onCheck = () => {
      if (scheduled) return; scheduled = true;
      window.requestAnimationFrame(() => { scheduled = false; check(); });
    };
    window.addEventListener("scroll", onCheck, { passive: true });
    window.addEventListener("resize", onCheck, { passive: true });
    window.addEventListener("load", check);
    check(); // initial (reveals whatever is already in view)
    // hard failsafe: never leave content permanently hidden
    setTimeout(() => revealEls.forEach((el) => el.classList.add("is-visible")), 4000);
  }

  /* ---------- Animated counters ---------- */
  const counters = $$("[data-count]");
  const runCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    if (prefersReduced) { el.textContent = target.toFixed(decimals) + suffix; return; }
    const dur = 1400;
    let start = null;
    const step = (t) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals) + suffix;
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { runCount(entry.target); cio.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
  } else {
    counters.forEach(runCount);
  }

  /* ---------- Publication filter ---------- */
  const filterBtns = $$(".filter__btn");
  const pubs = $$(".pub");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter;
      filterBtns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active"); btn.setAttribute("aria-selected", "true");
      pubs.forEach((p) => {
        const type = p.dataset.type;
        const show = f === "all"
          || (f === "journal" && type === "journal")
          || (f === "conference" && type === "conference")
          || (f === "review" && type === "review");
        const wasHidden = p.classList.contains("is-hidden");
        p.classList.toggle("is-hidden", !show);
        if (show && wasHidden && !prefersReduced) {
          p.classList.remove("pub--in");
          void p.offsetWidth; // restart the entrance animation
          p.classList.add("pub--in");
        }
      });
    });
  });

  /* ---------- Active nav link (scroll spy) ---------- */
  const navLinks = $$(".nav__links a");
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + id));
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Project card spotlight + tilt (pointer) ---------- */
  if (window.matchMedia("(hover: hover)").matches) {
    $$(".proj").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
        if (!prefersReduced) {
          card.style.setProperty("--rx", (((e.clientY - r.top) / r.height - 0.5) * -3).toFixed(2) + "deg");
          card.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 3).toFixed(2) + "deg");
        }
      });
      card.addEventListener("pointerleave", () => {
        card.style.removeProperty("--rx");
        card.style.removeProperty("--ry");
      });
    });
  }

  /* ---------- Focus marquee (JS-driven so it always scrolls) ---------- */
  const mqTrack = $("#marqueeTrack");
  if (mqTrack) {
    let mqX = 0, mqHalf = 0, mqLast = 0, mqPaused = false;
    const mqWrap = mqTrack.closest(".marquee");
    if (mqWrap) {
      mqWrap.addEventListener("mouseenter", () => { mqPaused = true; });
      mqWrap.addEventListener("mouseleave", () => { mqPaused = false; });
    }
    const mqMeasure = () => { mqHalf = mqTrack.scrollWidth / 2; };
    mqMeasure();
    window.addEventListener("resize", mqMeasure, { passive: true });
    const mqSpeed = 45; // px/sec
    const mqStep = (ts) => {
      if (!mqLast) mqLast = ts;
      const dt = Math.min(0.05, (ts - mqLast) / 1000);
      mqLast = ts;
      if (!mqPaused) mqX -= mqSpeed * dt;
      if (mqHalf && -mqX >= mqHalf) mqX += mqHalf;
      mqTrack.style.transform = "translateX(" + mqX.toFixed(1) + "px)";
      window.requestAnimationFrame(mqStep);
    };
    if ("requestAnimationFrame" in window) window.requestAnimationFrame(mqStep);
  }

  /* ---------- Delight: copy-to-clipboard + toast ---------- */
  let toastEl = null, toastTimer = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span></span>';
    toastEl.querySelector("span").textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }
  $$("[data-copy]").forEach((el) => {
    el.title = "Click to copy";
    el.addEventListener("click", () => {
      const val = el.getAttribute("data-copy");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => showToast("Copied: " + val), () => {});
      }
    });
  });
  window.__toast = showToast; // shared with other scripts (e.g. RL celebration)

  /* ---------- Delight: magnetic primary buttons ---------- */
  if (!prefersReduced && window.matchMedia("(hover: hover)").matches) {
    $$(".btn--primary").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        btn.style.transform = "translate(" + (mx * 0.28).toFixed(1) + "px," + (my * 0.4).toFixed(1) + "px)";
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  }

  /* ---------- Delight: Konami easter egg ---------- */
  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"];
  let kpos = 0;
  window.addEventListener("keydown", (e) => {
    if (e.key === konami[kpos]) { kpos++; if (kpos === konami.length) { kpos = 0; party(); } }
    else { kpos = (e.key === konami[0]) ? 1 : 0; }
  });
  function party() {
    showToast("Robot mode unlocked");
    if (window.__robotSay) window.__robotSay("Nice moves! 🎉", 2600);
    if (window.__robotWave) window.__robotWave();
    const colors = isLight()
      ? ["#c2410c", "#e8590c", "#0e7490", "#0f7a4d", "#191c22"]
      : ["#5b8cff", "#22d3ee", "#34d399", "#fbbf24", "#eef1f6"];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = (Math.random() * 100) + "vw";
      c.style.background = colors[i % colors.length];
      if (i % 3 === 0) c.style.borderRadius = "50%";
      document.body.appendChild(c);
      const dx = (Math.random() * 2 - 1) * 160;
      const dur = 1800 + Math.random() * 1500;
      const rot = (Math.random() * 2 - 1) * 720;
      c.animate(
        [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
         { transform: "translate(" + dx + "px," + (window.innerHeight + 60) + "px) rotate(" + rot + "deg)", opacity: 1 }],
        { duration: dur, easing: "cubic-bezier(.2,.6,.4,1)" }
      );
      setTimeout(() => c.remove(), dur);
    }
  }

  /* =========================================================
     HERO FLOW-FIELD CANVAS
     Particles advected through a slowly-evolving noise field —
     evokes a policy / dynamics field. Lightweight & DPR-aware.
     ========================================================= */
  const canvas = $("#fieldCanvas");
  if (canvas && !prefersReduced) {
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0, h = 0, dpr = 1;
    let particles = [];
    let raf = null;
    let running = true;
    let t = 0;

    // theme palettes: dark = electric blue/cyan additive glow; light = orange/teal ink
    const FIELD = {
      dark:  { a: "rgba(91,140,255,", c: "rgba(34,211,238,",  fade: "rgba(10,11,14,0.10)",    comp: "lighter" },
      light: { a: "rgba(194,65,12,",  c: "rgba(14,116,144,",  fade: "rgba(246,247,249,0.10)", comp: "source-over" },
    };
    const fieldPal = () => (isLight() ? FIELD.light : FIELD.dark);

    // cheap pseudo-noise flow field (no libs)
    function flow(x, y, time) {
      return (
        Math.sin(x * 0.0016 + time) +
        Math.cos(y * 0.0016 - time * 0.8) +
        Math.sin((x + y) * 0.0011 + time * 0.5)
      ) * 1.1;
    }

    function count() {
      const area = w * h;
      // scale particle count to viewport, capped for low-end devices
      return Math.max(40, Math.min(150, Math.round(area / 14000)));
    }

    function makeParticle() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        life: Math.random() * 200,
        maxLife: 160 + Math.random() * 180,
        speed: 0.35 + Math.random() * 0.7,
        cyan: Math.random() < 0.25,
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: count() }, makeParticle);
    }

    function frame() {
      if (!running) return;
      t += 0.0022;
      const fp = fieldPal();
      // trail fade
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = fp.fade;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = fp.comp;

      for (const p of particles) {
        const a = flow(p.x, p.y, t);
        const vx = Math.cos(a) * p.speed;
        const vy = Math.sin(a) * p.speed;
        const px = p.x, py = p.y;
        p.x += vx; p.y += vy; p.life++;

        const fade = 1 - Math.abs(p.life / p.maxLife - 0.5) * 2; // triangular
        const alpha = Math.max(0, fade) * 0.5;
        const base = p.cyan ? fp.c : fp.a;
        ctx.strokeStyle = base + alpha.toFixed(3) + ")";
        ctx.lineWidth = p.cyan ? 1.1 : 0.8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        if (p.life > p.maxLife || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
          Object.assign(p, makeParticle());
          p.life = 0;
        }
      }
      raf = requestAnimationFrame(frame);
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    }, { passive: true });
    window.addEventListener("themechange", () => ctx.clearRect(0, 0, w, h)); // no stale trails across themes

    // Pause when hero off-screen (save battery/CPU)
    if ("IntersectionObserver" in window) {
      const vis = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          running = entry.isIntersecting;
          if (running && !prefersReduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
        });
      }, { threshold: 0 });
      vis.observe(canvas);
    }
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    });

    resize();
    frame();
  }
})();
