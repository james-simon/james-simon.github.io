// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Deep clone helper
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Generate leg name (i, j, k, ..., z, ia, ib, ...)
function getLegName(id) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let num = id + LEG_LETTER_START;
  let name = '';

  // Try single letters first
  if (num < 26) {
    return letters[num];
  }

  // Double letters (ia, ib, ...)
  num -= 26;
  const first = Math.floor(num / 26) + LEG_LETTER_START;
  const second = num % 26;
  return letters[first] + letters[second];
}

// Generate next tensor name (A, B, C, ..., Z, AA, AB, ...)
function getNextTensorName() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const usedNames = new Set(tensors.map(t => t.name));

  // Try single letters first
  for (let i = 0; i < 26; i++) {
    const name = letters[i];
    if (!usedNames.has(name)) {
      return name;
    }
  }

  // Try double letters (AA, AB, ...)
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const name = letters[i] + letters[j];
      if (!usedNames.has(name)) {
        return name;
      }
    }
  }

  // Fallback to triple letters if needed
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      for (let k = 0; k < 26; k++) {
        const name = letters[i] + letters[j] + letters[k];
        if (!usedNames.has(name)) {
          return name;
        }
      }
    }
  }

  // Final fallback
  return 'X' + Date.now();
}

// Remove any self-loops (legs connecting a tensor to itself)
function removeSelfLoops() {
  const initialLength = legs.length;
  legs = legs.filter(leg => {
    // Keep the leg if it's not a self-loop
    return !(leg.startTensor && leg.endTensor && leg.startTensor === leg.endTensor);
  });

  if (legs.length < initialLength) {
    console.log('Removed', initialLength - legs.length, 'self-loop(s)');
  }
}

// Remove any legs with no tensor connections (both ends free)
function removeUnconnectedLegs() {
  const initialLength = legs.length;
  legs = legs.filter(leg => {
    // Keep the leg only if at least one end is connected to a tensor
    return leg.startTensor || leg.endTensor;
  });

  if (legs.length < initialLength) {
    console.log('Removed', initialLength - legs.length, 'unconnected leg(s)');
  }
}
