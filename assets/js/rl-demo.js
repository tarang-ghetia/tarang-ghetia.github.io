/* =========================================================
   Interactive RL demo — 3D gridworld Q-learning
   Hand-rolled 3D (no Three.js). Zero dependencies, offline.
   A Q-learning agent trains live; tiles rise + colour by
   state-value; policy arrows show the greedy action; a robot
   marker rolls out the current best policy. Drag to orbit.
   ========================================================= */
(function () {
  "use strict";

  const canvas = document.getElementById("rlCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const elEpisodes = $("rlEpisodes");
  const elEpsilon  = $("rlEpsilon");
  const elSteps    = $("rlSteps");
  const elSuccess  = $("rlSuccess");
  const btnTrain   = $("rlTrain");
  const btnReset   = $("rlReset");
  const btnMaze    = $("rlMaze");

  /* ---------------- Environment ---------------- */
  const COLS = 7, ROWS = 7;
  const ACTIONS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // up,right,down,left
  const START = { r: 0, c: 0 };
  const GOAL  = { r: ROWS - 1, c: COLS - 1 };

  let grid;          // 0 = open, 1 = wall
  let Q;             // Float32Array [ROWS*COLS*4]
  let visited;       // Uint8 per cell (touched by learning)

  const idx = (r, c) => r * COLS + c;
  const isWall = (r, c) => r < 0 || c < 0 || r >= ROWS || c >= COLS || grid[idx(r, c)] === 1;

  function pathExists() {
    const seen = new Set([idx(START.r, START.c)]);
    const queue = [START];
    while (queue.length) {
      const { r, c } = queue.shift();
      if (r === GOAL.r && c === GOAL.c) return true;
      for (const [dr, dc] of ACTIONS) {
        const nr = r + dr, nc = c + dc;
        if (!isWall(nr, nc) && !seen.has(idx(nr, nc))) { seen.add(idx(nr, nc)); queue.push({ r: nr, c: nc }); }
      }
    }
    return false;
  }

  function newMaze() {
    do {
      grid = new Array(ROWS * COLS).fill(0);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if ((r === START.r && c === START.c) || (r === GOAL.r && c === GOAL.c)) continue;
          if (Math.random() < 0.24) grid[idx(r, c)] = 1;
        }
      }
    } while (!pathExists());
    resetLearning();
  }

  function resetLearning() {
    Q = new Float32Array(ROWS * COLS * 4);
    visited = new Uint8Array(ROWS * COLS);
    episodes = 0; epsilon = 1.0; lastSteps = 0; successRate = 0;
    celebrated = false;
    if (elSolved) elSolved.hidden = true;
    agent = { r: START.r, c: START.c };
    demo = { r: START.r, c: START.c, nr: START.r, nc: START.c, t: 1, wait: 0, steps: 0 };
  }

  /* ---------------- Q-learning ---------------- */
  const ALPHA = 0.5, GAMMA = 0.95, EPS_MIN = 0.05, EPS_DECAY = 0.992;
  let episodes = 0, epsilon = 1.0, lastSteps = 0, successRate = 0, stepInEp = 0;
  let celebrated = false;
  const elSolved = $("rlSolved");
  const canvasWrap = document.querySelector(".rl__canvas-wrap");
  let agent;   // training agent
  let demo;    // greedy rollout agent (for display)

  function bestAction(r, c) {
    const b = idx(r, c) * 4;
    let best = 0, bv = Q[b];
    for (let a = 1; a < 4; a++) if (Q[b + a] > bv) { bv = Q[b + a]; best = a; }
    return best;
  }
  function maxQ(r, c) {
    const b = idx(r, c) * 4;
    return Math.max(Q[b], Q[b + 1], Q[b + 2], Q[b + 3]);
  }
  // greedy action restricted to moves that don't hit a wall/edge
  function bestValidAction(r, c) {
    let best = -1, bv = -Infinity;
    for (let a = 0; a < 4; a++) {
      const [dr, dc] = ACTIONS[a];
      if (isWall(r + dr, c + dc)) continue;
      const v = Q[idx(r, c) * 4 + a];
      if (v > bv) { bv = v; best = a; }
    }
    return best < 0 ? bestAction(r, c) : best;
  }

  function trainStep() {
    const s = idx(agent.r, agent.c);
    let a;
    if (Math.random() < epsilon) a = (Math.random() * 4) | 0;
    else a = bestAction(agent.r, agent.c);

    const [dr, dc] = ACTIONS[a];
    let nr = agent.r + dr, nc = agent.c + dc;
    let reward = -0.02;                       // living cost
    if (isWall(nr, nc)) { nr = agent.r; nc = agent.c; reward = -0.08; } // bump wall
    const atGoal = (nr === GOAL.r && nc === GOAL.c);
    if (atGoal) reward = 1.0;

    visited[idx(nr, nc)] = 1;
    const sa = s * 4 + a;
    const target = reward + (atGoal ? 0 : GAMMA * maxQ(nr, nc));
    Q[sa] += ALPHA * (target - Q[sa]);

    agent.r = nr; agent.c = nc; stepInEp++;

    if (atGoal || stepInEp > 220) {
      episodes++;
      successRate = 0.9 * successRate + 0.1 * (atGoal ? 1 : 0);
      lastSteps = stepInEp;
      stepInEp = 0;
      epsilon = Math.max(EPS_MIN, epsilon * EPS_DECAY);
      agent.r = START.r; agent.c = START.c;
    }
  }

  /* ---------------- Greedy rollout (display robot) ---------------- */
  function respawnDemo(wait) {
    demo.wait = wait || 0; demo.steps = 0;
    demo.r = START.r; demo.c = START.c; demo.nr = START.r; demo.nc = START.c; demo.t = 1;
  }
  function advanceDemo(dt) {
    if (demo.wait > 0) { demo.wait -= dt; return; }
    demo.t += dt * 3.0;                          // hop speed
    if (demo.t >= 1) {
      demo.t = 0; demo.r = demo.nr; demo.c = demo.nc;
      if (demo.r === GOAL.r && demo.c === GOAL.c) { respawnDemo(0.8); return; } // reached goal
      if (++demo.steps > 70) { respawnDemo(0.5); return; }                      // stuck / too long
      const a = bestValidAction(demo.r, demo.c);   // never walk into a wall
      const [dr, dc] = ACTIONS[a];
      let nr = demo.r + dr, nc = demo.c + dc;
      if (isWall(nr, nc)) { nr = demo.r; nc = demo.c; }
      demo.nr = nr; demo.nc = nc;
    }
  }

  /* ---------------- 3D projection ---------------- */
  const S = 1, MAXH = 1.35;
  let yaw = 0.7, pitch = 0.92, zoom = 1;
  let W = 0, H = 0, dpr = 1;
  const dist = 10.2, targetY = 0.25;

  function project(x, y, z) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let x1 = x * cy - z * sy;
    let z1 = x * sy + z * cy;
    const yy = y - targetY;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let y2 = yy * cp - z1 * sp;
    let z2 = yy * sp + z1 * cp;
    let zc = z2 + dist;
    if (zc < 0.1) zc = 0.1;
    const scale = Math.min(W, H) * 0.92 * zoom;
    return { x: (x1 / zc) * scale + W / 2, y: (-y2 / zc) * scale + H / 2, depth: zc };
  }
  // grid (r,c) -> world center
  const wx = (c) => (c - (COLS - 1) / 2) * S;
  const wz = (r) => (r - (ROWS - 1) / 2) * S;

  /* ---------------- Colour ---------------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
  }
  // theme palettes for the 3D board
  const RLPAL = {
    dark: {
      low: [22, 35, 63], mid: [91, 140, 255], hi: [34, 211, 238],
      wall: [40, 46, 58], tileStroke: "rgba(255,255,255,0.10)", wallStroke: "rgba(255,255,255,0.05)",
      cube: [235, 245, 255], beam: "34,211,238", startLine: "rgba(91,140,255,0.9)",
      glowBase: "91,140,255", inkArrows: false,
    },
    light: {
      low: [223, 227, 236], mid: [232, 89, 12], hi: [176, 42, 2],
      wall: [197, 202, 213], tileStroke: "rgba(22,25,32,0.10)", wallStroke: "rgba(22,25,32,0.06)",
      cube: [30, 34, 44], beam: "14,116,144", startLine: "rgba(194,65,12,0.85)",
      glowBase: "194,65,12", inkArrows: true,
    },
  };
  const P = () => ((window.__isLight && window.__isLight()) ? RLPAL.light : RLPAL.dark);
  function heat(t) {
    const p = P();
    const c = t < 0.5 ? mix(p.low, p.mid, t * 2) : mix(p.mid, p.hi, (t - 0.5) * 2);
    return c;
  }
  const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a == null ? 1 : a})`;
  const shade = (c, f) => [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];

  /* ---------------- Render ---------------- */
  function valueNorm() {
    // normalise displayed values to [0,1] using current Q range
    let lo = Infinity, hi = -Infinity;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (grid[idx(r, c)] === 1) continue;
      const v = maxQ(r, c); if (v < lo) lo = v; if (v > hi) hi = v;
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-4) hi = lo + 1e-4;
    return { lo, hi };
  }

  function drawQuad(p, col, alpha, stroke) {
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath();
    ctx.fillStyle = rgb(col, alpha);
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function buildTiles(norm) {
    const tiles = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const wall = grid[idx(r, c)] === 1;
        const goal = (r === GOAL.r && c === GOAL.c);
        const start = (r === START.r && c === START.c);
        let t = 0, h = 0.06;
        if (!wall) {
          t = (maxQ(r, c) - norm.lo) / (norm.hi - norm.lo);
          t = Math.max(0, Math.min(1, t));
          h = 0.06 + t * MAXH * (visited[idx(r, c)] ? 1 : 0.15);
        }
        const x0 = wx(c) - S / 2 + 0.03, x1 = wx(c) + S / 2 - 0.03;
        const z0 = wz(r) - S / 2 + 0.03, z1 = wz(r) + S / 2 - 0.03;
        const top = [project(x0, h, z0), project(x1, h, z0), project(x1, h, z1), project(x0, h, z1)];
        const depth = (top[0].depth + top[2].depth) / 2;
        tiles.push({ r, c, wall, goal, start, t, h, x0, x1, z0, z1, top, depth });
      }
    }
    tiles.sort((a, b) => b.depth - a.depth); // far first (painter's)
    return tiles;
  }

  function drawArrow(tile) {
    if (tile.wall || tile.goal || !visited[idx(tile.r, tile.c)]) return;
    const a = bestValidAction(tile.r, tile.c);
    const [dr, dc] = ACTIONS[a];
    const cx = wx(tile.c), cz = wz(tile.r), hy = tile.h + 0.02;
    const len = 0.3;
    const tail = project(cx - dc * len, hy, cz - dr * len);
    const head = project(cx + dc * len, hy, cz + dr * len);
    const ink = (!P().inkArrows || tile.t > 0.45) ? "rgba(255,255,255,0.92)" : "rgba(25,28,34,0.7)"; // contrast vs tile colour
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
    // arrowhead
    const perp = project(cx + dc * (len - 0.14) - dr * 0.1, hy, cz + dr * (len - 0.14) - dc * 0.1);
    const perp2 = project(cx + dc * (len - 0.14) + dr * 0.1, hy, cz + dr * (len - 0.14) + dc * 0.1);
    ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(perp.x, perp.y); ctx.lineTo(perp2.x, perp2.y); ctx.closePath();
    ctx.fillStyle = ink; ctx.fill();
  }

  function drawCube(cx, cy, cz, size, col, emissive) {
    const s = size / 2;
    const v = [
      project(cx - s, cy - s, cz - s), project(cx + s, cy - s, cz - s),
      project(cx + s, cy - s, cz + s), project(cx - s, cy - s, cz + s),
      project(cx - s, cy + s, cz - s), project(cx + s, cy + s, cz - s),
      project(cx + s, cy + s, cz + s), project(cx - s, cy + s, cz + s),
    ];
    const faces = [
      { i: [4, 5, 6, 7], f: 1.0 },   // top
      { i: [0, 1, 5, 4], f: 0.7 },
      { i: [1, 2, 6, 5], f: 0.82 },
      { i: [2, 3, 7, 6], f: 0.6 },
      { i: [3, 0, 4, 7], f: 0.7 },
    ];
    faces.sort((a, b) => {
      const da = (v[a.i[0]].depth + v[a.i[2]].depth), db = (v[b.i[0]].depth + v[b.i[2]].depth);
      return db - da;
    });
    for (const face of faces) {
      drawQuad(face.i.map((k) => v[k]), shade(col, face.f), 1);
    }
    if (emissive) {
      const top = project(cx, cy + s, cz);
      const g = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, 26);
      g.addColorStop(0, "rgba(" + P().glowBase + ",0.4)"); g.addColorStop(1, "rgba(" + P().glowBase + ",0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(top.x, top.y, 26, 0, Math.PI * 2); ctx.fill();
    }
  }

  function render(time) {
    ctx.clearRect(0, 0, W, H);
    const norm = valueNorm();
    const tiles = buildTiles(norm);

    for (const tile of tiles) {
      const baseCol = tile.wall ? P().wall : heat(tile.t);
      // side walls (front/right visible enough via shading)
      const bTop = tile.top;
      const bBot = [
        project(tile.x0, 0, tile.z0), project(tile.x1, 0, tile.z0),
        project(tile.x1, 0, tile.z1), project(tile.x0, 0, tile.z1),
      ];
      // four sides
      const sides = [[0, 1], [1, 2], [2, 3], [3, 0]];
      const sideCol = shade(baseCol, tile.wall ? 0.6 : 0.5);
      // draw sides whose top edge is lower on screen than needed — just draw all, painter handled per-tile
      for (const [a, b] of sides) {
        drawQuad([bTop[a], bTop[b], bBot[b], bBot[a]], sideCol, tile.wall ? 0.9 : 0.95);
      }
      // top face
      drawQuad(bTop, baseCol, 1, tile.wall ? P().wallStroke : P().tileStroke);

      if (tile.goal) {
        drawQuad(bTop, P().hi, 0.9, "rgba(" + P().beam + ",0.9)");
        const beam = project(wx(tile.c), tile.h + 1.1, wz(tile.r));
        const bt = project(wx(tile.c), tile.h, wz(tile.r));
        const g = ctx.createLinearGradient(bt.x, bt.y, beam.x, beam.y);
        g.addColorStop(0, "rgba(" + P().beam + ",0.5)"); g.addColorStop(1, "rgba(" + P().beam + ",0)");
        ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bt.x, bt.y); ctx.lineTo(beam.x, beam.y); ctx.stroke();
      }
      if (tile.start) drawQuad(bTop, P().mid, 0.3, P().startLine);

      drawArrow(tile);
    }

    // robot (greedy demo agent) — interpolate hop with a little arc
    const dr = demo.r + (demo.nr - demo.r) * demo.t;
    const dc = demo.c + (demo.nc - demo.c) * demo.t;
    const hop = Math.sin(demo.t * Math.PI) * 0.28;
    const hCell = (r, c) => {
      if (grid[idx(Math.round(r), Math.round(c))] === 1) return 0.06;
      const rr = Math.max(0, Math.min(ROWS - 1, Math.round(r))), cc = Math.max(0, Math.min(COLS - 1, Math.round(c)));
      const t = Math.max(0, Math.min(1, (maxQ(rr, cc) - norm.lo) / (norm.hi - norm.lo)));
      return 0.06 + t * MAXH * (visited[idx(rr, cc)] ? 1 : 0.15);
    };
    const ry = Math.max(hCell(demo.r, demo.c), hCell(demo.nr, demo.nc)) + 0.22 + hop;
    drawCube(wx(dc), ry, wz(dr), 0.34, P().cube, true);
  }

  /* ---------------- Loop ---------------- */
  let running = false, raf = null, last = 0, inView = false, autoRotate = !prefersReduced;

  function loop(time) {
    if (!running) return;
    const dt = Math.min(0.05, (time - last) / 1000 || 0);
    last = time;
    if (autoRotate && !dragging) yaw += dt * 0.12;
    if (trainingOn) for (let i = 0; i < 28; i++) trainStep();
    advanceDemo(dt);
    render(time);
    updateHUD(time);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  let lastHUD = 0;
  function updateHUD(time) {
    if (time - lastHUD < 120) return; lastHUD = time;
    if (elEpisodes) elEpisodes.textContent = episodes;
    if (elEpsilon) elEpsilon.textContent = epsilon.toFixed(2);
    if (elSteps) elSteps.textContent = lastSteps || "—";
    if (elSuccess) elSuccess.textContent = Math.round(successRate * 100) + "%";

    if (!celebrated && episodes > 20 && successRate >= 0.85) {
      celebrated = true;
      if (elSolved) elSolved.hidden = false;
      if (canvasWrap && !prefersReduced) {
        canvasWrap.classList.add("celebrate");
        setTimeout(() => canvasWrap.classList.remove("celebrate"), 950);
      }
      if (window.__toast) window.__toast("Agent solved the maze");
    }
  }

  /* ---------------- Interaction ---------------- */
  let trainingOn = true, dragging = false, px = 0, py = 0;

  function setTrain(on) {
    trainingOn = on;
    if (btnTrain) {
      btnTrain.textContent = on ? "Pause training" : "Resume training";
      btnTrain.setAttribute("aria-pressed", String(on));
    }
    if (on) start();   // explicit user intent: run the live loop even under reduced-motion
  }
  if (btnTrain) btnTrain.addEventListener("click", () => setTrain(!trainingOn));
  if (btnReset) btnReset.addEventListener("click", () => { resetLearning(); setTrain(true); });
  if (btnMaze)  btnMaze.addEventListener("click", () => { newMaze(); setTrain(true); });

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; autoRotate = false; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - px) * 0.008;
    pitch = Math.max(0.35, Math.min(1.35, pitch + (e.clientY - py) * 0.006));
    px = e.clientX; py = e.clientY;
    if (!running) render(performance.now());
  });
  const endDrag = () => { dragging = false; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoom = Math.max(0.6, Math.min(1.8, zoom - e.deltaY * 0.0012));
    if (!running) render(performance.now());
  }, { passive: false });

  /* ---------------- Reduced motion: solve instantly, render static ---------------- */
  function solveStatic() {
    setTrain(false);
    for (let i = 0; i < 15000; i++) trainStep();
    epsilon = EPS_MIN;
    render(performance.now());
    updateHUD(performance.now() + 1000);
  }

  /* ---------------- Sizing ---------------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) render(performance.now());
  }
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });

  /* ---------------- Boot (lazy, on view) ---------------- */
  newMaze();
  canvas.style.cursor = "grab";
  resize();

  // Scroll-based visibility (robust; avoids IntersectionObserver timing quirks)
  function nearView() {
    const r = canvas.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * 0.9 && r.bottom > vh * 0.1;
  }
  function checkVis() {
    const vis = nearView();
    if (vis && !running) {
      if (prefersReduced) { if (!Q.some(Boolean)) solveStatic(); }
      else start();
    } else if (!vis && running) {
      stop();
    }
    inView = vis;
  }
  let visScheduled = false;
  const onVis = () => {
    if (visScheduled) return; visScheduled = true;
    window.requestAnimationFrame(() => { visScheduled = false; checkVis(); });
  };
  window.addEventListener("scroll", onVis, { passive: true });
  window.addEventListener("resize", onVis, { passive: true });
  window.addEventListener("load", checkVis);
  checkVis();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (inView && !prefersReduced) start();
  });
})();
