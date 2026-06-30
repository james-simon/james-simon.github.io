// Lorenz attractor visualization — panel A
// Depends on lorenz.js and rotation.js

import { buildScene } from './lorenz.js';
import { matVec, matMul, axisRot, orthoMat, lerpMat, copyMat, attachDragRotate } from './rotation.js';

const STEPS_PER_SEC = 50;
const T_MAX = 1000;
const ATTRACTOR_CENTER_Z = 27;
const SCALE_DENOM = 68;
const DOT_R = 3.5;

// ── Waypoints ─────────────────────────────────────────────────────────────────
const WAYPOINTS = [
  { t:   0, color: '#e03030', arrow: false, text: `This is an interactive visualization of the Lorenz system, a famous chaotic differential equation with a butterfly-shaped attractor set. Because it's chaotic, you can make a pretty good mental model of the forward dynamics for short times, but as the time grows, it becomes impossible. The point here is that sufficiently complex systems need not admit human-interpretable "explanations."\n\nPress play to step forward through the dynamics, and try to intuitively track the flow of the colored dots. Try to construct a good enough mental model that you could answer the type of questions people ask in explainable AI: for example, how do perturbations to the input x₀ affect the position of xₜ?` },
  { t:  60, color: '#e07820', arrow: true,  text: `After a modest time, the dynamics have taken the dots one half-revolution around the left lobe of the attractor. It's not hard to visualize their collective movement, which is simple enough to hold in your head and answer perturbation-type questions purely from visual intuition.` },
  { t: 200, color: '#2a9a2a', arrow: true,  text: `After a longer time, the dots have moved three half-revolutions around the left lobe. The dots' dynamics remain possible to simulate intuitively, though you have to stare at the system for a while before you get an intuitive feel for the stretching of the initial square into an elongated shape.` },
  { t: 300, color: '#2060cc', arrow: false, text: `The initial square has now become spread over the two different lobes. By this time, it has become difficult to track the flow of the initial square purely with visual intuition, and it would be very difficult indeed to develop an intuitive sense for the entire forward map over the entire attractor set at this time.` },
  { t: 800, color: '#8030b0', arrow: false, text: `The chaotic dynamics have scattered the initial points around the butterfly attractor. I doubt any human can hold the initial square's forward map up to this point in their head, let alone the forward map for the whole attractor. Human-interpretable "explanations" of the type desired by explainable AI efforts are impossible.` },
];
// Which waypoints have already been triggered this playthrough
const triggeredWaypoints = new Set();
let activeWaypoint = null; // currently displayed waypoint

// ── Build simulation data ─────────────────────────────────────────────────────
const { refTraj, particles, START_STEP, END_STEP, X0_IDX } = buildScene();
const OFFSET = X0_IDX;

// ── Rotation state ────────────────────────────────────────────────────────────
const DEFAULT_ROT = orthoMat([[0.8,0.5,0.2],[-0.1,0.3,0.9],[0.6,-0.8,0.1]]);
let rotM = copyMat(DEFAULT_ROT);

// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('lorenz-canvas-A');
const ctx    = canvas.getContext('2d');
let W, H, dpr;

