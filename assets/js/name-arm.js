/* =========================================================
   Hero name written by a gantry robot that traces each glyph
   A rail-mounted carriage slides to each letter; a short pen
   arm follows the letter shape while the letter fades in
   cleanly (no ink overlay), then the rig parks at the end of
   the rail and stays. Zero dependencies.
   Clean static fallback on small screens / no-JS.
   ========================================================= */
(function () {
  "use strict";

  var svg = document.getElementById("armSvg");
  var nameEl = document.getElementById("heroName");
  if (!nameEl) return;

  var inner = nameEl.querySelector("span") || nameEl;
  var text = inner.textContent;                 // "Tarang Ghetia."
  var frag = document.createDocumentFragment();
  var chSpans = [], chars = [];
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    if (c === " ") { frag.appendChild(document.createTextNode(" ")); continue; } // breakable space so the name wraps on mobile
    var s = document.createElement("span");
    s.className = "ch"; s.textContent = c; chSpans.push(s); chars.push(c);
    frag.appendChild(s);
  }
  inner.innerHTML = "";
  inner.appendChild(frag);

  // rough stroke skeletons per glyph (normalised 0..1 in the letter box, y down)
  var GLYPH = {
    "T": [[0.05, 0.06], [0.95, 0.06], [0.5, 0.06], [0.5, 1]],
    "a": [[0.86, 0.36], [0.55, 0.18], [0.22, 0.32], [0.14, 0.62], [0.32, 0.9], [0.7, 0.9], [0.88, 0.66], [0.88, 1]],
    "r": [[0.2, 1], [0.2, 0.28], [0.46, 0.16], [0.82, 0.26]],
    "n": [[0.15, 1], [0.15, 0.28], [0.46, 0.16], [0.82, 0.32], [0.85, 1]],
    "g": [[0.86, 0.28], [0.55, 0.14], [0.2, 0.28], [0.15, 0.55], [0.5, 0.7], [0.85, 0.56], [0.87, 0.24], [0.9, 0.9], [0.5, 1], [0.2, 0.9]],
    "G": [[0.9, 0.2], [0.55, 0.05], [0.2, 0.2], [0.06, 0.55], [0.25, 0.92], [0.72, 0.95], [0.92, 0.72], [0.92, 0.52], [0.6, 0.52]],
    "h": [[0.15, 0.02], [0.15, 1], [0.15, 0.52], [0.46, 0.34], [0.82, 0.52], [0.84, 1]],
    "e": [[0.12, 0.62], [0.88, 0.56], [0.8, 0.26], [0.4, 0.16], [0.15, 0.46], [0.2, 0.86], [0.6, 0.98], [0.88, 0.8]],
    "t": [[0.5, 0.05], [0.5, 0.9], [0.78, 0.98], [0.5, 0.32], [0.15, 0.32], [0.85, 0.32]],
    "i": [[0.5, 0.08], [0.5, 0.16], [0.5, 0.36], [0.5, 1]],
    ".": [[0.42, 0.92], [0.58, 0.92], [0.58, 1.04], [0.42, 1.04], [0.42, 0.92]]
  };
  var DEFAULT_GLYPH = [[0.15, 0.2], [0.85, 0.35], [0.15, 0.6], [0.85, 0.85]];

  function revealCh(sp, ch) { if (ch != null) sp.textContent = ch; sp.style.opacity = "1"; sp.style.transform = "none"; sp.style.filter = "none"; }
  function hideCh(sp) { sp.style.opacity = "0"; sp.style.transform = "translateY(0.28em) scale(0.88)"; sp.style.filter = "blur(2.5px)"; }
  function progCh(sp, p) { sp.style.opacity = p.toFixed(2); sp.style.filter = "blur(" + ((1 - p) * 2).toFixed(2) + "px)"; sp.style.transform = "translateY(" + ((1 - p) * 3).toFixed(1) + "px)"; }
  function showAll() { nameEl.classList.add("shown"); for (var k = 0; k < chSpans.length; k++) revealCh(chSpans[k], chars[k]); }

  var canAnimate = svg && window.innerWidth >= 720 && "requestAnimationFrame" in window;
  if (!canAnimate) { showAll(); return; }

  var namewrap = nameEl.parentNode;
  namewrap.classList.add("arm-room");
  nameEl.classList.add("shown");
  for (var j = 0; j < chSpans.length; j++) hideCh(chSpans[j]);

  var raf = null, doneAll = false;
  var failsafe = setTimeout(function () {
    if (doneAll) return;
    cancel(); showAll(); namewrap.classList.remove("arm-room");
    if (svg) { svg.style.transition = "opacity 0.4s"; svg.style.opacity = "0"; }
  }, 12000);
  function cancel() { if (raf) cancelAnimationFrame(raf); raf = null; }

  var built = false;
  function ready(fn) {
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(fn); setTimeout(fn, 900); }
    else { fn(); }
  }
  ready(setup);
  window.addEventListener("load", setup);

  // ---- geometry / refs ----
  var railY, shoulderY, L1, L2, DEG = 180 / Math.PI;
  var gCar, gShoulder, gElbow, perfNow = 0;
  var eyeEl, pupilWrap, pupil, parkA1 = Math.PI / 4, parkA2 = Math.PI * 3 / 4, waving = false;
  var bubble = null, bubbleTimer = null;
  var cur, mi, t0, startPose, moves;
  // fancy bits: energy cable, spinning rollers, pen glow + sparks
  var cable, rollerL, rollerR, rollR = 8, rollDeg = 0, lastCx = 0;
  var cwv = 0, chv = 0, rhv = 0, railX0v = 0, penL = 0;
  var penOn = false, fCount = 0, sparkN = 0;
  var reducedM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setup() {
    if (built) return;
    var rect = svg.getBoundingClientRect();
    var W = rect.width, H = rect.height;
    if (!W || !H || !chSpans.length) return;
    built = true;
    // no viewBox: draw in raw CSS pixels so measured letter positions align 1:1

    var T = chSpans.map(function (sp) {
      var r = sp.getBoundingClientRect();
      return { x0: r.left - rect.left, top: r.top - rect.top, w: r.width, h: r.height, cx: r.left - rect.left + r.width / 2 };
    });
    var letterH = T[0].h || 70;
    var maxY = 0; T.forEach(function (t) { if (t.top + t.h > maxY) maxY = t.top + t.h; });

    railY = Math.max(6, H * 0.05);
    var w1 = Math.max(10, Math.min(20, letterH * 0.13));
    var w2 = w1 * 0.8;
    var jS = w1 * 1.0, jE = w2 * 1.0;
    var rh = Math.max(7, Math.min(13, letterH * 0.1));
    var cw = w1 * 2.6, ch = w1 * 2.4;
    shoulderY = ch * 0.5 + 5;
    var V = Math.max(28, maxY - (railY + shoulderY));
    L1 = V * 0.6; L2 = V * 0.6;
    var penLen = w2 * 1.5;

    var lastT = T[T.length - 1];
    var railRight = W * 0.02 + W * 0.96 - 15;
    var parkX = Math.min(railRight, lastT.x0 + lastT.w + V * 0.7); // just past the name, on the rail

    var n = function (v) { return (+v).toFixed(1); };
    var railX0 = W * 0.02, railLen = W * 0.96;
    cwv = cw; chv = ch; rhv = rh; railX0v = railX0; penL = penLen;
    rollR = Math.max(4, rh * 0.85);

    // rail tick marks (survey markings along the gantry)
    var ticks = "";
    for (var tx = railX0 + 24; tx < railX0 + railLen - 12; tx += 48) {
      ticks += '<path d="M' + n(tx) + ' ' + n(railY - rh / 2 + 1.5) + 'v' + n(rh - 3) + '" stroke="rgba(255,255,255,.08)" stroke-width="1"/>';
    }

    svg.innerHTML =
      '<defs>' +
        '<linearGradient id="botMetal" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#4a5364"/><stop offset=".5" stop-color="#262c38"/><stop offset="1" stop-color="#11141c"/>' +
        '</linearGradient>' +
        '<linearGradient id="botMetalH" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#3a4150"/><stop offset=".5" stop-color="#20252f"/><stop offset="1" stop-color="#3a4150"/>' +
        '</linearGradient>' +
        '<radialGradient id="botGlow" cx=".5" cy=".5" r=".5">' +
          '<stop offset="0" stop-color="#22d3ee" stop-opacity=".85"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<g>' +
        '<rect x="' + n(railX0) + '" y="' + n(railY - rh / 2) + '" width="' + n(railLen) + '" height="' + n(rh) + '" rx="' + n(rh / 2) + '" fill="url(#botMetalH)" stroke="rgba(255,255,255,.07)"/>' +
        ticks +
        '<rect x="' + n(railX0 - 5) + '" y="' + n(railY - rh) + '" width="9" height="' + n(rh * 2) + '" rx="3" fill="url(#botMetal)"/>' +
        '<rect x="' + n(railX0 + railLen - 4) + '" y="' + n(railY - rh) + '" width="9" height="' + n(rh * 2) + '" rx="3" fill="url(#botMetal)"/>' +
      '</g>' +
      '<path id="cable" fill="none"/>' +
      '<g id="gCar">' +
        '<rect x="' + n(-cw / 2 - 3) + '" y="' + n(-rh / 2 - 2) + '" width="' + n(cw + 6) + '" height="' + n(rh + 4) + '" rx="3" fill="#0e1219"/>' +
        '<rect x="' + n(-cw / 2) + '" y="' + n(-ch / 2) + '" width="' + n(cw) + '" height="' + n(ch) + '" rx="5" fill="url(#botMetal)" stroke="rgba(255,255,255,.1)"/>' +
        '<g transform="translate(' + n(-cw * 0.3) + ',0)"><g id="rollerL">' +
          '<circle r="' + n(rollR) + '" fill="#0b0e14" stroke="rgba(255,255,255,.16)" stroke-width="1.2"/>' +
          '<path d="M0 ' + n(-rollR * 0.65) + 'V' + n(rollR * 0.65) + '" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>' +
        '</g></g>' +
        '<g transform="translate(' + n(cw * 0.3) + ',0)"><g id="rollerR">' +
          '<circle r="' + n(rollR) + '" fill="#0b0e14" stroke="rgba(255,255,255,.16)" stroke-width="1.2"/>' +
          '<path d="M0 ' + n(-rollR * 0.65) + 'V' + n(rollR * 0.65) + '" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>' +
        '</g></g>' +
        '<g id="antenna">' +
          '<path d="M' + n(cw * 0.3) + ' ' + n(-ch / 2) + ' l3.5 -8" stroke="url(#botMetal)" stroke-width="2" stroke-linecap="round"/>' +
          '<circle id="antTip" cx="' + n(cw * 0.3 + 3.5) + '" cy="' + n(-ch / 2 - 9) + '" r="2.4"/>' +
        '</g>' +
        '<rect x="' + n(-cw * 0.3) + '" y="' + n(-ch * 0.3) + '" width="' + n(cw * 0.6) + '" height="2.5" rx="1.5" id="carAccent" fill="#2749c9" opacity=".55"/>' +
        '<g id="eye">' +
          '<rect x="' + n(-cw * 0.3) + '" y="' + n(-ch * 0.16) + '" width="' + n(cw * 0.6) + '" height="' + n(ch * 0.42) + '" rx="' + n(ch * 0.16) + '" fill="#07090d"/>' +
          '<g id="pupilWrap">' +
            '<circle id="pupil" cx="0" cy="' + n(ch * 0.05) + '" r="' + n(ch * 0.12) + '" fill="#10a2bd"/>' +
            '<circle cx="' + n(-ch * 0.04) + '" cy="' + n(ch * 0.01) + '" r="' + n(Math.max(0.8, ch * 0.035)) + '" fill="rgba(255,255,255,.85)"/>' +
          '</g>' +
        '</g>' +
        '<g id="leds">' +
          '<circle class="ledDot" cx="' + n(-cw * 0.22) + '" cy="' + n(ch * 0.36) + '" r="' + n(Math.max(1.2, ch * 0.045)) + '"/>' +
          '<circle class="ledDot" cx="' + n(-cw * 0.06) + '" cy="' + n(ch * 0.36) + '" r="' + n(Math.max(1.2, ch * 0.045)) + '"/>' +
          '<circle class="ledDot" cx="' + n(cw * 0.1) + '" cy="' + n(ch * 0.36) + '" r="' + n(Math.max(1.2, ch * 0.045)) + '"/>' +
        '</g>' +
        '<rect x="-3.5" y="' + n(ch * 0.2) + '" width="7" height="' + n(shoulderY - ch * 0.2 + 3) + '" fill="url(#botMetal)"/>' +
        '<g id="gShoulder">' +
          '<rect x="0" y="' + n(-w1 / 2) + '" width="' + n(L1) + '" height="' + n(w1) + '" rx="' + n(w1 / 2) + '" fill="url(#botMetal)" stroke="rgba(255,255,255,.08)"/>' +
          '<rect x="' + n(L1 * 0.2) + '" y="-2" width="' + n(L1 * 0.6) + '" height="4" rx="2" fill="#0b0e14"/>' +
          '<circle r="' + n(jS) + '" fill="url(#botMetal)" class="jointRing" stroke="#2749c9" stroke-opacity=".55" stroke-width="1.4"/>' +
          '<circle r="' + n(jS * 0.4) + '" fill="#0b0e14"/>' +
          '<g id="gElbow" transform="translate(' + n(L1) + ',0)">' +
            '<circle r="' + n(jE) + '" fill="url(#botMetal)" class="jointRing" stroke="#2749c9" stroke-opacity=".55" stroke-width="1.4"/>' +
            '<circle r="' + n(jE * 0.4) + '" fill="#0b0e14"/>' +
            '<g>' +
              '<rect x="0" y="' + n(-w2 / 2) + '" width="' + n(L2) + '" height="' + n(w2) + '" rx="' + n(w2 / 2) + '" fill="url(#botMetal)" stroke="rgba(255,255,255,.08)"/>' +
              '<g transform="translate(' + n(L2) + ',0)">' +
                '<circle r="' + n(w2 * 0.55) + '" fill="url(#botMetal)" class="jointRing" stroke="#2749c9" stroke-opacity=".5" stroke-width="1.1"/>' +
                '<path d="M2 0 L' + n(penLen) + ' 0" stroke="url(#botMetal)" stroke-width="' + n(w2 * 0.42) + '" stroke-linecap="round"/>' +
                '<circle id="penGlow" cx="' + n(penLen) + '" cy="0" r="' + n(Math.max(5, w2 * 1.1)) + '" fill="url(#botGlow)" opacity="0"/>' +
                '<circle cx="' + n(penLen) + '" cy="0" r="' + n(Math.max(2, w2 * 0.26)) + '" id="penTip" fill="#31374a"/>' +
              '</g>' +
            '</g>' +
          '</g>' +
        '</g>' +
      '</g>';

    gCar = svg.querySelector("#gCar");
    gShoulder = svg.querySelector("#gShoulder");
    gElbow = svg.querySelector("#gElbow");
    eyeEl = svg.querySelector("#eye");
    pupilWrap = svg.querySelector("#pupilWrap");
    pupil = svg.querySelector("#pupil");
    cable = svg.querySelector("#cable");
    rollerL = svg.querySelector("#rollerL");
    rollerR = svg.querySelector("#rollerR");

    // ---- choreography: trace each glyph ----
    moves = [];
    function mv(cx, tx, ty, dur, onArrive, onStart, pen) {
      var by = railY + shoulderY, s = ik(tx, ty, cx, by);
      moves.push({ cx: cx, a1: s.a1, a2: s.a2, dur: dur, onArrive: onArrive || null, onStart: onStart || null, pen: !!pen });
    }
    var raise = Math.max(20, V * 0.42);

    for (var li = 0; li < chSpans.length; li++) {
      (function (li) {
        var t = T[li];
        var g = GLYPH[chars[li]] || DEFAULT_GLYPH;
        var npt = g.length;
        var fx = t.x0 + g[0][0] * t.w, fy = t.top + g[0][1] * t.h;
        mv(t.cx, fx, fy - raise * 0.5, null, null, null);                // approach first stroke (pen up)
        for (var k = 0; k < npt; k++) {
          var px = t.x0 + g[k][0] * t.w, py = t.top + g[k][1] * t.h;
          mv(t.cx, px, py, 30, trace(li, (k + 1) / npt), null, true);    // follow the glyph (pen down)
        }
        mv(t.cx, t.cx, t.top + t.h * 0.5, 45, finishLetter(li));         // settle
      })(li);
    }
    // park just past the name on the rail: both arm segments held at 45°, and stay
    moves.push({ cx: parkX, a1: Math.PI / 4, a2: Math.PI * 3 / 4, dur: 520, onArrive: null, onStart: null });

    function trace(idx, p) {
      return function () {
        progCh(chSpans[idx], Math.min(1, p));
      };
    }
    function finishLetter(idx) {
      return function () {
        revealCh(chSpans[idx], chars[idx]);
      };
    }

    var s0 = ik(T[0].x0 + GLYPH[chars[0]][0][0] * T[0].w, T[0].top - raise, T[0].cx, railY + shoulderY);
    cur = { cx: T[0].cx, a1: s0.a1, a2: s0.a2 };
    lastCx = cur.cx;
    draw();
    mi = 0; t0 = null; startPose = null;
    raf = requestAnimationFrame(frame);
  }

  function ik(px, py, bx, by) {
    var dx = px - bx, dy = py - by, d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(L1 - L2) + 0.001, Math.min(L1 + L2 - 0.001, d));
    var cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    cos2 = Math.max(-1, Math.min(1, cos2));
    var q2 = Math.acos(cos2);
    var a1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    return { a1: a1, a2: a1 + q2 };
  }

  function easeIO(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, e) { return a + (b - a) * e; }

  function draw() {
    gCar.setAttribute("transform", "translate(" + cur.cx.toFixed(1) + "," + railY.toFixed(1) + ")");
    gShoulder.setAttribute("transform", "translate(0," + shoulderY.toFixed(1) + ") rotate(" + (cur.a1 * DEG).toFixed(2) + ")");
    gElbow.setAttribute("transform", "translate(" + L1.toFixed(1) + ",0) rotate(" + ((cur.a2 - cur.a1) * DEG).toFixed(2) + ")");

    // rollers spin with carriage travel
    if (rollerL) {
      rollDeg += ((cur.cx - lastCx) / rollR) * DEG;
      lastCx = cur.cx;
      var rt = "rotate(" + rollDeg.toFixed(1) + ")";
      rollerL.setAttribute("transform", rt);
      rollerR.setAttribute("transform", rt);
    }

    // energy cable droops from the left rail anchor to the carriage
    if (cable) {
      var x0 = railX0v + 5, x1 = cur.cx - cwv * 0.5 - 3;
      if (x1 < x0 + 8) x1 = x0 + 8;
      var droopY = railY + rhv + 8 + Math.min(24, (x1 - x0) * 0.09);
      cable.setAttribute("d",
        "M" + x0.toFixed(1) + " " + (railY + rhv * 0.9).toFixed(1) +
        " Q " + ((x0 + x1) / 2).toFixed(1) + " " + droopY.toFixed(1) +
        " " + x1.toFixed(1) + " " + (railY + rhv * 0.4).toFixed(1));
    }
  }

  // world position of the pen tip (forward kinematics)
  function penPos() {
    var bx = cur.cx, by = railY + shoulderY;
    var ex = bx + L1 * Math.cos(cur.a1), ey = by + L1 * Math.sin(cur.a1);
    return { x: ex + (L2 + penL) * Math.cos(cur.a2), y: ey + (L2 + penL) * Math.sin(cur.a2) };
  }

  // tiny fading sparks at the pen tip while it writes
  function spawnSpark() {
    if (sparkN > 26 || !document.body.animate) return;
    var p = penPos();
    var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("class", "spark");
    c.setAttribute("cx", p.x.toFixed(1));
    c.setAttribute("cy", p.y.toFixed(1));
    c.setAttribute("r", (1 + Math.random() * 1.3).toFixed(1));
    svg.appendChild(c);
    sparkN++;
    var dx = (Math.random() * 2 - 1) * 9, dy = -(4 + Math.random() * 10);
    var anim = c.animate(
      [{ opacity: 0.9, transform: "translate(0,0)" },
       { opacity: 0, transform: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)" }],
      { duration: 420 + Math.random() * 240, easing: "ease-out" }
    );
    anim.onfinish = function () { c.remove(); sparkN--; };
  }

  function frame(ts) {
    perfNow = ts;
    var m = moves[mi];
    if (t0 === null) { t0 = ts; startPose = { cx: cur.cx, a1: cur.a1, a2: cur.a2 }; if (m.onStart) m.onStart(); }
    var dur = m.dur != null ? m.dur :
      Math.max(110, Math.min(280, 80 + 140 * (Math.abs(startPose.a1 - m.a1) + Math.abs(startPose.a2 - m.a2)) + 0.2 * Math.abs(startPose.cx - m.cx)));
    var p = Math.min(1, (ts - t0) / dur);
    var e = easeIO(p);
    cur.cx = lerp(startPose.cx, m.cx, e);
    cur.a1 = lerp(startPose.a1, m.a1, e);
    cur.a2 = lerp(startPose.a2, m.a2, e);
    draw();

    // pen "energizes" while tracing a glyph; sparks fly off the tip
    if (m.pen !== penOn) {
      penOn = !!m.pen;
      svg.classList.toggle("is-writing", penOn);
    }
    if (penOn && !reducedM && (++fCount % 3 === 0)) spawnSpark();

    if (p >= 1) {
      if (m.onArrive) m.onArrive();
      mi++; t0 = null;
      if (mi >= moves.length) { finish(); return; }
    }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    // parked: reveal everything, keep the robot resting on the rail (no fade / no collapse)
    doneAll = true;
    clearTimeout(failsafe);
    for (var i = 0; i < chSpans.length; i++) revealCh(chSpans[i], chars[i]);
    svg.classList.remove("is-writing");
    cancel();
    // keep the writing headroom: the robot parks in its own band between the
    // kicker and the name, so nothing in the hero shifts after the write
    enterLiving();
  }

  /* ---- the parked robot comes alive ---- */
  function enterLiving() {
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    svg.classList.add("is-live");

    function track(e) {
      if (!eyeEl || !pupilWrap) return;
      var r = eyeEl.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy) || 1, m = Math.min(r.width * 0.18, d * 0.5);
      pupilWrap.style.transform = "translate(" + (dx / d * m).toFixed(1) + "px," + (dy / d * m).toFixed(1) + "px)";
    }
    window.addEventListener("mousemove", track, { passive: true });

    function blink() { if (pupil) pupil.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0.12)" }, { transform: "scaleY(1)" }], { duration: 200, easing: "ease-in-out" }); }
    if (!reduced) setInterval(function () { if (Math.random() < 0.7) blink(); }, 3800);

    var hellos = ["Beep boop!", "Hi there!", "At your service.", "Nice to meet you!"];
    if (gCar) gCar.addEventListener("click", function () { blink(); wave(); say(hellos[(Math.random() * hellos.length) | 0], 1900); });

    // gentle idle "breathing" while parked (paused during waves)
    if (!reduced) {
      var breathe = function (ts) {
        if (!waving && doneAll) {
          var s = ts * 0.0011;
          cur.a1 = parkA1 + Math.sin(s) * 0.018;
          cur.a2 = parkA2 + Math.sin(s + 1.3) * 0.028;
          draw();
        }
        requestAnimationFrame(breathe);
      };
      requestAnimationFrame(breathe);
    }

    // expose for other scripts (e.g. Konami) + greet on park
    window.__robotSay = say;
    window.__robotWave = wave;
    setTimeout(function () { say("Hello 👋", 3200); blink(); }, 700);
  }

  function say(text, dur) {
    if (!gCar) return;
    if (!bubble) { bubble = document.createElement("div"); bubble.className = "robot-bubble"; namewrap.appendChild(bubble); }
    bubble.textContent = text;
    var cr = gCar.getBoundingClientRect(), nr = namewrap.getBoundingClientRect();
    bubble.style.left = (cr.left - nr.left + cr.width * 0.5) + "px";
    bubble.style.top = (cr.top - nr.top - 10) + "px";
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, dur || 2600);
  }

  function wave() {
    // user-initiated, one-shot — play even under reduced-motion
    if (waving || !gShoulder) return;
    waving = true;
    var start = null, dur = 1150;
    function step(ts) {
      if (start === null) start = ts;
      var p = (ts - start) / dur;
      if (p >= 1) { cur.a1 = parkA1; cur.a2 = parkA2; draw(); waving = false; return; }
      cur.a1 = parkA1 - Math.sin(p * Math.PI) * 0.22;
      cur.a2 = parkA2 + Math.sin(p * Math.PI * 7) * 0.55 * (1 - p);
      draw();
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
})();
