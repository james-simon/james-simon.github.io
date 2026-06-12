// ============================================================================
// UI — slider wiring + toggle groups
// ============================================================================

const SLIDER_CFGS = {
  din: {
    snaps: [2,3,4,5,6,7,8,10,12,15,20,30],
    fmt: v => String(v),
  },
  dh: {
    snaps: [2,3,4,5,6,8,10,12,15,20,30,50],
    fmt: v => String(v),
  },
  dout: {
    snaps: [1,2,3,5],
    fmt: v => String(v),
  },
  nSamples: {
    snaps: [10,20,50,100,200,500,1000,2000,5000,10000],
    fmt: v => v.toLocaleString(),
  },
  maxStepsPerSec: {
    snaps: [10,20,50,100,200,500,1000,2000,5000,Infinity],
    fmt: v => isFinite(v) ? v.toLocaleString() : 'no limit',
  },
  emaWindow: {
    snaps: [1,2,5,10,20,50,100,200,500,1000],
    fmt: v => v === 1 ? 'none' : String(v),
  },
};

function snapToT(v, snaps) {
  const i = snaps.indexOf(v);
  return i < 0 ? 50 : i / (snaps.length - 1) * 100;
}
function tToSnap(t, snaps) {
  const i = Math.round(t / 100 * (snaps.length - 1));
  return snaps[Math.max(0, Math.min(snaps.length - 1, i))];
}

export function bindUI(state, callbacks) {
  // Sliders
  for (const [key, cfg] of Object.entries(SLIDER_CFGS)) {
    const slider = document.getElementById(`slider_${key}`);
    const valEl  = document.getElementById(`value_${key}`);
    if (!slider || !valEl) continue;

    slider.value       = snapToT(state[key], cfg.snaps);
    valEl.textContent  = cfg.fmt(state[key]);

    slider.addEventListener('input', () => {
      state[key] = tToSnap(Number(slider.value), cfg.snaps);
      valEl.textContent = cfg.fmt(state[key]);
      if (callbacks.onParamChange) callbacks.onParamChange(key);
    });
    slider.addEventListener('change', () => {
      slider.value = snapToT(state[key], cfg.snaps);
    });
  }

  // Toggle groups
  for (const [groupId, stateKey] of [['actGroup','act'],['xDistGroup','xDist']]) {
    const group = document.getElementById(groupId);
    if (!group) continue;
    // Set initial active state
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === state[stateKey]);
    });
    group.addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state[stateKey] = btn.dataset.val;
      if (callbacks.onParamChange) callbacks.onParamChange(stateKey);
    });
  }

  // Sim control buttons
  const btnMap = {
    startPauseBtn: 'startPause',
    reinitBtn:     'reinit',
  };
  for (const [id, name] of Object.entries(btnMap)) {
    const btn = document.getElementById(id);
    if (btn && callbacks[name]) btn.addEventListener('click', callbacks[name]);
  }
}

export function setStartPauseLabel(running) {
  const btn = document.getElementById('startPauseBtn');
  if (btn) btn.textContent = running ? 'pause' : 'start';
}
