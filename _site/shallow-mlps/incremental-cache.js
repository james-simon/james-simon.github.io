// ============================================================================
// INCREMENTAL CACHE — centered sliding-window smoothing + downsampling
// ============================================================================
// Data points are {x, y}.
// smoothingWindow=1 means no smoothing (show all points).
// For window W, only points at indices [W/2 .. len-1-W/2] are included in the
// smoothed output; each is the mean of the W raw points centered on it.

export class SmoothingCache {
  constructor(smoothingWindow, maxPlotPoints) {
    this.smoothingWindow = smoothingWindow;
    this.maxPlotPoints = maxPlotPoints;
  }

  // Compute smoothed + downsampled arrays from scratch each call.
  // fullData: array of {x, y}
  // Returns { downsampledRaw, downsampledSmoothed }
  compute(fullData) {
    if (fullData.length === 0) return { downsampledRaw: [], downsampledSmoothed: [] };

    const W = this.smoothingWindow;
    const half = Math.floor(W / 2);
    const n = fullData.length;

    let smoothed;
    if (W <= 1) {
      // No smoothing — smoothed === raw
      smoothed = fullData;
    } else {
      // Compute sliding window sum with a running accumulator
      const result = [];
      let sum = 0;
      // Pre-fill the first window
      for (let i = 0; i < W && i < n; i++) sum += fullData[i].y;

      const validStart = half;
      const validEnd   = n - 1 - half; // inclusive

      for (let center = validStart; center <= validEnd; center++) {
        result.push({ x: fullData[center].x, y: sum / W });
        // Slide window: add next right edge, remove left edge
        const nextRight = center - half + W;
        const oldLeft   = center - half;
        if (nextRight < n) sum += fullData[nextRight].y;
        sum -= fullData[oldLeft].y;
      }
      smoothed = result;
    }

    // Downsample both to maxPlotPoints
    const downsampledRaw      = this._downsample(fullData);
    const downsampledSmoothed = this._downsample(smoothed);
    return { downsampledRaw, downsampledSmoothed };
  }

  _downsample(arr) {
    if (arr.length <= this.maxPlotPoints) return arr;
    const stride = Math.ceil(arr.length / this.maxPlotPoints);
    const out = arr.filter((_, i) => i % stride === 0);
    // Ensure last point is included
    if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
    return out;
  }

  setWindow(w) {
    this.smoothingWindow = w;
  }
}
