// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

// Cache for downsampled SV history to avoid recomputing every frame
window.downsampledSVCache = {}; // legId -> { length: originalLength, downsampled: array }

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
    floatingPlotBounds = []; // Reset plot bounds for click detection

    // Add tensor positions to occupied regions so plots avoid them
    tensors.forEach(tensor => {
      const halfSize = TENSOR_SIZE / 2;
      occupiedRegions.push({
        x: tensor.x - halfSize,
        y: tensor.y - halfSize,
        width: TENSOR_SIZE,
        height: TENSOR_SIZE
      });
    });

    // Cache for plot positions (legId -> {x, y})
    if (!window.plotPositionCache) {
      window.plotPositionCache = {};
    }

    legs.forEach(leg => {
      // Skip legs without history only if simulation has started
      // If simulation hasn't started, we'll draw empty plots
      const hasHistory = legSVHistory[leg.id] && legSVHistory[leg.id].length > 0;

      const start = getLegEndpoint(leg, 'start');
      const end = getLegEndpoint(leg, 'end');
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      // Try to use cached position first
      let plotX, plotY;
      let found = false;
      const maxI = 1000;

      if (window.plotPositionCache[leg.id]) {
        const cached = window.plotPositionCache[leg.id];
        plotX = cached.x;
        plotY = cached.y;

        // Validate cached position is still valid
        let cacheValid = true;

        // Check canvas bounds
        if (plotX < 10 || plotX + plotWidth > 790 ||
            plotY < 10 || plotY + plotHeight > 590) {
          cacheValid = false;
        }

        // Check against other plots (excluding itself)
        if (cacheValid) {
          for (const region of occupiedRegions) {
            const dist = rectToRectDistance(
              plotX, plotY, plotWidth, plotHeight,
              region.x, region.y, region.width, region.height
            );
            if (dist < BUFFER_SIZE) {
              cacheValid = false;
              break;
            }
          }
        }

        if (cacheValid) {
          found = true;
        } else {
          delete window.plotPositionCache[leg.id];
        }
      }

      // Spiral search for valid position if not found in cache
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
          // Cache this position for next frame
          window.plotPositionCache[leg.id] = { x: plotX, y: plotY };
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
      const fullHistory = hasHistory ? legSVHistory[leg.id] : [];
      // Downsample to max 200 points for performance
      const history = downsampleData(fullHistory, 200);
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
          ctx.strokeStyle = getSVColor(svIndex, numSVs);
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
  }

  ctx.restore();

  // Only update formula display when diagram changes, not during simulation
  // (formula doesn't change during gradient descent, only when tensors/legs change)
  if (!simulationRunning) {
    updateFormulaDisplay();
  }
}
