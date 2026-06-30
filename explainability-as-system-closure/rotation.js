// 3D rotation math for draggable canvas plots
// Ported from learningmechanics.pub/deep-linear-nets/ (qwem.js)

export function matVec(M, x, y, z) {
  return [
    M[0][0]*x + M[0][1]*y + M[0][2]*z,
    M[1][0]*x + M[1][1]*y + M[1][2]*z,
    M[2][0]*x + M[2][1]*y + M[2][2]*z,
  ];
}

export function matMul(A, B) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

export function axisRot(ax, ay, az, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1-c;
  return [
    [t*ax*ax+c,    t*ax*ay-s*az, t*ax*az+s*ay],
    [t*ay*ax+s*az, t*ay*ay+c,    t*ay*az-s*ax],
    [t*az*ax-s*ay, t*az*ay+s*ax, t*az*az+c   ],
  ];
}

// Gram-Schmidt orthonormalization of a 3×3 matrix
export function orthoMat(M) {
  const norm = v => { const l = Math.hypot(...v); return v.map(c => c/l); };
  const dot  = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const sub  = (a, b) => a.map((c, i) => c - b[i]);
  const mul  = (v, s) => v.map(c => c*s);
  const r0 = norm(M[0]);
  const r1 = norm(sub(M[1], mul(r0, dot(M[1], r0))));
  const r2 = norm(sub(sub(M[2], mul(r0, dot(M[2], r0))), mul(r1, dot(M[2], r1))));
  return [r0, r1, r2];
}

export function lerpMat(A, B, t) {
  return A.map((row, i) => row.map((v, j) => v*(1-t) + B[i][j]*t));
}

export function copyMat(M) { return M.map(r => r.slice()); }

// Attach drag-to-rotate + snap-back behavior to a canvas element.
// onRotate(rotM) is called every frame with the current rotation matrix.
export function attachDragRotate(canvas, getRotM, setRotM, defaultRotM, onRotate) {
  let dragging = false, dragX = 0, dragY = 0, snapRafId = null;

  canvas.addEventListener('pointerdown', e => {
    if (snapRafId) { cancelAnimationFrame(snapRafId); snapRafId = null; }
    dragging = true; dragX = e.clientX; dragY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragX, dy = e.clientY - dragY;
    dragX = e.clientX; dragY = e.clientY;
    const len = Math.hypot(dx, dy);
    if (len > 0.1) {
      setRotM(matMul(axisRot(-dy/len, dx/len, 0, len * 0.010), getRotM()));
      onRotate();
    }
  });

  canvas.addEventListener('pointerup', e => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = 'grab';
    const startRot = copyMat(getRotM());
    const target   = copyMat(defaultRotM);
    const t0 = performance.now(), DUR = 600;
    function snap(ts) {
      const p = Math.min((ts - t0) / DUR, 1), ease = 1 - Math.pow(1-p, 3);
      setRotM(orthoMat(lerpMat(startRot, target, ease)));
      onRotate();
      if (p < 1) snapRafId = requestAnimationFrame(snap);
      else snapRafId = null;
    }
    snapRafId = requestAnimationFrame(snap);
  });
}
