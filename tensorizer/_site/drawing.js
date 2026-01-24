// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

// Transform canvas coordinates
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

// Main draw function
function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply zoom and pan
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Draw legs
  legs.forEach(leg => {
    const start = getLegEndpoint(leg, 'start');
    const end = getLegEndpoint(leg, 'end');

    // Set color based on selection (either single or multi)
    const isSelected = leg === selectedLeg || selectedLegs.has(leg);
    ctx.strokeStyle = isSelected ? '#0000ff' : '#000000';
    ctx.fillStyle = isSelected ? '#0000ff' : '#000000';

    // Map global dimension to line width
    const lineWidth = dimensionToLineWidth(globalDimension);
    ctx.lineWidth = isSelected ? lineWidth * 1.5 : lineWidth;

    // Draw main leg line first
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw SV visualization lines ON TOP (disabled - shown in floating plots instead)
    // if (showSingularValues && iterationCount > 0 && currentLegSVs[leg.id] && initialMaxSVs[leg.id]) {
    //   const svs = currentLegSVs[leg.id];
    //   const initMax = initialMaxSVs[leg.id];
    //   const numSVs = svs.length;

    //   if (numSVs > 0) {
    //     // Calculate perpendicular direction for spacing
    //     const dx = end.x - start.x;
    //     const dy = end.y - start.y;
    //     const length = Math.sqrt(dx * dx + dy * dy);

    //     if (length > 0) {
    //       const perpX = -dy / length;
    //       const perpY = dx / length;

    //       // Total spacing for SV lines - increased for better visibility
    //       const totalSpacing = Math.min(lineWidth * 2, 40);
    //       const svSpacing = numSVs > 1 ? totalSpacing / (numSVs - 1) : 0;
    //       const startOffset = -(totalSpacing / 2);

    //       // Draw each SV as a parallel line
    //       svs.forEach((sv, i) => {
    //         // Calculate opacity: initMax -> 0, 0.5 -> 1, linear interpolation
    //         let opacity;

    //         if (initMax >= 0.5) {
    //           // Edge case: initMax is already at or above target
    //           opacity = 0;
    //         } else {
    //           // Linear interpolation from initMax (opacity 0) to 0.5 (opacity 1)
    //           opacity = (sv - initMax) / (0.5 - initMax);
    //         }

    //         opacity = Math.max(0, Math.min(1, opacity));

    //         // Offset for this SV line
    //         const offset = startOffset + i * svSpacing;
    //         const sx = start.x + perpX * offset;
    //         const sy = start.y + perpY * offset;
    //         const ex = end.x + perpX * offset;
    //         const ey = end.y + perpY * offset;

    //         // Draw the SV line in red with calculated opacity
    //         ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
    //         ctx.lineWidth = 1.5;
    //         ctx.beginPath();
    //         ctx.moveTo(sx, sy);
    //         ctx.lineTo(ex, ey);
    //         ctx.stroke();
    //       });
    //     }
    //   }
    // }

    // Draw free end circles
    if (!leg.startTensor) {
      ctx.beginPath();
      ctx.arc(start.x, start.y, FREE_END_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (!leg.endTensor) {
      ctx.beginPath();
      ctx.arc(end.x, end.y, FREE_END_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Calculate midpoint (for floating plots later)
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Draw leg label at midpoint of visible length, offset perpendicular to line
    // For free legs, adjust to use midpoint of visible part (excluding tensor box)
    let labelMidX, labelMidY;

    if (!leg.startTensor || !leg.endTensor) {
      // Free leg - adjust start/end to visible portion
      let visibleStart = { ...start };
      let visibleEnd = { ...end };

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        const unitX = dx / length;
        const unitY = dy / length;

        // Move start point away from tensor center by half tensor size
        if (leg.startTensor) {
          visibleStart.x = start.x + unitX * (TENSOR_SIZE / 2);
          visibleStart.y = start.y + unitY * (TENSOR_SIZE / 2);
        }

        // Move end point away from tensor center by half tensor size
        if (leg.endTensor) {
          visibleEnd.x = end.x - unitX * (TENSOR_SIZE / 2);
          visibleEnd.y = end.y - unitY * (TENSOR_SIZE / 2);
        }
      }

      labelMidX = (visibleStart.x + visibleEnd.x) / 2;
      labelMidY = (visibleStart.y + visibleEnd.y) / 2;
    } else {
      // Both ends connected - use regular midpoint
      labelMidX = midX;
      labelMidY = midY;
    }

    // Calculate perpendicular offset
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0) {
      let perpX = -dy / length;
      let perpY = dx / length;

      // Always choose the upward direction (negative y is up)
      if (perpY > 0) {
        perpX = -perpX;
        perpY = -perpY;
      }

      // Shift label by half the line width plus base offset to avoid overlap with wide legs
      const offset = 15 + lineWidth / 2;

      const labelX = labelMidX + perpX * offset;
      const labelY = labelMidY + perpY * offset;

      // Draw leg name
      ctx.font = 'italic 24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? '#0000ff' : '#000000';
      ctx.fillText(leg.name, labelX, labelY);

      // Draw SV count annotation if toggle is on (below the leg)
      if (showLegRanks) {
        // Draw below by using downward perpendicular
        const annotationX = labelMidX - perpX * offset;
        const annotationY = labelMidY - perpY * offset;

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#666666';
        const countText = (iterationCount > 0 && currentLegSVCounts[leg.id] !== undefined)
          ? currentLegSVCounts[leg.id].toString()
          : '0';
        ctx.fillText(countText, annotationX, annotationY);
      }
    }
  });

  // Draw connection preview when dragging
  if (connectionStart) {
    ctx.strokeStyle = '#666666';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(connectionStart.x, connectionStart.y);
    ctx.lineTo(connectionStart.previewX, connectionStart.previewY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw tensors
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  tensors.forEach(tensor => {
    const halfSize = TENSOR_SIZE / 2;

    // Check if selected (either single or multi)
    const isSelected = tensor === selectedTensor || selectedTensors.has(tensor);

    // Draw square
    ctx.fillStyle = isSelected ? '#e0e0ff' : '#ffffff';
    ctx.strokeStyle = isSelected ? '#0000ff' : '#000000';
    ctx.lineWidth = isSelected ? 3 : 2;

    ctx.fillRect(tensor.x - halfSize, tensor.y - halfSize, TENSOR_SIZE, TENSOR_SIZE);
    ctx.strokeRect(tensor.x - halfSize, tensor.y - halfSize, TENSOR_SIZE, TENSOR_SIZE);

    // Find all legs connected to this tensor and collect their names
    const connectedLegs = legs.filter(leg =>
      leg.startTensor === tensor || leg.endTensor === tensor
    );
    const legNames = connectedLegs.map(leg => leg.name).sort().join('');

    // Draw tensor label with properly aligned subscripts
    ctx.fillStyle = '#000000';

    // Measure components
    ctx.font = 'italic 28px serif';
    const mainWidth = ctx.measureText(tensor.name).width;
    const mainHeight = 28;

    let subscriptWidth = 0;
    const subscriptHeight = 18;
    if (legNames.length > 0) {
      ctx.font = 'italic 18px serif';
      subscriptWidth = ctx.measureText(legNames).width;
    }

    // Calculate total width and center the whole label
    const totalWidth = mainWidth + subscriptWidth;
    const startX = tensor.x - totalWidth / 2;

    // Draw main letter
    ctx.font = 'italic 28px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tensor.name, startX, tensor.y);

    // Draw subscript to the right and slightly down
    if (legNames.length > 0) {
      ctx.font = 'italic 18px serif';
      ctx.fillText(legNames, startX + mainWidth, tensor.y + 8);
    }
  });

  // Draw selection box
  if (selectionBox) {
    ctx.strokeStyle = '#0000ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    const boxWidth = selectionBox.endX - selectionBox.startX;
    const boxHeight = selectionBox.endY - selectionBox.startY;
    ctx.strokeRect(selectionBox.startX, selectionBox.startY, boxWidth, boxHeight);
    ctx.setLineDash([]);
  }

  // Draw floating SV plots (after all legs are drawn)
  if (showSingularValues) {
    const plotWidth = 120;
    const plotHeight = 80;
    const BUFFER_SIZE = 20;
    const occupiedRegions = [];
    const rejectedPositions = []; // For debugging
    floatingPlotBounds = []; // Reset plot bounds for click detection

    // Helper function: distance from point to rectangle
    function distanceToRect(px, py, rectX, rectY, rectW, rectH) {
      const closestX = Math.max(rectX, Math.min(px, rectX + rectW));
      const closestY = Math.max(rectY, Math.min(py, rectY + rectH));
      const dx = px - closestX;
      const dy = py - closestY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Helper function: distance from point to line segment
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

    // Helper function: minimum distance from rectangle to another rectangle
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

    // Helper function: minimum distance from rectangle to line segment
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

    legs.forEach(leg => {
      // Skip legs without history only if simulation has started
      // If simulation hasn't started, we'll draw empty plots
      const hasHistory = legSVHistory[leg.id] && legSVHistory[leg.id].length > 0;

      const start = getLegEndpoint(leg, 'start');
      const end = getLegEndpoint(leg, 'end');
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      // Spiral search for valid position
      let plotX, plotY;
      let found = false;
      const maxI = 1000;

      for (let i = 1; i <= maxI && !found; i++) {
        const theta = i * Math.PI / 16;
        const r = 0.3 * i;

        // Candidate position (top-left corner of plot)
        const candidateX = midX + r * Math.cos(theta) - plotWidth / 2;
        const candidateY = midY + r * Math.sin(theta) - plotHeight / 2;

        // Check if this position is valid
        let valid = true;

        // Check canvas bounds
        if (candidateX < 10 || candidateX + plotWidth > 790 ||
            candidateY < 10 || candidateY + plotHeight > 590) {
          valid = false;
        }

        // Check against other plots
        if (valid) {
          for (const region of occupiedRegions) {
            const dist = rectToRectDistance(
              candidateX, candidateY, plotWidth, plotHeight,
              region.x, region.y, region.width, region.height
            );
            if (dist < BUFFER_SIZE) {
              valid = false;
              break;
            }
          }
        }

        // Check against all legs
        if (valid) {
          for (const otherLeg of legs) {
            const otherStart = getLegEndpoint(otherLeg, 'start');
            const otherEnd = getLegEndpoint(otherLeg, 'end');

            const dist = rectToSegmentDistance(
              candidateX, candidateY, plotWidth, plotHeight,
              otherStart.x, otherStart.y, otherEnd.x, otherEnd.y
            );

            if (dist < BUFFER_SIZE) {
              valid = false;
              break;
            }
          }
        }

        // Check against tensors
        if (valid) {
          for (const tensor of tensors) {
            const tensorX = tensor.x - TENSOR_SIZE / 2;
            const tensorY = tensor.y - TENSOR_SIZE / 2;

            const dist = rectToRectDistance(
              candidateX, candidateY, plotWidth, plotHeight,
              tensorX, tensorY, TENSOR_SIZE, TENSOR_SIZE
            );

            if (dist < BUFFER_SIZE) {
              valid = false;
              break;
            }
          }
        }

        if (valid) {
          plotX = candidateX;
          plotY = candidateY;
          found = true;
        } else {
          // Store rejected position for debugging
          rejectedPositions.push({ x: candidateX + plotWidth / 2, y: candidateY + plotHeight / 2 });
        }
      }

      if (!found) {
        // Fallback: just place it at the last attempted position
        const theta = maxI * Math.PI / 16;
        const r = 0.3 * maxI;
        plotX = midX + r * Math.cos(theta) - plotWidth / 2;
        plotY = midY + r * Math.sin(theta) - plotHeight / 2;
      }

      // Mark this region as occupied
      occupiedRegions.push({ x: plotX, y: plotY, width: plotWidth, height: plotHeight });

      // Draw the plot
      const history = hasHistory ? legSVHistory[leg.id] : [];
      const numSVs = hasHistory ? history[0].svs.length : 0;

      // Check if this leg/plot is selected
      const isPlotSelected = leg === selectedLeg || selectedLegs.has(leg);

      // Draw plot background
      ctx.fillStyle = isPlotSelected ? 'rgba(224, 224, 255, 0.95)' : 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = isPlotSelected ? '#0000ff' : '#333333';
      ctx.lineWidth = isPlotSelected ? 3 : 1;
      ctx.fillRect(plotX, plotY, plotWidth, plotHeight);
      ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);

      // Store plot bounds for click detection
      floatingPlotBounds.push({
        legId: leg.id,
        leg: leg,
        x: plotX,
        y: plotY,
        width: plotWidth,
        height: plotHeight
      });

      // Find max SV value for scaling
      let maxSV = 0;
      history.forEach(entry => {
        entry.svs.forEach(sv => {
          if (sv > maxSV) maxSV = sv;
        });
      });

      if (maxSV > 0 && history.length > 1) {
        const padding = 5;
        const chartWidth = plotWidth - 2 * padding;
        const chartHeight = plotHeight - 2 * padding - 15; // Leave room for label

        // Draw each SV as a line
        for (let svIndex = 0; svIndex < numSVs; svIndex++) {
          const hue = (svIndex * 360 / numSVs) % 360;
          ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();

          history.forEach((entry, i) => {
            const x = plotX + padding + (i / (history.length - 1)) * chartWidth;
            const y = plotY + plotHeight - padding - (entry.svs[svIndex] / maxSV) * chartHeight;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });

          ctx.stroke();
        }
      }


      // Draw a connecting line from leg to plot edge
      // Calculate where line intersects plot rectangle
      const plotCenterX = plotX + plotWidth / 2;
      const plotCenterY = plotY + plotHeight / 2;
      const dx = plotCenterX - midX;
      const dy = plotCenterY - midY;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        // Find intersection with plot rectangle
        const unitX = dx / length;
        const unitY = dy / length;

        // Test all 4 edges of the rectangle
        let intersectX = plotCenterX;
        let intersectY = plotCenterY;
        const edges = [
          { x1: plotX, y1: plotY, x2: plotX + plotWidth, y2: plotY }, // Top
          { x1: plotX + plotWidth, y1: plotY, x2: plotX + plotWidth, y2: plotY + plotHeight }, // Right
          { x1: plotX, y1: plotY + plotHeight, x2: plotX + plotWidth, y2: plotY + plotHeight }, // Bottom
          { x1: plotX, y1: plotY, x2: plotX, y2: plotY + plotHeight } // Left
        ];

        for (const edge of edges) {
          const edgeDx = edge.x2 - edge.x1;
          const edgeDy = edge.y2 - edge.y1;
          const det = unitX * edgeDy - unitY * edgeDx;

          if (Math.abs(det) > 0.0001) {
            const t = ((edge.x1 - midX) * edgeDy - (edge.y1 - midY) * edgeDx) / det;
            const u = ((edge.x1 - midX) * unitY - (edge.y1 - midY) * unitX) / det;

            if (t > 0 && u >= 0 && u <= 1) {
              const candidateX = midX + t * unitX;
              const candidateY = midY + t * unitY;
              const distToCandidate = Math.sqrt((candidateX - midX) ** 2 + (candidateY - midY) ** 2);
              const distToIntersect = Math.sqrt((intersectX - midX) ** 2 + (intersectY - midY) ** 2);

              if (distToCandidate < distToIntersect) {
                intersectX = candidateX;
                intersectY = candidateY;
              }
            }
          }
        }

        // Draw line with same style as plot border
        ctx.strokeStyle = isPlotSelected ? '#0000ff' : '#333333';
        ctx.lineWidth = isPlotSelected ? 3 : 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(intersectX, intersectY);
        ctx.stroke();
      }
    });

    // Draw debug dots for rejected positions (disabled for now)
    // ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    // rejectedPositions.forEach(pos => {
    //   ctx.beginPath();
    //   ctx.arc(pos.x, pos.y, 2, 0, 2 * Math.PI);
    //   ctx.fill();
    // });
  }

  ctx.restore();

  // Floating loss plot removed - loss is always shown in side panel
  // if (iterationCount > 0 && lossHistory && lossHistory.length > 0) {
  //   const plotWidth = 120;
  //   const plotHeight = 80;
  //   const plotX = 10;
  //   const canvasDisplayHeight = canvas.getBoundingClientRect().height;
  //   const plotY = canvasDisplayHeight - plotHeight - 10;
  //
  //   // Draw plot background (loss plot is not selectable, always shown in top panel)
  //   ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  //   ctx.strokeStyle = '#333333';
  //   ctx.lineWidth = 1;
  //   ctx.fillRect(plotX, plotY, plotWidth, plotHeight);
  //   ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);
  //
  //   // Store plot bounds for click detection
  //   if (!floatingPlotBounds) {
  //     floatingPlotBounds = [];
  //   }
  //   floatingPlotBounds.push({
  //     legId: 'loss',
  //     leg: 'loss',
  //     x: plotX,
  //     y: plotY,
  //     width: plotWidth,
  //     height: plotHeight
  //   });
  //
  //   // Draw label at top
  //   ctx.fillStyle = '#333333';
  //   ctx.font = '12px sans-serif';
  //   ctx.textAlign = 'center';
  //   ctx.fillText('Loss', plotX + plotWidth / 2, plotY + 15);
  //
  //   // Draw the loss curve
  //   if (lossHistory.length > 1) {
  //     const padding = 5;
  //     const labelHeight = 20;
  //     const chartWidth = plotWidth - 2 * padding;
  //     const chartHeight = plotHeight - 2 * padding - labelHeight;
  //
  //     // Find max loss for scaling - lossHistory contains {iteration, loss} objects
  //     let maxLoss = Math.max(...lossHistory.map(h => h.loss));
  //     if (maxLoss === 0) maxLoss = 1;
  //
  //     ctx.strokeStyle = 'rgb(75, 192, 192)';
  //     ctx.lineWidth = 2;
  //     ctx.beginPath();
  //
  //     let started = false;
  //     lossHistory.forEach((entry, i) => {
  //       const lossValue = entry.loss;
  //       const x = plotX + padding + (i / (lossHistory.length - 1)) * chartWidth;
  //       const normalizedLoss = Math.max(0, Math.min(1, lossValue / maxLoss));
  //       const y = plotY + labelHeight + padding + chartHeight * (1 - normalizedLoss);
  //
  //       if (!started) {
  //         ctx.moveTo(x, y);
  //         started = true;
  //       } else {
  //         ctx.lineTo(x, y);
  //       }
  //     });
  //
  //     ctx.stroke();
  //   }
  // }

  // Update formula display
  updateFormulaDisplay();
}
