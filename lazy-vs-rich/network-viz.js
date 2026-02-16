// ============================================================================
// NETWORK VISUALIZATION
// ============================================================================
// Draws a neural network diagram as a series of vertical bars connected by
// trapezoids, into a target SVG element.
//
// Usage:
//
//   renderNetwork(svg, {
//     widths: [10, 50, 50, 3, 1],        // layer widths (controls bar height)
//     layerLabels: ['$x$', null, null, null, '$\\hat{y}$'],  // labels at bars (null = none)
//     edgeLabels:  ['$W_1$', '$W_2$', '$W_3$', '$W_4$'],    // labels inside trapezoids
//     colors:      ['#aaaaaa', '#88aaff', '#88aaff', '#aaaaaa'],  // trapezoid fill colors
//     width:       400,    // total SVG width (default 400)
//     baseHeight:  20,     // height = baseHeight * (log2(width) + 1) (default 20)
//     gap:         6,      // gap between bar and trapezoid edge (default 6)
//     padding:     10,     // left/right SVG padding (default 10)
//     labelSpace:  40,     // extra vertical space for top/bottom labels (default 40)
//     opacity:     0.5,    // trapezoid fill opacity (default 0.5)
//   });
//
// All label strings are rendered via MathJax. Pass null to suppress a label.
// layerLabels: left-side labels appear to the LEFT of the bar; others appear ABOVE.
// edgeLabels:  appear centered inside each trapezoid.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Default options
const DEFAULTS = {
  width: 400,
  baseHeight: 20,
  gap: 6,
  padding: 10,
  labelSpace: 40,
  opacity: 0.5,
};

/**
 * Default height function: log scale, same as expander-nets.
 */
function defaultHeightFn(dim, baseHeight) {
  return baseHeight * (Math.log2(Math.max(dim, 1)) + 1);
}

/**
 * Create an SVG foreignObject containing a centered div with the given LaTeX/HTML string.
 */
function makeForeignLabel(x, y, w, h, text, style = '') {
  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', x);
  fo.setAttribute('y', y);
  fo.setAttribute('width', w);
  fo.setAttribute('height', h);

  const div = document.createElement('div');
  div.style.cssText = `display:flex; justify-content:center; align-items:center; height:100%; font-size:18px; color:#333; ${style}`;
  div.innerHTML = text;
  fo.appendChild(div);
  return fo;
}

/**
 * Main render function.
 *
 * @param {SVGElement} svg   - The SVG DOM element to draw into.
 * @param {object}     opts  - Options (see module header).
 */
export function renderNetwork(svg, opts = {}) {
  const o = Object.assign({}, DEFAULTS, opts);

  const widths     = o.widths     || [1];
  const colors     = o.colors     || [];
  const edgeLabels = o.edgeLabels || [];
  const layerLabels= o.layerLabels|| [];

  const numLayers = widths.length;
  const numEdges  = numLayers - 1;

  // --- Compute heights ---
  const heightFn = o.heightFn || ((dim) => defaultHeightFn(dim, o.baseHeight));
  const heights = widths.map(w => heightFn(w));
  const maxH    = Math.max(...heights);
  const svgH    = o.fixedHeight || (maxH + 2 * o.padding + 2 * o.labelSpace);

  svg.setAttribute('width',  o.width);
  svg.setAttribute('height', svgH);
  svg.innerHTML = '';

  const centerY = svgH / 2;

  // --- X positions of bars ---
  const usableWidth = o.width - 2 * o.padding;
  const spacing     = usableWidth / (numLayers + 1);
  const xPos = [];
  for (let i = 1; i <= numLayers; i++) {
    xPos.push(o.padding + spacing * i);
  }

  // --- Draw trapezoids ---
  for (let i = 0; i < numEdges; i++) {
    const x1 = xPos[i]     + o.gap;
    const x2 = xPos[i + 1] - o.gap;
    const h1 = heights[i];
    const h2 = heights[i + 1];

    const points = [
      [x1, centerY - h1 / 2],
      [x2, centerY - h2 / 2],
      [x2, centerY + h2 / 2],
      [x1, centerY + h1 / 2],
    ];

    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points',  points.map(p => p.join(',')).join(' '));
    poly.setAttribute('fill',    colors[i] || '#aaaaaa');
    poly.setAttribute('opacity', o.opacity);
    svg.appendChild(poly);
  }

  // --- Draw bars ---
  for (let i = 0; i < numLayers; i++) {
    const h = heights[i];
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', xPos[i]);
    line.setAttribute('y1', centerY - h / 2);
    line.setAttribute('x2', xPos[i]);
    line.setAttribute('y2', centerY + h / 2);
    line.setAttribute('stroke',       '#333');
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  }

  // --- Edge labels (inside trapezoids) ---
  for (let i = 0; i < numEdges; i++) {
    const label = edgeLabels[i];
    if (!label) continue;
    const cx = (xPos[i] + xPos[i + 1]) / 2;
    const fw = 80, fh = 30;
    svg.appendChild(makeForeignLabel(cx - fw / 2, centerY - fh / 2, fw, fh, label));
  }

  // --- Layer labels ---
  for (let i = 0; i < numLayers; i++) {
    const label = layerLabels[i];
    if (!label) continue;

    const h = heights[i];
    const fw = 60, fh = 28;

    if (i === 0) {
      // First bar: label to the LEFT, vertically centered
      svg.appendChild(makeForeignLabel(
        xPos[0] - 90 - 16, centerY - fh / 2, 90, fh, label,
        'justify-content:flex-end;'
      ));
    } else if (i === numLayers - 1) {
      // Last bar: label to the RIGHT, vertically centered
      svg.appendChild(makeForeignLabel(
        xPos[i] + 14, centerY - fh / 2, 110, fh, label,
        'justify-content:flex-start;'
      ));
    } else {
      // Middle bars: label ABOVE the bar
      svg.appendChild(makeForeignLabel(
        xPos[i] - fw / 2, centerY - h / 2 - fh - 4, fw, fh, label
      ));
    }
  }

  // --- Typeset MathJax ---
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([svg]).catch(err => console.warn('MathJax error:', err));
  }
}
