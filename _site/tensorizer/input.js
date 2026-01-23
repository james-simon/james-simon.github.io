// ============================================================================
// INPUT HANDLERS AND HIT DETECTION
// ============================================================================

// Check if point is inside tensor
function isTensorAt(tensor, worldX, worldY) {
  const halfSize = TENSOR_SIZE / 2;
  return Math.abs(worldX - tensor.x) <= halfSize &&
         Math.abs(worldY - tensor.y) <= halfSize;
}

// Find tensor at position
function findTensorAt(worldX, worldY) {
  // Check in reverse order (top to bottom)
  for (let i = tensors.length - 1; i >= 0; i--) {
    if (isTensorAt(tensors[i], worldX, worldY)) {
      return tensors[i];
    }
  }
  return null;
}

// Check if point is near a free leg endpoint
function findFreeLegEndAt(worldX, worldY) {
  const threshold = (FREE_END_RADIUS * 3) / zoom; // Larger clickbox for easier interaction
  for (let i = legs.length - 1; i >= 0; i--) {
    const leg = legs[i];

    // Check start end if it's free
    if (!leg.startTensor) {
      const dist = Math.sqrt(Math.pow(worldX - leg.startPos.x, 2) + Math.pow(worldY - leg.startPos.y, 2));
      if (dist <= threshold) {
        return { leg: leg, end: 'start' };
      }
    }

    // Check end end if it's free
    if (!leg.endTensor) {
      const dist = Math.sqrt(Math.pow(worldX - leg.endPos.x, 2) + Math.pow(worldY - leg.endPos.y, 2));
      if (dist <= threshold) {
        return { leg: leg, end: 'end' };
      }
    }
  }
  return null;
}

// Check if point is near a leg line
function findLegAt(worldX, worldY) {
  const threshold = 20 / zoom; // 20 pixels in screen space (wider clickbox)
  for (let i = legs.length - 1; i >= 0; i--) {
    const leg = legs[i];
    const start = getLegEndpoint(leg, 'start');
    const end = getLegEndpoint(leg, 'end');

    // Calculate distance from point to line segment
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Start and end are the same point
      const dist = Math.sqrt(Math.pow(worldX - start.x, 2) + Math.pow(worldY - start.y, 2));
      if (dist <= threshold) {
        return leg;
      }
    } else {
      // Find projection of point onto line
      const t = Math.max(0, Math.min(1, ((worldX - start.x) * dx + (worldY - start.y) * dy) / lengthSquared));
      const projX = start.x + t * dx;
      const projY = start.y + t * dy;
      const dist = Math.sqrt(Math.pow(worldX - projX, 2) + Math.pow(worldY - projY, 2));

      if (dist <= threshold) {
        return leg;
      }

      // Also check if point is near the label
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const length = Math.sqrt(lengthSquared);
      if (length > 0) {
        const perpX = -dy / length;
        const perpY = dx / length;
        const lineWidth = dimensionToLineWidth(globalDimension);
        const offset = 15 + lineWidth / 2;
        const labelX = midX + perpX * offset;
        const labelY = midY + perpY * offset;

        // Check if within 20 pixels of label (approximate character size)
        const labelDist = Math.sqrt(Math.pow(worldX - labelX, 2) + Math.pow(worldY - labelY, 2));
        if (labelDist <= 20 / zoom) {
          return leg;
        }
      }
    }
  }
  return null;
}

