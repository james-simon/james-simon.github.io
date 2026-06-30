// Lorenz system simulation
// σ=10, ρ=28, β=8/3, dt=0.005

const SIGMA = 10, RHO = 28, BETA = 8/3, DT = 0.005;

export function lorenzTraj(x, y, z, steps) {
  const xs = new Float32Array(steps);
  const ys = new Float32Array(steps);
  const zs = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const dx = SIGMA*(y-x), dy = x*(RHO-z)-y, dz = x*y-BETA*z;
    x += dx*DT; y += dy*DT; z += dz*DT;
    xs[i] = x; ys[i] = y; zs[i] = z;
  }
  return { xs, ys, zs };
}

// Warm up from a seed point onto the attractor, then run TOTAL steps.
// Returns { refTraj, x0, y0, z0, e1, e2, particles }
export function buildScene() {
  const WARMUP = 5000, TOTAL = 100000;
  const START_STEP = 1000, END_STEP = 10000;
  const GRID = 10, GRID_EPS = 1.0;
  const X0_IDX = 1000; // index into refTraj where x0 sits

  // Warm up
  let wx = 0.1, wy = 0, wz = 0;
  for (let i = 0; i < WARMUP; i++) {
    const dx = SIGMA*(wy-wx), dy = wx*(RHO-wz)-wy, dz = wx*wy-BETA*wz;
    wx += dx*DT; wy += dy*DT; wz += dz*DT;
  }
  const refTraj = lorenzTraj(wx, wy, wz, TOTAL);

  const x0 = refTraj.xs[X0_IDX], y0 = refTraj.ys[X0_IDX], z0 = refTraj.zs[X0_IDX];

  // e1: local flow direction (finite difference)
  const FLOW_WIN = 5;
  const e1 = normalize([
    refTraj.xs[X0_IDX+FLOW_WIN] - refTraj.xs[X0_IDX-FLOW_WIN],
    refTraj.ys[X0_IDX+FLOW_WIN] - refTraj.ys[X0_IDX-FLOW_WIN],
    refTraj.zs[X0_IDX+FLOW_WIN] - refTraj.zs[X0_IDX-FLOW_WIN],
  ]);

  // e2: PCA spread direction of nearby trajectory points, orthogonal to e1
  const nearPts = [];
  for (let i = START_STEP; i < END_STEP; i++) {
    const dx = refTraj.xs[i]-x0, dy = refTraj.ys[i]-y0, dz = refTraj.zs[i]-z0;
    if (Math.hypot(dx, dy, dz) < GRID_EPS * 3) nearPts.push([dx, dy, dz]);
  }
  const pcaPts = nearPts.length > 10 ? nearPts : (() => {
    const pts = [];
    for (let i = 980; i <= 1020; i++)
      pts.push([refTraj.xs[i]-x0, refTraj.ys[i]-y0, refTraj.zs[i]-z0]);
    return pts;
  })();

  const cov = [[0,0,0],[0,0,0],[0,0,0]];
  for (const p of pcaPts) {
    const d = dot3(p, e1);
    const q = p.map((c, i) => c - d*e1[i]);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cov[a][b] += q[a]*q[b];
  }
  const covMul = v => [
    cov[0][0]*v[0]+cov[0][1]*v[1]+cov[0][2]*v[2],
    cov[1][0]*v[0]+cov[1][1]*v[1]+cov[1][2]*v[2],
    cov[2][0]*v[0]+cov[2][1]*v[1]+cov[2][2]*v[2],
  ];
  let e2 = normalize([0.3, 0.7, -0.5]);
  for (let i = 0; i < 80; i++) {
    let v = covMul(e2);
    const d = dot3(v, e1); v = v.map((c, k) => c - d*e1[k]);
    e2 = normalize(v);
  }

  // 10×10 grid in e1-e2 plane; hue from spread axis, lightness from flow axis
  const particles = [];
  for (let gi = 0; gi < GRID; gi++) {
    for (let gj = 0; gj < GRID; gj++) {
      const fu = gi/(GRID-1) - 0.5, fv = gj/(GRID-1) - 0.5;
      const px = x0 + fu*2*GRID_EPS*e1[0] + fv*2*GRID_EPS*e2[0];
      const py = y0 + fu*2*GRID_EPS*e1[1] + fv*2*GRID_EPS*e2[1];
      const pz = z0 + fu*2*GRID_EPS*e1[2] + fv*2*GRID_EPS*e2[2];
      const hue  = Math.round((gj/(GRID-1)) * 300);
      const lite = Math.round(20 + (gi/(GRID-1)) * 60);
      const color = `hsl(${hue},75%,${lite}%)`;
      const traj = lorenzTraj(px, py, pz, TOTAL);
      particles.push({ traj, color });
    }
  }

  return { refTraj, x0, y0, z0, e1, e2, particles, TOTAL, START_STEP, END_STEP, X0_IDX };
}

function normalize(v) { const l = Math.hypot(...v); return v.map(c => c/l); }
function dot3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
