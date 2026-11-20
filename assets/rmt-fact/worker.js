// Estimates the diagonal of E[Π], where Π projects onto the column space of X = [x_1 ... x_n]
// and x_i ~ N(0, diag(lambdas)). Each trial draws X, orthonormalizes its columns (modified
// Gram-Schmidt; X is never badly enough conditioned here to need a second pass), and adds up
// the squared row norms of the result, which are Π's diagonal entries. Runs until maxTrials or
// maxMs, posting the running mean as it goes.
self.onmessage = function (e) {
  var lambdas = e.data.lambdas, n = e.data.n;
  var maxTrials = e.data.maxTrials, maxMs = e.data.maxMs;
  var d = lambdas.length;
  var scale = new Float64Array(d);
  for (var i = 0; i < d; i++) scale[i] = Math.sqrt(lambdas[i]);
  var q = new Float64Array(d * n);
  var sum = new Float64Array(d);

  var spare = null;
  function gauss() {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u = 1 - Math.random(), v = Math.random();
    var r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  function mean(trials) {
    var m = new Float64Array(d);
    for (var i = 0; i < d; i++) m[i] = sum[i] / trials;
    return m;
  }

  var start = performance.now(), lastPost = start, trials = 0;
  while (trials < maxTrials) {
    for (var j = 0; j < n; j++) {
      var oj = j * d;
      for (var i = 0; i < d; i++) q[oj + i] = scale[i] * gauss();
      for (var k = 0; k < j; k++) {
        var ok = k * d, dot = 0;
        for (var i = 0; i < d; i++) dot += q[ok + i] * q[oj + i];
        for (var i = 0; i < d; i++) q[oj + i] -= dot * q[ok + i];
      }
      var norm = 0;
      for (var i = 0; i < d; i++) norm += q[oj + i] * q[oj + i];
      norm = 1 / Math.sqrt(norm);
      for (var i = 0; i < d; i++) q[oj + i] *= norm;
    }
    for (var j = 0; j < n; j++) {
      var oj = j * d;
      for (var i = 0; i < d; i++) sum[i] += q[oj + i] * q[oj + i];
    }
    trials++;

    var now = performance.now();
    if (now - start > maxMs) break;
    if (now - lastPost > 150 && trials < maxTrials) {
      lastPost = now;
      self.postMessage({ done: false, trials: trials, mean: mean(trials) });
    }
  }
  self.postMessage({ done: true, trials: trials, mean: mean(trials) });
};