// Tool selection
function setActiveTool(tool) {
  activeTool = tool;
  [mouseTool, panTool, tensorTool, connectionTool, eraserTool].forEach(btn => btn.classList.remove('active'));
  canvas.classList.remove('eraser');

  // Clear selection when switching away from mouse tool
  if (tool !== 'mouse') {
    selectedTensor = null;
    selectedLeg = null;
    selectedTensors.clear();
    selectedLegs.clear();
    updatePropertyPanel();
    draw();
  }

  if (tool === 'mouse') {
    mouseTool.classList.add('active');
    canvas.style.cursor = 'default';
  } else if (tool === 'pan') {
    panTool.classList.add('active');
    canvas.style.cursor = 'grab';
  } else if (tool === 'tensor') {
    tensorTool.classList.add('active');
    canvas.style.cursor = 'crosshair';
  } else if (tool === 'connection') {
    connectionTool.classList.add('active');
    canvas.style.cursor = 'crosshair';
  } else if (tool === 'eraser') {
    eraserTool.classList.add('active');
    canvas.classList.add('eraser');
    canvas.style.cursor = 'not-allowed';
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupInputHandlers() {
  // Tool button listeners
  mouseTool.addEventListener('click', () => setActiveTool('mouse'));
  panTool.addEventListener('click', () => setActiveTool('pan'));
  tensorTool.addEventListener('click', () => setActiveTool('tensor'));
  connectionTool.addEventListener('click', () => setActiveTool('connection'));
  eraserTool.addEventListener('click', () => setActiveTool('eraser'));

  undoButton.addEventListener('click', () => undo());

  const showRanksButton = document.getElementById('showRanksButton');
  showRanksButton.addEventListener('click', () => {
    showLegRanks = !showLegRanks;
    if (showLegRanks) {
      showRanksButton.classList.add('active');
    } else {
      showRanksButton.classList.remove('active');
    }
    draw();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // Don't delete objects if user is typing in a text field
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      // Delete selected objects
      let deletedSomething = false;

      // Delete multi-selected tensors
      if (selectedTensors.size > 0) {
        selectedTensors.forEach(tensor => {
          const index = tensors.indexOf(tensor);
          if (index > -1) {
            tensors.splice(index, 1);
          }
          // Remove legs connected to this tensor
          legs = legs.filter(leg => leg.startTensor !== tensor && leg.endTensor !== tensor);
        });
        selectedTensors.clear();
        deletedSomething = true;
      }

      // Delete multi-selected legs
      if (selectedLegs.size > 0) {
        selectedLegs.forEach(leg => {
          const index = legs.indexOf(leg);
          if (index > -1) {
            legs.splice(index, 1);
          }
        });
        selectedLegs.clear();
        deletedSomething = true;
      }

      // Delete single selected tensor
      if (selectedTensor) {
        const index = tensors.indexOf(selectedTensor);
        if (index > -1) {
          tensors.splice(index, 1);
        }
        // Remove legs connected to this tensor
        legs = legs.filter(leg => leg.startTensor !== selectedTensor && leg.endTensor !== selectedTensor);
        selectedTensor = null;
        deletedSomething = true;
      }

      // Delete single selected leg
      if (selectedLeg) {
        const index = legs.indexOf(selectedLeg);
        if (index > -1) {
          legs.splice(index, 1);
        }
        selectedLeg = null;
        deletedSomething = true;
      }

      if (deletedSomething) {
        e.preventDefault();
        updatePropertyPanel();
        saveState();
        draw();
      }
    }
  });

  // Canvas click event
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    if (activeTool === 'tensor') {
      // Create new tensor at click position
      const tensor = createTensor(world.x, world.y);

      // Auto-connect to any free leg endpoints within tensor bounds
      const tensorCenter = { x: tensor.x, y: tensor.y };
      legs.forEach(leg => {
        if (!leg.startTensor && leg.startPos) {
          const dist = Math.sqrt(
            Math.pow(tensorCenter.x - leg.startPos.x, 2) +
            Math.pow(tensorCenter.y - leg.startPos.y, 2)
          );
          if (dist < TENSOR_SIZE / 2) {
            leg.startTensor = tensor;
            leg.startPos = null;
          }
        }
        if (!leg.endTensor && leg.endPos) {
          const dist = Math.sqrt(
            Math.pow(tensorCenter.x - leg.endPos.x, 2) +
            Math.pow(tensorCenter.y - leg.endPos.y, 2)
          );
          if (dist < TENSOR_SIZE / 2) {
            leg.endTensor = tensor;
            leg.endPos = null;
          }
        }
      });

      // Clean up any self-loops or unconnected legs that may have been created
      removeSelfLoops();
      removeUnconnectedLegs();

      saveState();  // Save state AFTER creating tensor
      selectedTensor = tensor;
      selectedLeg = null;
      updatePropertyPanel();
      draw();
    } else if (activeTool === 'mouse') {
      // Select tensor or leg
      const clickedTensor = findTensorAt(world.x, world.y);
      if (clickedTensor) {
        selectedTensor = clickedTensor;
        selectedLeg = null;
      } else {
        // Try to select a leg (endpoint or line)
        const clickedLegEnd = findFreeLegEndAt(world.x, world.y);
        if (clickedLegEnd) {
          selectedTensor = null;
          selectedLeg = clickedLegEnd.leg;
        } else {
          const clickedLeg = findLegAt(world.x, world.y);
          if (clickedLeg) {
            selectedTensor = null;
            selectedLeg = clickedLeg;
          } else {
            selectedTensor = null;
            selectedLeg = null;
          }
        }
      }
      updatePropertyPanel();
      draw();
    }
  });

  // Canvas mousedown event
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    lastMousePos = { x: screenX, y: screenY };
    mouseDown = true;

    if (activeTool === 'mouse') {
      // Try to grab a free leg end first
      const legEnd = findFreeLegEndAt(world.x, world.y);
      if (legEnd) {
        draggingLegEnd = legEnd;
        // Select the leg immediately
        selectedTensor = null;
        selectedLeg = legEnd.leg;
        updatePropertyPanel();
        canvas.classList.add('dragging');
        draw();
      } else {
        // Try to grab a tensor
        const tensor = findTensorAt(world.x, world.y);
        if (tensor) {
          // If clicking on a selected tensor, drag all selected
          if (selectedTensors.has(tensor)) {
            draggingMultiple = true;
            // Store offsets for all selected tensors
            dragOffsets.clear();
            selectedTensors.forEach(t => {
              dragOffsets.set(t, { x: world.x - t.x, y: world.y - t.y });
            });

            // Store offsets for selected free leg endpoints
            if (window.selectedFreeEnds) {
              window.selectedFreeEnds.forEach((ends, leg) => {
                if (ends.has('start') && leg.startPos) {
                  dragOffsets.set(`${leg.id}-start`, {
                    x: world.x - leg.startPos.x,
                    y: world.y - leg.startPos.y
                  });
                }
                if (ends.has('end') && leg.endPos) {
                  dragOffsets.set(`${leg.id}-end`, {
                    x: world.x - leg.endPos.x,
                    y: world.y - leg.endPos.y
                  });
                }
              });
            }

            canvas.classList.add('dragging');
          } else {
            // Single tensor drag - select it immediately and clear multi-selection
            selectedTensors.clear();
            selectedLegs.clear();
            selectedTensor = tensor;
            selectedLeg = null;
            updatePropertyPanel();
            draggingTensor = tensor;
            dragOffset.x = world.x - tensor.x;
            dragOffset.y = world.y - tensor.y;
            canvas.classList.add('dragging');
            draw();
          }
        } else {
          // Start box selection on empty space
          selectionBox = {
            startX: world.x,
            startY: world.y,
            endX: world.x,
            endY: world.y
          };
        }
      }
    } else if (activeTool === 'pan') {
      // Start panning
      panningCanvas = true;
      canvas.style.cursor = 'grabbing';
    } else if (activeTool === 'connection') {
      // Start creating a connection
      const tensor = findTensorAt(world.x, world.y);
      if (tensor) {
        connectionStart = {
          tensor: tensor,
          x: tensor.x,
          y: tensor.y,
          previewX: tensor.x,
          previewY: tensor.y
        };
      } else {
        connectionStart = {
          tensor: null,
          x: world.x,
          y: world.y,
          previewX: world.x,
          previewY: world.y
        };
      }
    } else if (activeTool === 'eraser') {
      // Start erasing
      const clickedTensor = findTensorAt(world.x, world.y);
      if (clickedTensor) {
        const index = tensors.indexOf(clickedTensor);
        if (index > -1) {
          tensors.splice(index, 1);
        }
        legs = legs.filter(leg => leg.startTensor !== clickedTensor && leg.endTensor !== clickedTensor);
        if (selectedTensor === clickedTensor) {
          selectedTensor = null;
          updatePropertyPanel();
        }
        saveState();  // Save state AFTER erasing
        draw();
      } else {
        const leg = findLegAt(world.x, world.y);
        if (leg) {
          const index = legs.indexOf(leg);
          if (index > -1) {
            legs.splice(index, 1);
          }
          if (selectedLeg === leg) {
            selectedLeg = null;
            updatePropertyPanel();
          }
          saveState();  // Save state AFTER erasing
          draw();
        }
      }
    }
  });

  // Canvas mousemove event
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    if (draggingTensor) {
      draggingTensor.x = world.x - dragOffset.x;
      draggingTensor.y = world.y - dragOffset.y;
      draw();
    } else if (draggingMultiple) {
      // Drag all selected tensors
      selectedTensors.forEach(tensor => {
        const offset = dragOffsets.get(tensor);
        if (offset) {
          tensor.x = world.x - offset.x;
          tensor.y = world.y - offset.y;
        }
      });

      // Drag selected free leg endpoints
      if (window.selectedFreeEnds) {
        window.selectedFreeEnds.forEach((ends, leg) => {
          if (ends.has('start') && leg.startPos) {
            const offset = dragOffsets.get(`${leg.id}-start`);
            if (offset) {
              leg.startPos.x = world.x - offset.x;
              leg.startPos.y = world.y - offset.y;
            }
          }
          if (ends.has('end') && leg.endPos) {
            const offset = dragOffsets.get(`${leg.id}-end`);
            if (offset) {
              leg.endPos.x = world.x - offset.x;
              leg.endPos.y = world.y - offset.y;
            }
          }
        });
      }

      draw();
    } else if (draggingLegEnd) {
      // Update the free end position
      const leg = draggingLegEnd.leg;
      if (draggingLegEnd.end === 'start') {
        leg.startPos = { x: world.x, y: world.y };
      } else {
        leg.endPos = { x: world.x, y: world.y };
      }
      draw();
    } else if (panningCanvas) {
      const dx = screenX - lastMousePos.x;
      const dy = screenY - lastMousePos.y;
      panX += dx;
      panY += dy;
      lastMousePos = { x: screenX, y: screenY };
      draw();
    } else if (selectionBox) {
      // Update selection box
      selectionBox.endX = world.x;
      selectionBox.endY = world.y;
      draw();
    } else if (connectionStart) {
      // Update connection preview
      connectionStart.previewX = world.x;
      connectionStart.previewY = world.y;
      draw();
    } else if (activeTool === 'eraser' && mouseDown) {
      // Erase as we drag (only when mouse is held down)
      const clickedTensor = findTensorAt(world.x, world.y);
      if (clickedTensor) {
        const index = tensors.indexOf(clickedTensor);
        if (index > -1) {
          tensors.splice(index, 1);
        }
        legs = legs.filter(leg => leg.startTensor !== clickedTensor && leg.endTensor !== clickedTensor);
        if (selectedTensor === clickedTensor) {
          selectedTensor = null;
          updatePropertyPanel();
        }
        draw();
      } else {
        // Check if we're near a leg to erase it
        const leg = findLegAt(world.x, world.y);
        if (leg) {
          const index = legs.indexOf(leg);
          if (index > -1) {
            legs.splice(index, 1);
          }
          if (selectedLeg === leg) {
            selectedLeg = null;
            updatePropertyPanel();
          }
          draw();
        }
      }
    }
  });

  // Canvas mouseup event
  canvas.addEventListener('mouseup', (e) => {
    mouseDown = false;

    // Complete box selection
    if (selectionBox) {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld(screenX, screenY);

      selectionBox.endX = world.x;
      selectionBox.endY = world.y;

      // Calculate normalized box bounds
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      // Select tensors in box
      selectedTensors.clear();
      selectedLegs.clear();
      const selectedFreeEnds = new Map(); // leg -> Set of 'start'/'end'

      tensors.forEach(tensor => {
        const halfSize = TENSOR_SIZE / 2;
        const tensorMinX = tensor.x - halfSize;
        const tensorMaxX = tensor.x + halfSize;
        const tensorMinY = tensor.y - halfSize;
        const tensorMaxY = tensor.y + halfSize;

        // Check if tensor intersects with selection box
        if (tensorMaxX >= minX && tensorMinX <= maxX &&
            tensorMaxY >= minY && tensorMinY <= maxY) {
          selectedTensors.add(tensor);
        }
      });

      // Check free leg endpoints in box
      legs.forEach(leg => {
        const ends = new Set();

        if (!leg.startTensor && leg.startPos) {
          if (leg.startPos.x >= minX && leg.startPos.x <= maxX &&
              leg.startPos.y >= minY && leg.startPos.y <= maxY) {
            ends.add('start');
          }
        }

        if (!leg.endTensor && leg.endPos) {
          if (leg.endPos.x >= minX && leg.endPos.x <= maxX &&
              leg.endPos.y >= minY && leg.endPos.y <= maxY) {
            ends.add('end');
          }
        }

        if (ends.size > 0) {
          selectedFreeEnds.set(leg, ends);
        }

        // Select leg if:
        // (a) both tensors are selected
        // (b) one tensor selected and other free end selected
        // (c) both free ends selected
        const startSelected = leg.startTensor ? selectedTensors.has(leg.startTensor) : ends.has('start');
        const endSelected = leg.endTensor ? selectedTensors.has(leg.endTensor) : ends.has('end');

        if (startSelected && endSelected) {
          selectedLegs.add(leg);
        }
      });

      // Store selected free ends for later use in dragging
      window.selectedFreeEnds = selectedFreeEnds;

      selectionBox = null;
      draw();
    }

    if (connectionStart) {
      // Complete the connection
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld(screenX, screenY);

      const endTensor = findTensorAt(world.x, world.y);

      // Create the leg
      const startTensor = connectionStart.tensor;
      const startPos = startTensor ? null : { x: connectionStart.x, y: connectionStart.y };
      const endPos = endTensor ? null : { x: world.x, y: world.y };

      createLeg(startTensor, endTensor, startPos, endPos);
      removeSelfLoops();  // Remove any self-loops
      removeUnconnectedLegs();  // Remove legs with no tensor connections
      saveState();  // Save state AFTER creating leg
      connectionStart = null;
      draw();
    }

    // Check for leg endpoint snapping to tensor
    if (draggingLegEnd) {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld(screenX, screenY);
      const tensorAtEnd = findTensorAt(world.x, world.y);

      if (tensorAtEnd) {
        // Snap the endpoint to the tensor
        const leg = draggingLegEnd.leg;
        if (draggingLegEnd.end === 'start') {
          leg.startTensor = tensorAtEnd;
          leg.startPos = null;
        } else {
          leg.endTensor = tensorAtEnd;
          leg.endPos = null;
        }
      }
    }

    // Check for tensor snapping to leg endpoint
    if (draggingTensor) {
      const tensorCenter = { x: draggingTensor.x, y: draggingTensor.y };

      // Check all legs for free endpoints near the tensor
      legs.forEach(leg => {
        if (!leg.startTensor) {
          const dist = Math.sqrt(
            Math.pow(tensorCenter.x - leg.startPos.x, 2) +
            Math.pow(tensorCenter.y - leg.startPos.y, 2)
          );
          if (dist < TENSOR_SIZE / 2) {
            leg.startTensor = draggingTensor;
            leg.startPos = null;
          }
        }
        if (!leg.endTensor) {
          const dist = Math.sqrt(
            Math.pow(tensorCenter.x - leg.endPos.x, 2) +
            Math.pow(tensorCenter.y - leg.endPos.y, 2)
          );
          if (dist < TENSOR_SIZE / 2) {
            leg.endTensor = draggingTensor;
            leg.endPos = null;
          }
        }
      });
    }

    // Remove any self-loops or unconnected legs that may have been created by snapping
    if (draggingTensor || draggingLegEnd) {
      removeSelfLoops();
      removeUnconnectedLegs();
    }

    // Save state after dragging tensor or leg end
    if (draggingTensor || draggingLegEnd || draggingMultiple) {
      saveState();
    }

    draggingTensor = null;
    draggingLegEnd = null;
    draggingMultiple = false;
    panningCanvas = false;
    canvas.classList.remove('dragging');
    if (activeTool === 'mouse') {
      canvas.style.cursor = 'default';
    } else if (activeTool === 'pan') {
      canvas.style.cursor = 'grab';
    }
  });

  // Canvas mouseleave event
  canvas.addEventListener('mouseleave', () => {
    mouseDown = false;
    connectionStart = null;
    selectionBox = null;
    draggingTensor = null;
    draggingLegEnd = null;
    draggingMultiple = false;
    panningCanvas = false;
    canvas.classList.remove('dragging');
    if (activeTool === 'mouse') {
      canvas.style.cursor = 'default';
    } else if (activeTool === 'pan') {
      canvas.style.cursor = 'grab';
    }
  });

  // Zoom with mouse wheel
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Get world position before zoom
    const worldBefore = screenToWorld(mouseX, mouseY);

    // Update zoom (0.5x sensitivity)
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    zoom *= zoomFactor;
    zoom = Math.max(0.1, Math.min(5, zoom)); // Clamp zoom

    // Get world position after zoom
    const worldAfter = screenToWorld(mouseX, mouseY);

    // Adjust pan to keep mouse position fixed
    panX += (worldAfter.x - worldBefore.x) * zoom;
    panY += (worldAfter.y - worldBefore.y) * zoom;

    draw();
  });
}
