// Contrast-function expressions for the interactive page: parse a Python-like expression in u, differentiate it symbolically,
// and emit JavaScript (for the plots) and WGSL (for the GPU). Loaded by app.js in the browser and by the node tests.
//
// Grammar: numbers, u, pi, e; + - * / ; ** or ^ for powers; unary minus; parentheses; functions sin cos tan exp log cosh sinh tanh
// abs sqrt sign relu softplus max(a,b) min(a,b); [cond] is an indicator (1 where cond holds, else 0) with cond = expr (< > <= >=) expr.
// Derivative of an indicator [a > b] is a Gaussian bump of width EPS at the boundary (a smoothed delta), so an indicator contrast still
// pushes the units; everything else is exact.
(function (root) {
  const EPS = 0.1;
  const FUNCS = ['sin', 'cos', 'tan', 'exp', 'log', 'cosh', 'sinh', 'tanh', 'abs', 'sqrt', 'sign', 'relu', 'softplus', 'max', 'min'];

  function tokenize(src) {
    const toks = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.eE]/.test(src[j]) && !(src[j] === 'e' && !/[0-9.]/.test(src[j + 1] || '') && !/[0-9]/.test(src[j - 1] || ''))) j++;
        // a trailing 'e' that is not an exponent belongs to the next token
        let s = src.slice(i, j); if (/[eE]$/.test(s)) { s = s.slice(0, -1); j--; }
        toks.push({ t: 'num', v: parseFloat(s) }); i = j; continue; }
      if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z_0-9]/.test(src[j])) j++; toks.push({ t: 'id', v: src.slice(i, j) }); i = j; continue; }
      if (src.startsWith('**', i)) { toks.push({ t: 'op', v: '**' }); i += 2; continue; }
      if (src.startsWith('<=', i) || src.startsWith('>=', i) || src.startsWith('==', i)) { toks.push({ t: 'op', v: src.slice(i, i + 2) }); i += 2; continue; }
      if ('+-*/^()[],<>'.includes(c)) { toks.push({ t: 'op', v: c === '^' ? '**' : c }); i++; continue; }
      throw new Error('unexpected character "' + c + '" at ' + i);
    }
    return toks;
  }

  // AST nodes: {k:'num',v} {k:'u'} {k:'neg',a} {k:'bin',op,a,b} {k:'call',f,args} {k:'ind',op,a,b}
  function parse(src) {
    const toks = tokenize(src); let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const expect = v => { const t = next(); if (!t || t.v !== v) throw new Error('expected "' + v + '"' + (t ? ' but found "' + t.v + '"' : ' at end')); };
    function expr() { let a = term(); while (peek() && (peek().v === '+' || peek().v === '-')) { const op = next().v; a = { k: 'bin', op, a, b: term() }; } return a; }
    function term() { let a = unary(); while (peek() && (peek().v === '*' || peek().v === '/')) { const op = next().v; a = { k: 'bin', op, a, b: unary() }; } return a; }
    function unary() { if (peek() && peek().v === '-') { next(); return { k: 'neg', a: unary() }; } if (peek() && peek().v === '+') { next(); return unary(); } return power(); }
    function power() { const a = atom(); if (peek() && peek().v === '**') { next(); return { k: 'bin', op: '**', a, b: unary() }; } return a; }
    function atom() {
      const t = next(); if (!t) throw new Error('unexpected end of expression');
      if (t.t === 'num') return { k: 'num', v: t.v };
      if (t.t === 'id') {
        if (t.v === 'u' || t.v === 'x' || t.v === 'z') return { k: 'u' };
        if (t.v === 'pi') return { k: 'num', v: Math.PI };
        if (t.v === 'e') return { k: 'num', v: Math.E };
        if (FUNCS.includes(t.v)) { expect('('); const args = [expr()]; while (peek() && peek().v === ',') { next(); args.push(expr()); } expect(')'); return { k: 'call', f: t.v, args }; }
        throw new Error('unknown name "' + t.v + '" (use u for the projection; functions: ' + FUNCS.join(', ') + ')');
      }
      if (t.v === '(') { const a = expr(); expect(')'); return a; }
      if (t.v === '[') { const a = expr(); const op = next(); if (!op || !['<', '>', '<=', '>='].includes(op.v)) throw new Error('an indicator needs a comparison: [u > 3]'); const b = expr(); expect(']'); return { k: 'ind', op: op.v, a, b }; }
      throw new Error('unexpected "' + t.v + '"');
    }
    const ast = expr(); if (p < toks.length) throw new Error('unexpected "' + toks[p].v + '" after the expression'); return ast;
  }

  const num = v => ({ k: 'num', v }), bin = (op, a, b) => ({ k: 'bin', op, a, b }), call = (f, ...args) => ({ k: 'call', f, args });
  const isNum = (n, v) => n.k === 'num' && (v === undefined || n.v === v);
  // light simplification so the derivative stays readable and cheap
  function S(n) {
    if (n.k === 'bin') {
      const a = S(n.a), b = S(n.b);
      if (isNum(a) && isNum(b)) { const f = { '+': (x, y) => x + y, '-': (x, y) => x - y, '*': (x, y) => x * y, '/': (x, y) => x / y, '**': Math.pow }[n.op]; return num(f(a.v, b.v)); }
      if (n.op === '+') { if (isNum(a, 0)) return b; if (isNum(b, 0)) return a; }
      if (n.op === '-') { if (isNum(b, 0)) return a; if (isNum(a, 0)) return { k: 'neg', a: b }; }
      if (n.op === '*') { if (isNum(a, 0) || isNum(b, 0)) return num(0); if (isNum(a, 1)) return b; if (isNum(b, 1)) return a; }
      if (n.op === '/') { if (isNum(a, 0)) return num(0); if (isNum(b, 1)) return a; }
      if (n.op === '**') { if (isNum(b, 1)) return a; if (isNum(b, 0)) return num(1); }
      return { k: 'bin', op: n.op, a, b };
    }
    if (n.k === 'neg') { const a = S(n.a); if (isNum(a)) return num(-a.v); if (a.k === 'neg') return a.a; return { k: 'neg', a }; }
    if (n.k === 'call') return { k: 'call', f: n.f, args: n.args.map(S) };
    if (n.k === 'ind') return { k: 'ind', op: n.op, a: S(n.a), b: S(n.b) };
    return n;
  }

  // d/du
  function D(n) {
    switch (n.k) {
      case 'num': return num(0);
      case 'u': return num(1);
      case 'neg': return { k: 'neg', a: D(n.a) };
      case 'bin': {
        const a = n.a, b = n.b, da = D(a), db = D(b);
        if (n.op === '+') return bin('+', da, db);
        if (n.op === '-') return bin('-', da, db);
        if (n.op === '*') return bin('+', bin('*', da, b), bin('*', a, db));
        if (n.op === '/') return bin('/', bin('-', bin('*', da, b), bin('*', a, db)), bin('**', b, num(2)));
        if (n.op === '**') {
          if (isNum(b)) return bin('*', bin('*', num(b.v), bin('**', a, num(b.v - 1))), da);          // a^c
          // general: a^b = exp(b log a) -> a^b (b' log a + b a'/a)
          return bin('*', n, bin('+', bin('*', db, call('log', a)), bin('/', bin('*', b, da), a)));
        }
        throw new Error('op ' + n.op);
      }
      case 'call': {
        const a = n.args[0], da = D(a);
        const chain = inner => bin('*', inner, da);
        switch (n.f) {
          case 'sin': return chain(call('cos', a));
          case 'cos': return { k: 'neg', a: chain(call('sin', a)) };
          case 'tan': return chain(bin('/', num(1), bin('**', call('cos', a), num(2))));
          case 'exp': return chain(call('exp', a));
          case 'log': return chain(bin('/', num(1), a));
          case 'cosh': return chain(call('sinh', a));
          case 'sinh': return chain(call('cosh', a));
          case 'tanh': return chain(bin('-', num(1), bin('**', call('tanh', a), num(2))));
          case 'abs': return chain(call('sign', a));
          case 'sqrt': return chain(bin('/', num(0.5), call('sqrt', a)));
          case 'sign': return num(0);
          case 'relu': return chain({ k: 'ind', op: '>', a, b: num(0) });
          case 'softplus': return chain(bin('/', num(1), bin('+', num(1), call('exp', { k: 'neg', a }))));
          case 'max': case 'min': { const b = n.args[1], db = D(b); const pick = { k: 'ind', op: n.f === 'max' ? '>' : '<', a, b };   // max(a,b)' = [a>b] a' + [a<=b] b'
            return bin('+', bin('*', pick, da), bin('*', bin('-', num(1), pick), db)); }
        }
        throw new Error('function ' + n.f);
      }
      case 'ind': {
        // smoothed delta at the boundary a = b, width EPS; sign so that d/du [a > b] = +delta * (a - b)'
        const diff = bin('-', n.a, n.b), s = (n.op === '>' || n.op === '>=') ? 1 : -1;
        const bump = bin('*', num(s / (EPS * Math.sqrt(2 * Math.PI))), call('exp', { k: 'neg', a: bin('/', bin('**', diff, num(2)), num(2 * EPS * EPS)) }));
        return bin('*', bump, D(diff));
      }
    }
    throw new Error('node ' + n.k);
  }

  // code generation
  function toJS(n) {
    switch (n.k) {
      case 'num': return Number.isFinite(n.v) ? (n.v < 0 ? '(' + n.v + ')' : String(n.v)) : 'NaN';
      case 'u': return 'u';
      case 'neg': return '(-' + toJS(n.a) + ')';
      case 'bin': return n.op === '**' ? 'Math.pow(' + toJS(n.a) + ',' + toJS(n.b) + ')' : '(' + toJS(n.a) + n.op + toJS(n.b) + ')';
      case 'call': {
        const a = n.args.map(toJS);
        const m = { sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan', exp: 'Math.exp', log: 'Math.log', cosh: 'Math.cosh', sinh: 'Math.sinh', tanh: 'Math.tanh', abs: 'Math.abs', sqrt: 'Math.sqrt', sign: 'Math.sign', max: 'Math.max', min: 'Math.min' };
        if (n.f === 'relu') return 'Math.max(0,' + a[0] + ')';
        if (n.f === 'softplus') return 'Math.log(1+Math.exp(' + a[0] + '))';
        return m[n.f] + '(' + a.join(',') + ')';
      }
      case 'ind': return '((' + toJS(n.a) + n.op + toJS(n.b) + ')?1:0)';
    }
  }
  function toWGSL(n) {
    switch (n.k) {
      case 'num': { if (!Number.isFinite(n.v)) return '0.0'; let s = String(n.v); if (!/[.e]/.test(s)) s += '.0'; return n.v < 0 ? '(' + s + ')' : s; }
      case 'u': return 'u';
      case 'neg': return '(-' + toWGSL(n.a) + ')';
      case 'bin': {
        if (n.op === '**') {
          if (isNum(n.b) && Number.isInteger(n.b.v) && n.b.v >= 0 && n.b.v <= 8) {           // integer powers as products (pow is undefined for a negative base)
            if (n.b.v === 0) return '1.0'; const a = toWGSL(n.a); return '(' + Array(n.b.v).fill(a).join('*') + ')';
          }
          return 'pow(' + toWGSL(n.a) + ',' + toWGSL(n.b) + ')';
        }
        return '(' + toWGSL(n.a) + n.op + toWGSL(n.b) + ')';
      }
      case 'call': {
        const a = n.args.map(toWGSL);
        if (n.f === 'relu') return 'max(0.0,' + a[0] + ')';
        if (n.f === 'softplus') return 'log(1.0+exp(' + a[0] + '))';
        if (n.f === 'cosh') return '(0.5*(exp(' + a[0] + ')+exp(-(' + a[0] + '))))';       // WGSL has cosh, but exp-based forms keep f32 behaviour identical to the JS plots
        if (n.f === 'sinh') return '(0.5*(exp(' + a[0] + ')-exp(-(' + a[0] + '))))';
        return n.f + '(' + a.join(',') + ')';
      }
      case 'ind': return 'select(0.0,1.0,(' + toWGSL(n.a) + n.op + toWGSL(n.b) + '))';
    }
  }

  function compile(src) {
    const ast = S(parse(src)), dast = S(D(ast));
    const G = new Function('u', 'return ' + toJS(ast) + ';'), g = new Function('u', 'return ' + toJS(dast) + ';');
    // the Gaussian expectation of G by quadrature on [-10, 10]
    let EG = 0; const h = 0.005; for (let x = -10; x <= 10; x += h) EG += G(x) * Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * h;
    return { ast, dast, G, g, EG_gauss: EG, wgslG: toWGSL(ast), wgslg: toWGSL(dast), js: toJS(ast), djs: toJS(dast) };
  }
  root.GParse = { parse, D, S, toJS, toWGSL, compile, EPS, FUNCS };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.GParse;
