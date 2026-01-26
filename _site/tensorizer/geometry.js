// ============================================================================
// GEOMETRY UTILITIES
// ============================================================================

// Canvas coordinate transformations
function screenToWorld(x, y) {
  return {
    x: (x - panX) / zoom,
    y: (y - panY) / zoom
  };
}

function worldToScreen(x, y) {
  return {
    x: x * zoom + panX,
    y: y * zoom + panY
  };
}

// Distance from point to rectangle
function distanceToRect(px, py, rectX, rectY, rectW, rectH) {
  const closestX = Math.max(rectX, Math.min(px, rectX + rectW));
  const closestY = Math.max(rectY, Math.min(py, rectY + rectH));
  const dx = px - closestX;
  const dy = py - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance from point to line segment
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
}

// Minimum distance from rectangle to another rectangle
function rectToRectDistance(x1, y1, w1, h1, x2, y2, w2, h2) {
  // Check if rectangles overlap
  if (!(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2)) {
    return 0; // Overlapping
  }

  // Check corners of rect1 against rect2
  let minDist = Infinity;
  const corners1 = [
    [x1, y1], [x1 + w1, y1], [x1, y1 + h1], [x1 + w1, y1 + h1]
  ];

  for (const [cx, cy] of corners1) {
    minDist = Math.min(minDist, distanceToRect(cx, cy, x2, y2, w2, h2));
  }

  // Check corners of rect2 against rect1
  const corners2 = [
    [x2, y2], [x2 + w2, y2], [x2, y2 + h2], [x2 + w2, y2 + h2]
  ];

  for (const [cx, cy] of corners2) {
    minDist = Math.min(minDist, distanceToRect(cx, cy, x1, y1, w1, h1));
  }

  return minDist;
}

// Minimum distance from rectangle to line segment
function rectToSegmentDistance(rectX, rectY, rectW, rectH, x1, y1, x2, y2) {
  let minDist = Infinity;

  // Check distance from all 4 corners of rectangle to line segment
  const corners = [
    [rectX, rectY],
    [rectX + rectW, rectY],
    [rectX, rectY + rectH],
    [rectX + rectW, rectY + rectH]
  ];

  for (const [cx, cy] of corners) {
    minDist = Math.min(minDist, distanceToSegment(cx, cy, x1, y1, x2, y2));
  }

  // Check distance from all 4 edges of rectangle to line segment endpoints
  minDist = Math.min(minDist, distanceToRect(x1, y1, rectX, rectY, rectW, rectH));
  minDist = Math.min(minDist, distanceToRect(x2, y2, rectX, rectY, rectW, rectH));

  // Check if line segment intersects or passes through rectangle
  // Check distance from segment to each edge of the rectangle
  const edges = [
    [rectX, rectY, rectX + rectW, rectY], // Top edge
    [rectX + rectW, rectY, rectX + rectW, rectY + rectH], // Right edge
    [rectX, rectY + rectH, rectX + rectW, rectY + rectH], // Bottom edge
    [rectX, rectY, rectX, rectY + rectH] // Left edge
  ];

  for (const [ex1, ey1, ex2, ey2] of edges) {
    // Check if segments intersect
    const dx1 = x2 - x1;
    const dy1 = y2 - y1;
    const dx2 = ex2 - ex1;
    const dy2 = ey2 - ey1;

    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) > 0.0001) {
      const t = ((ex1 - x1) * dy2 - (ey1 - y1) * dx2) / det;
      const u = ((ex1 - x1) * dy1 - (ey1 - y1) * dx1) / det;

      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        // Segments intersect
        return 0;
      }
    }

    // Also check distance from edge endpoints to segment
    minDist = Math.min(minDist, distanceToSegment(ex1, ey1, x1, y1, x2, y2));
    minDist = Math.min(minDist, distanceToSegment(ex2, ey2, x1, y1, x2, y2));
  }

  return minDist;
}

// Generate rainbow color for singular value visualization
function getSVColor(index, total) {
  const hue = (index * 360 / total) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Map dimension to line width (1px at dimension=1, 15px at dimension=100)
function dimensionToLineWidth(dimension) {
  return 1 + 14 * Math.log(dimension) / Math.log(100);
}
