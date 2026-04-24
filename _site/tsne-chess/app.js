// ============================================================================
// t-SNE of a custom 5×5 board (knight-move adjacency graph)
// ============================================================================

// ---- Board setup ----

// 5×5 grid of labels, row 0 = top row
const BOARD_LABELS = [
  ['U','L','U','M','E'],
  ['F','A','C','A','P'],
  ['C','C','♞','I','N'],
  ['G','F','O','N','F'],
  ['K','O','P','I','O'],
];
const ROWS = 5, COLS = 5;

// Knight moves: all (±1,±2) and (±2,±1)
const KNIGHT_DELTAS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

function knightNeighbors(row, col) {
  const neighbors = [];
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const r = row + dr, c = col + dc;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) neighbors.push(r * COLS + c);
  }
  return neighbors;
}

// Build squares list and adjacency list
const N = ROWS * COLS;  // 25
const squares = [];   // {label, row, col, index}
const adjList = [];   // adjList[i] = array of neighbor flat-indices

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const idx = r * COLS + c;
    squares.push({ label: BOARD_LABELS[r][c], row: r, col: c, index: idx });
    adjList.push(knightNeighbors(r, c));
  }
}

// Collect undirected edges (for drawing)
const edges = [];
for (let i = 0; i < N; i++) {
  for (const j of adjList[i]) {
    if (j > i) edges.push([i, j]);
  }
}

// Compute BFS shortest-path distance between all pairs.
// Unconnected pairs (same-color squares unreachable by knight) get distance = N.
function bfsDistances(start) {
  const dist = new Array(N).fill(-1);
  dist[start] = 0;
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const nb of adjList[cur]) {
      if (dist[nb] === -1) {
        dist[nb] = dist[cur] + 1;
        queue.push(nb);
      }
    }
  }
  // Any square still -1 is unreachable; assign a large distance
  for (let i = 0; i < N; i++) { if (dist[i] === -1) dist[i] = N; }
  return dist;
}

// Build full N×N distance matrix
const distMatrix = [];
for (let i = 0; i < N; i++) distMatrix.push(bfsDistances(i));

// ---- DOM ----

const container     = document.getElementById('tsne-container');
const canvas        = document.getElementById('edge-canvas');
const ctx           = canvas.getContext('2d');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn      = document.getElementById('resetBtn');
const statusEl      = document.getElementById('status');
const showEdgesCb   = document.getElementById('showEdges');

// ---- Node DOM elements ----

const nodeEls = squares.map((sq, i) => {
  const el = document.createElement('div');
  el.className = 'sq-node';
  el.textContent = sq.label;
  el.dataset.index = i;
  container.appendChild(el);
  return el;
});

// ---- Color ----

// All nodes get the same neutral style; the knight square gets a special color
function refreshColors() {
  squares.forEach((sq, i) => {
    const isKnight = sq.label === '♞';
    nodeEls[i].style.backgroundColor = isKnight ? '#4a4a8a' : '#f0d9b5';
    nodeEls[i].style.color = isKnight ? '#fff' : '#333';
    nodeEls[i].style.fontSize = isKnight ? '18px' : '';
  });
}

// ---- t-SNE ----

let tsne      = null;
let animFrame = null;
let iteration = 0;
const MAX_ITER    = 500;
const STEPS_PER_FRAME = 3;  // run several steps per animation frame
let running   = false;
let positions = null;  // current normalized [0,1] positions

function seededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildTSNE() {
  tsne = new tsnejs.tSNE({
    dim: 2,
    perplexity: 6,   // must be well below N/3 = 8 for 25 nodes
    epsilon: 10,     // learning rate
  });

  // Use BFS graph distances as the pairwise distance matrix.
  // initDataDist expects a list-of-lists (symmetric).
  const rng = seededRandom(42);
  const origRand = Math.random;
  Math.random = rng;
  tsne.initDataDist(distMatrix);
  Math.random = origRand;

  iteration = 0;
  positions = null;
}

function getNormalizedPositions() {
  const sol = tsne.getSolution();  // array of [x, y] arrays
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of sol) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const pad = 0.07;
  const rx  = maxX - minX || 1;
  const ry  = maxY - minY || 1;
  return sol.map(p => ({
    x: pad + ((p[0] - minX) / rx) * (1 - 2 * pad),
    y: pad + ((p[1] - minY) / ry) * (1 - 2 * pad)
  }));
}

function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;
}

// ---- Edge-passage repulsion ----
// For display only: nudge nodes that lie close to edges they're not part of,
// pushing them perpendicularly away so they don't look falsely connected.

