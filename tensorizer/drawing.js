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

    // Draw SV visualization lines ON TOP (if simulation is running, we have SV data, and toggle is on)
    if (showLegRanks && iterationCount > 0 && currentLegSVs[leg.id] && initialMaxSVs[leg.id]) {
      const svs = currentLegSVs[leg.id];
      const initMax = initialMaxSVs[leg.id];
      const numSVs = svs.length;

      if (numSVs > 0) {
        // Calculate perpendicular direction for spacing
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
          const perpX = -dy / length;
          const perpY = dx / length;

          // Total spacing for SV lines - increased for better visibility
          const totalSpacing = Math.min(lineWidth * 2, 40);
          const svSpacing = numSVs > 1 ? totalSpacing / (numSVs - 1) : 0;
          const startOffset = -(totalSpacing / 2);

          // Draw each SV as a parallel line
          svs.forEach((sv, i) => {
            // Calculate opacity: initMax -> 0, 0.5 -> 1, linear interpolation
            let opacity;

            if (initMax >= 0.5) {
              // Edge case: initMax is already at or above target
              opacity = 0;
            } else {
              // Linear interpolation from initMax (opacity 0) to 0.5 (opacity 1)
              opacity = (sv - initMax) / (0.5 - initMax);
            }

            opacity = Math.max(0, Math.min(1, opacity));

            // Offset for this SV line
            const offset = startOffset + i * svSpacing;
            const sx = start.x + perpX * offset;
            const sy = start.y + perpY * offset;
            const ex = end.x + perpX * offset;
            const ey = end.y + perpY * offset;

            // Draw the SV line in red with calculated opacity
            ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          });
        }
      }
    }

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

      // Draw SV count annotation if simulation has started and toggle is on (below the leg)
      if (showLegRanks && iterationCount > 0 && currentLegSVCounts[leg.id] !== undefined) {
        // Draw below by using downward perpendicular
        const annotationX = labelMidX - perpX * offset;
        const annotationY = labelMidY - perpY * offset;

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#666666';
        const countText = currentLegSVCounts[leg.id].toString();
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
  if (showLegRanks && iterationCount > 0) {
    const plotWidth = 120;
    const plotHeight = 80;
    const buffer = 20;
    const occupiedRegions = [];

    legs.forEach(leg => {
      if (!legSVHistory[leg.id] || legSVHistory[leg.id].length === 0) {
        return;
      }

      const start = getLegEndpoint(leg, 'start');
      const end = getLegEndpoint(leg, 'end');
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      // Try positions in a spiral pattern around the leg midpoint
      let plotX, plotY;
      let found = false;

      const candidates = [
        { x: midX + 80, y: midY - 40 },  // Right
        { x: midX - 80 - plotWidth, y: midY - 40 },  // Left
        { x: midX - plotWidth/2, y: midY - 100 },  // Top
        { x: midX - plotWidth/2, y: midY + 60 },  // Bottom
        { x: midX + 100, y: midY - 100 },  // Top-right
        { x: midX - 100 - plotWidth, y: midY - 100 },  // Top-left
        { x: midX + 100, y: midY + 60 },  // Bottom-right
        { x: midX - 100 - plotWidth, y: midY + 60 },  // Bottom-left
      ];

      for (const candidate of candidates) {
        // Check if this position collides with any occupied region
        let collides = false;

        // Check against other plots
        for (const region of occupiedRegions) {
          if (!(candidate.x + plotWidth + buffer < region.x ||
                candidate.x > region.x + region.width + buffer ||
                candidate.y + plotHeight + buffer < region.y ||
                candidate.y > region.y + region.height + buffer)) {
            collides = true;
            break;
          }
        }

        // Check against all legs
        if (!collides) {
          legs.forEach(otherLeg => {
            const otherStart = getLegEndpoint(otherLeg, 'start');
            const otherEnd = getLegEndpoint(otherLeg, 'end');

            // Simple bounding box check for leg
            const legMinX = Math.min(otherStart.x, otherEnd.x) - buffer;
            const legMaxX = Math.max(otherStart.x, otherEnd.x) + buffer;
            const legMinY = Math.min(otherStart.y, otherEnd.y) - buffer;
            const legMaxY = Math.max(otherStart.y, otherEnd.y) + buffer;

            if (!(candidate.x + plotWidth < legMinX ||
                  candidate.x > legMaxX ||
                  candidate.y + plotHeight < legMinY ||
                  candidate.y > legMaxY)) {
              collides = true;
            }
          });
        }

        // Check against tensors
        if (!collides) {
          tensors.forEach(tensor => {
            const tensorMinX = tensor.x - TENSOR_SIZE/2 - buffer;
            const tensorMaxX = tensor.x + TENSOR_SIZE/2 + buffer;
            const tensorMinY = tensor.y - TENSOR_SIZE/2 - buffer;
            const tensorMaxY = tensor.y + TENSOR_SIZE/2 + buffer;

            if (!(candidate.x + plotWidth < tensorMinX ||
                  candidate.x > tensorMaxX ||
                  candidate.y + plotHeight < tensorMinY ||
                  candidate.y > tensorMaxY)) {
              collides = true;
            }
          });
        }

        // Check canvas bounds
        if (!collides) {
          if (candidate.x < 10 || candidate.x + plotWidth > 790 ||
              candidate.y < 10 || candidate.y + plotHeight > 590) {
            collides = true;
          }
        }

        if (!collides) {
          plotX = candidate.x;
          plotY = candidate.y;
          found = true;
          break;
        }
      }

      if (!found) {
        // Fallback: just place it somewhere
        plotX = midX + 80;
        plotY = midY - 40;
      }

      // Mark this region as occupied
      occupiedRegions.push({ x: plotX, y: plotY, width: plotWidth, height: plotHeight });

      // Draw the plot
      const history = legSVHistory[leg.id];
      const numSVs = history[0].svs.length;

      // Draw plot background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.fillRect(plotX, plotY, plotWidth, plotHeight);
      ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);

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

      // Draw label
      ctx.fillStyle = '#000000';
      ctx.font = 'italic 12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`Leg ${leg.name}`, plotX + plotWidth / 2, plotY + 2);

      // Draw a connecting line from plot to leg
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(plotX + plotWidth/2, plotY + plotHeight/2);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  ctx.restore();

  // Update formula display
  updateFormulaDisplay();
}
