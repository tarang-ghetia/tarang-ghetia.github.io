# Design Reference — Tarang Ghetia Portfolio

A quick spec of everything used to build this site. Nothing here needs a build
step or a package manager — it's plain HTML / CSS / JS.

---

## Fonts (Google Fonts)

Loaded via one `<link>` in `index.html` with `display=swap` (no invisible-text flash).

| Role | Font | Weights used | Character |
|------|------|--------------|-----------|
| Display / headings | **Times New Roman** (system serif — no webfont needed) | 500, 600 | Classic, academic, zero load time |
| Body / paragraphs | **IBM Plex Sans** | 400, 500, 600 | Engineering heritage, highly readable |
| Mono / labels, numbers, tags | **IBM Plex Mono** | 400, 500 | Technical micro-labels & metrics |

Import URL (already in the `<head>`):
```
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap
```
> Fonts need internet on first load, then the browser caches them. Everything else works offline.

---

## Colour palette — dual theme (toggle in nav, persisted via localStorage)

**Dark (default):** near-black lab — bg `#0a0b0e`, text `#eef1f6`, accent electric blue `#5b8cff` + cyan `#22d3ee`.

**Light** (values below): paper & ink with a poppy burnt-orange accent.

Defined once as CSS variables in `assets/css/styles.css` (`:root`).

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#f6f7f9` | Page background (cool paper) |
| `--bg-2` | `#eef0f4` | Alternate section band |
| `--surface` | `#ffffff` | Cards / panels |
| `--surface-2` | `#fafbfc` | Card hover |
| `--text` | `#191c22` | Primary text (ink) |
| `--text-2` | `#474d58` | Secondary text |
| `--text-3` | `#6b727e` | Muted / meta (AA) |
| `--accent` | `#c2410c` | Burnt orange — primary accent / CTAs (light) |
| `--accent-2` | `#0e7490` | Deep teal — highlights, canvas |
| `--ok` | `#0f7a4d` | "Published" / status green |
| `--pending` | `#92600a` | "Under review" amber |
| `--border` | `rgba(22,25,32,.09)` | Hairline borders |

Contrast: all text tokens meet WCAG AA (4.5:1) on the paper surfaces.

---

## Type scale & spacing

- **Type:** fluid `clamp()` sizing — headings scale from ~1.9rem (mobile) to ~4.7rem (hero, desktop). Body base is 16px, line-height 1.65.
- **Spacing:** 4/8px rhythm — `--sp-1: 4px` … `--sp-9: 96px`.
- **Radius:** `14px` cards, `22px` large surfaces. **Container:** max 1180px.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) used everywhere for a consistent feel.

---

## Icons

- **Custom inline SVG only** — no icon library, no emoji.
- The robot mark (nav + favicon), GitHub glyphs, arrows, and mail/download icons are all hand-written `<svg>` paths, stroke-width 1.6–1.8, so they scale crisply and theme with `currentColor`.

---

## Animation & interactivity (vanilla JS — `assets/js/main.js`)

No libraries. Built from scratch:

| Feature | How |
|---------|-----|
| Hero name robot | A gantry robot (rail + carriage + IK pen-arm, `assets/js/name-arm.js`) writes "Tarang Ghetia." glyph by glyph — each letter fades in cleanly under the pen (no ink overlay) — then parks at 45° past the name and stays: eye tracks the cursor, blinks, waves + speaks (speech bubble) on click. Graphite SVG, zero deps. |
| Hero background | HTML `<canvas>` flow-field — particles advected through a noise field (evokes RL policy dynamics). DPR-aware, particle count scales to screen size, pauses off-screen / when tab hidden. |
| Scroll reveals | `IntersectionObserver` fades/slides sections in on entry. |
| Count-up stats | `requestAnimationFrame` easing (easeOutCubic). |
| Publication filter | Journal / Conference / Under-review tabs. |
| Scroll-spy nav | Highlights the current section link. |
| Scroll progress bar | Thin gradient bar at the top. |
| Project spotlight | Pointer-tracked radial glow on hover (desktop only). |
| Marquee | JS-driven (rAF) seamless scroll of focus areas — runs regardless of motion settings (owner choice). |
| **Interactive RL demo** | Hand-rolled 3D gridworld (`assets/js/rl-demo.js`) — a Q-learning agent trains live; tiles rise/colour by state-value, arrows show the policy, a robot rolls out the best path. Custom perspective projection + painter's-algorithm rendering on `<canvas>` (no Three.js). Drag to orbit, scroll to zoom. Lazy-mounted on scroll, pauses off-screen. |

**Accessibility:** every animation respects `prefers-reduced-motion` — the canvas, marquee, reveals, counters and pulsing dot all disable automatically. Keyboard focus rings, skip-link, and aria labels are in place.

---

## Language

- Site language: **English** (`lang="en"`, first-person, conversational register, English number formats: `97.04%`, `18,000+`).

## Tech stack

- **Plain HTML5 + CSS3 + vanilla JavaScript.** No framework, no bundler, no dependencies.
- **Hosting:** open `index.html` directly, or drop the folder on GitHub Pages / Netlify / Vercel.

---

## File map

```
Website/
├─ index.html                 # markup + content
├─ CV_Tarang_12052026.pdf      # linked by the Résumé buttons
├─ DESIGN.md                   # this file
└─ assets/
   ├─ css/styles.css           # all styling + design tokens
   ├─ js/main.js               # all interactivity
   ├─ favicon.svg              # browser-tab icon
   └─ og-image.svg             # social-share preview card
```

---

## Links

- GitHub: https://github.com/tarang-ghetia · LinkedIn: linkedin.com/in/tarang-ghetia-7703731a8
- Project cards link to their real repos: Object-Tracking, Image-Colorization-Using-GAN,
  Mathematical-Expression-Localization-in-Handwritten-Document, Game-Theory-Based-Stock-Price-Prediction.