// Which edges is each node an endpoint of?
const nodeEdgeSet = Array.from({length: N}, () => new Set());
for (const [a, b] of edges) {
  nodeEdgeSet[a].add(b);
  nodeEdgeSet[b].add(a);
}

function applyEdgeRepulsion(pos) {
  const THRESHOLD = 0.06;  // fraction of canvas width/height; tune as needed
  const STRENGTH  = 0.8;   // how hard to push (fraction of threshold)

  // Work in a mutable copy so nudges don't compound within one frame
  const disp = pos.map(() => ({ dx: 0, dy: 0 }));

  for (const [a, b] of edges) {
    const ax = pos[a].x, ay = pos[a].y;
    const bx = pos[b].x, by = pos[b].y;
    const edx = bx - ax, edy = by - ay;
    const edLen2 = edx * edx + edy * edy;
    if (edLen2 < 1e-10) continue;

    for (let k = 0; k < N; k++) {
      if (k === a || k === b) continue;

      // Project k onto the segment a→b
      const kx = pos[k].x, ky = pos[k].y;
      const t = Math.max(0, Math.min(1, ((kx - ax) * edx + (ky - ay) * edy) / edLen2));

      // Closest point on segment to k
      const cx = ax + t * edx, cy = ay + t * edy;
      const perpx = kx - cx, perpy = ky - cy;
      const dist = Math.sqrt(perpx * perpx + perpy * perpy);

      if (dist < THRESHOLD && dist > 1e-6) {
        // Push k away from the edge, proportional to how close it is
        const push = STRENGTH * (THRESHOLD - dist) / dist;
        disp[k].dx += perpx * push;
        disp[k].dy += perpy * push;
      }
    }
  }

  return pos.map((p, i) => ({
    x: Math.max(0.02, Math.min(0.98, p.x + disp[i].dx)),
    y: Math.max(0.02, Math.min(0.98, p.y + disp[i].dy)),
  }));
}

function renderPositions(pos) {
  const displayPos = applyEdgeRepulsion(pos);

  // Update node positions
  for (let i = 0; i < N; i++) {
    nodeEls[i].style.left = (displayPos[i].x * 100) + '%';
    nodeEls[i].style.top  = (displayPos[i].y * 100) + '%';
  }

  // Draw edges on canvas (using display positions so edges follow nodes)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (showEdgesCb.checked) {
    ctx.strokeStyle = 'rgba(100,100,100,0.2)';
    ctx.lineWidth   = 1;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(displayPos[a].x * canvas.width,  displayPos[a].y * canvas.height);
      ctx.lineTo(displayPos[b].x * canvas.width,  displayPos[b].y * canvas.height);
      ctx.stroke();
    }
  }
}

// ---- Animation loop ----

function step() {
  if (!running) return;
  if (iteration >= MAX_ITER) {
    statusEl.textContent = `Converged after ${MAX_ITER} steps.`;
    startPauseBtn.textContent = 'start';
    running = false;
    return;
  }

  // Run several t-SNE steps per frame for visible progress
  const stepsThisFrame = Math.min(STEPS_PER_FRAME, MAX_ITER - iteration);
  for (let k = 0; k < stepsThisFrame; k++) {
    tsne.step();
  }
  iteration += stepsThisFrame;

  positions = getNormalizedPositions();
  renderPositions(positions);
  statusEl.textContent = `Step ${iteration} / ${MAX_ITER}`;

  animFrame = requestAnimationFrame(step);
}

// ---- Controls ----

function pause() {
  running = false;
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
}

function start() {
  if (iteration >= MAX_ITER) return;
  running = true;
  startPauseBtn.textContent = 'pause';
  animFrame = requestAnimationFrame(step);
}

function reset() {
  pause();
  buildTSNE();
  positions = getNormalizedPositions();
  renderPositions(positions);
  statusEl.textContent = 'Ready. Press start to run t-SNE.';
  startPauseBtn.textContent = 'start';
}

startPauseBtn.addEventListener('click', () => {
  if (running) {
    pause();
    startPauseBtn.textContent = 'start';
    statusEl.textContent = `Paused at step ${iteration} / ${MAX_ITER}.`;
  } else {
    start();
  }
});

resetBtn.addEventListener('click', reset);

showEdgesCb.addEventListener('change', () => {
  if (positions) renderPositions(positions);
});

window.addEventListener('resize', () => {
  resizeCanvas();
  if (positions) renderPositions(positions);
});

// ---- Init ----

resizeCanvas();
refreshColors();
buildTSNE();
positions = getNormalizedPositions();
renderPositions(positions);
statusEl.textContent = 'Ready. Press start to run t-SNE.';