function resize() {
  dpr = devicePixelRatio || 1;
  W = canvas.offsetWidth; H = canvas.offsetHeight;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
setTimeout(resize, 0);

// ── Tick canvas ───────────────────────────────────────────────────────────────
const tickCanvas = document.getElementById('lorenz-tick-canvas');
const tickCtx    = tickCanvas.getContext('2d');

// Measure thumb center at t=0 and t=T_MAX by temporarily moving the real
// slider to each extreme and reading getBoundingClientRect().
// We save and restore the original value so the user sees nothing.
function measureTrackBounds() {
  const wrap = document.getElementById('lorenz-slider-wrap');
  const wrapRect = wrap.getBoundingClientRect();
  const thumbRadius = slider.offsetHeight / 2;
  const sliderLeft = slider.getBoundingClientRect().left - wrapRect.left;
  const x0 = sliderLeft + thumbRadius;
  const x1 = sliderLeft + slider.offsetWidth - thumbRadius;
  return { x0, x1 };
}

function drawTicks() {
  const dpr = devicePixelRatio || 1;
  const W = tickCanvas.offsetWidth, H = 16;
  tickCanvas.width = W * dpr; tickCanvas.height = H * dpr;
  tickCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tickCtx.clearRect(0, 0, W, H);

  const { x0, x1 } = measureTrackBounds();
  const toPx = t => x0 + (t / T_MAX) * (x1 - x0);

  tickCtx.font = '9px system-ui,sans-serif';
  tickCtx.textAlign = 'center'; tickCtx.textBaseline = 'top';

  // Regular axis ticks
  for (let t = 0; t <= T_MAX; t += 200) {
    const px = toPx(t);
    tickCtx.strokeStyle = '#aaa'; tickCtx.lineWidth = 1;
    tickCtx.beginPath(); tickCtx.moveTo(px, 0); tickCtx.lineTo(px, 5); tickCtx.stroke();
    tickCtx.fillStyle = '#aaa';
    tickCtx.fillText(String(t), px, 6);
  }
  for (let t = 100; t < T_MAX; t += 200) {
    const px = toPx(t);
    tickCtx.strokeStyle = '#ccc'; tickCtx.lineWidth = 1;
    tickCtx.beginPath(); tickCtx.moveTo(px, 0); tickCtx.lineTo(px, 3); tickCtx.stroke();
  }

}

const markerCanvas = document.getElementById('lorenz-marker-canvas');
const markerCtx = markerCanvas.getContext('2d');

function positionWaypointMarkers() {
  const { x0, x1 } = measureTrackBounds();
  const dpr = devicePixelRatio || 1;
  const W = slider.offsetWidth;
  const H = slider.offsetHeight;
  markerCanvas.width = W * dpr; markerCanvas.height = H * dpr;
  markerCanvas.style.height = H + 'px';
  markerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  markerCtx.clearRect(0, 0, W, H);

  const barH = H / 2;
  const top = H / 2 - barH / 2;

  for (const wp of WAYPOINTS) {
    const px = x0 + (wp.t / T_MAX) * (x1 - x0);
    markerCtx.fillStyle = wp.color;
    markerCtx.fillRect(px - 1.5, top, 3, barH);
  }
}

// ── Waypoint overlay div ──────────────────────────────────────────────────────
const wpOverlay = document.getElementById('lorenz-wp-text');

function showWaypoint(wp) {
  activeWaypoint = wp;
  if (wpOverlay) {
    wpOverlay.innerText = wp.text;
    wpOverlay.style.color = wp.color;
    wpOverlay.style.borderColor = wp.color;
    wpOverlay.style.display = 'block';
  }
}

function hideWaypoint() {
  activeWaypoint = null;
  if (wpOverlay) wpOverlay.style.display = 'none';
}

// ── Controls ──────────────────────────────────────────────────────────────────
const slider   = document.getElementById('lorenz-slider-A');
const btn      = document.getElementById('lorenz-btn-A');
const resetBtn = document.getElementById('lorenz-reset-A');
const tValue   = document.getElementById('lorenz-t-value');

const SVG_PLAY  = `<svg width="20" height="20" viewBox="0 0 20 20" fill="#444"><polygon points="4,2 18,10 4,18"/></svg>`;
const SVG_PAUSE = `<svg width="20" height="20" viewBox="0 0 20 20" fill="#444"><rect x="3" y="2" width="5" height="16" rx="1"/><rect x="12" y="2" width="5" height="16" rx="1"/></svg>`;
btn.innerHTML = SVG_PLAY;

let animPlaying = false, simT = 0, lastTs = null, rafId = null;

function syncSlider() {
  slider.value = simT;
  if (tValue) tValue.textContent = Math.floor(simT);
}

function setPlaying(v) {
  animPlaying = v;
  btn.innerHTML = v ? SVG_PAUSE : SVG_PLAY;
  if (v) { lastTs = null; rafId = requestAnimationFrame(animLoop); }
  else if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function resetAnim() {
  setPlaying(false);
  simT = 0;
  triggeredWaypoints.clear();
  triggeredWaypoints.add(0);
  syncSlider();
  draw();
  showWaypoint(WAYPOINTS[0]);
}

btn.addEventListener('click', () => {
  if (animPlaying) {
    setPlaying(false);
  } else {
    // Resuming — hide any waypoint overlay and mark it consumed
    hideWaypoint();
    setPlaying(true);
  }
});
resetBtn.addEventListener('click', resetAnim);

// Dragging the slider manually: pause and don't trigger waypoints
slider.addEventListener('pointerdown', () => { if (animPlaying) setPlaying(false); });
slider.addEventListener('input', () => {
  simT = +slider.value;
  // Un-trigger any waypoints ahead of the current position
  for (const wp of WAYPOINTS) {
    if (wp.t > simT) triggeredWaypoints.delete(wp.t);
  }
  hideWaypoint();
  syncSlider();
  draw();
});

function animLoop(ts) {
  if (!animPlaying) return;
  if (lastTs !== null) {
    const prevT = simT;
    simT = Math.min(T_MAX, simT + STEPS_PER_SEC * (ts - lastTs) / 1000);

    // Check if we passed through any untriggered waypoint
    for (const wp of WAYPOINTS) {
      if (!triggeredWaypoints.has(wp.t) && prevT < wp.t && simT >= wp.t) {
        simT = wp.t;
        triggeredWaypoints.add(wp.t);
        syncSlider();
        setPlaying(false);
        showWaypoint(wp);
        draw();
        return;
      }
    }

    if (simT >= T_MAX) { simT = T_MAX; setPlaying(false); }
    syncSlider();
  }
  lastTs = ts;
  draw();
  rafId = requestAnimationFrame(animLoop);
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function proj(x, y, z) {
  const s = Math.min(W, H) / SCALE_DENOM;
  const [rx, ry] = matVec(rotM, x, y, z - ATTRACTOR_CENTER_Z);
  return [W/2 + rx*s, H/2 - ry*s];
}

function draw() {
  if (!W || !H) { resize(); if (!W || !H) return; }
  ctx.clearRect(0, 0, W, H);

  // Axes
  const s = Math.min(W, H) / SCALE_DENOM, axL = 28;
  ctx.font = '11px system-ui,sans-serif'; ctx.textBaseline = 'middle';
  [{ v:[axL,0,0], l:'x' }, { v:[0,axL,0], l:'y' }, { v:[0,0,axL], l:'z' }].forEach(({ v, l }) => {
    const [px, py] = matVec(rotM, v[0], v[1], v[2]);
    const [nx, ny] = matVec(rotM, -v[0], -v[1], -v[2]);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W/2 + nx*s, H/2 - ny*s);
    ctx.lineTo(W/2 + px*s, H/2 - py*s);
    ctx.stroke();
    ctx.fillStyle = '#bbb';
    ctx.fillText(l, W/2 + px*s + 4, H/2 - py*s);
  });

  // Reference flow lines
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); let first = true;
  for (let i = START_STEP; i < END_STEP; i++) {
    const [sx, sy] = proj(refTraj.xs[i], refTraj.ys[i], refTraj.zs[i]);
    if (first) { ctx.moveTo(sx, sy); first = false; } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Particles — depth-sorted back to front
  const pi = Math.floor(simT);
  const pts = particles.map(p => {
    const xi = p.traj.xs[pi], yi = p.traj.ys[pi], zi = p.traj.zs[pi];
    const [sx, sy] = proj(xi, yi, zi);
    const [,, rz] = matVec(rotM, xi, yi, zi - ATTRACTOR_CENTER_Z);
    return { sx, sy, rz, color: p.color };
  });
  pts.sort((a, b) => a.rz - b.rz);

  const rzMin = pts[0].rz, rzMax = pts[pts.length-1].rz, rzRange = Math.max(rzMax - rzMin, 1);
  for (const { sx, sy, rz, color } of pts) {
    const depthT = (rz - rzMin) / rzRange;
    const r = DOT_R * (0.7 + 0.3 * depthT);
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2*Math.PI);
    ctx.fillStyle = color; ctx.fill();
  }

  // Draw trajectory arrow for waypoints that request it
  if (activeWaypoint && activeWaypoint.arrow) {
    drawTrajectoryArrow(activeWaypoint.t, activeWaypoint.color);
  }
}

function drawTrajectoryArrow(wpT, color) {
  // Draw the x0 trajectory from step 0 to step wpT-10 as a thick colored path
  const lineWidth = 10.5;
  const headLen = 28;  // length of arrowhead
  const headWidth = 0.5; // half-angle in radians
  const endStep = Math.max(0, wpT - 5);
  const stride = Math.max(1, Math.floor(endStep / 300));

  // Work in 3D. Tip = position at endStep (centered).
  const sc = Math.min(W, H) / SCALE_DENOM;
  const tip3 = [refTraj.xs[OFFSET+endStep], refTraj.ys[OFFSET+endStep], refTraj.zs[OFFSET+endStep]-ATTRACTOR_CENTER_Z];
  const [tipX, tipY] = proj(refTraj.xs[OFFSET+endStep], refTraj.ys[OFFSET+endStep], refTraj.zs[OFFSET+endStep]);

  // 3D velocity direction: finite difference
  const back = Math.min(8, endStep);
  const p0 = [refTraj.xs[OFFSET+endStep-back], refTraj.ys[OFFSET+endStep-back], refTraj.zs[OFFSET+endStep-back]-ATTRACTOR_CENTER_Z];
  let dir3 = tip3.map((v,i) => v - p0[i]);
  const dlen = Math.hypot(...dir3);
  if (dlen < 1e-6) { ctx.restore(); return; }
  dir3 = dir3.map(v => v/dlen);

  // Build two vectors perpendicular to dir3 in 3D (for the base circle)
  const up = Math.abs(dir3[2]) < 0.9 ? [0,0,1] : [0,1,0];
  let perp1 = [
    up[1]*dir3[2]-up[2]*dir3[1],
    up[2]*dir3[0]-up[0]*dir3[2],
    up[0]*dir3[1]-up[1]*dir3[0],
  ];
  const p1len = Math.hypot(...perp1); perp1 = perp1.map(v=>v/p1len);
  let perp2 = [
    dir3[1]*perp1[2]-dir3[2]*perp1[1],
    dir3[2]*perp1[0]-dir3[0]*perp1[2],
    dir3[0]*perp1[1]-dir3[1]*perp1[0],
  ];

  // Cone dimensions in world units
  const headLen3D = headLen / sc;   // convert screen pixels → world units
  const headRad3D = lineWidth / sc; // base radius matches line half-width

  // Base center in 3D
  const base3 = tip3.map((v,i) => v - dir3[i]*headLen3D);

  // Project base circle (N points) to screen
  const N = 24;
  const baseRing = [];
  for (let k = 0; k < N; k++) {
    const a = (k/N)*2*Math.PI;
    const pt3 = base3.map((v,i) => v + perp1[i]*headRad3D*Math.cos(a) + perp2[i]*headRad3D*Math.sin(a));
    // proj() takes world coords (un-centered z), so add back ATTRACTOR_CENTER_Z
    const [rx,ry] = matVec(rotM, pt3[0], pt3[1], pt3[2]);
    baseRing.push([W/2+rx*sc, H/2-ry*sc]);
  }

  // Base center projected
  const [baseCX, baseCY] = (() => { const [rx,ry]=matVec(rotM,base3[0],base3[1],base3[2]); return [W/2+rx*sc,H/2-ry*sc]; })();

  ctx.save();
  ctx.globalAlpha = 0.82;

  // Draw line from step 0 up to baseX/baseY (stopping before the arrowhead tip)
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let first = true;
  const stopStep = Math.max(0, endStep - 4);
  for (let i = 0; i <= stopStep; i += stride) {
    const [sx, sy] = proj(refTraj.xs[OFFSET + i], refTraj.ys[OFFSET + i], refTraj.zs[OFFSET + i]);
    if (first) { ctx.moveTo(sx, sy); first = false; } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Draw cone: filled base disk + triangular faces from each ring segment to tip
  ctx.fillStyle = color;

  // Base disk
  ctx.beginPath();
  ctx.moveTo(baseRing[0][0], baseRing[0][1]);
  for (let k = 1; k < N; k++) ctx.lineTo(baseRing[k][0], baseRing[k][1]);
  ctx.closePath();
  ctx.fill();

  // Cone mantle: triangle strips from ring to tip
  for (let k = 0; k < N; k++) {
    const a = baseRing[k], b = baseRing[(k+1)%N];
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ── Drag + snap back ──────────────────────────────────────────────────────────
attachDragRotate(
  canvas,
  () => rotM,
  m  => { rotM = m; },
  DEFAULT_ROT,
  draw,
);

setTimeout(() => { drawTicks(); positionWaypointMarkers(); syncSlider(); draw(); triggeredWaypoints.add(0); showWaypoint(WAYPOINTS[0]); }, 200);
window.addEventListener('resize', () => { resize(); drawTicks(); positionWaypointMarkers(); draw(); });
