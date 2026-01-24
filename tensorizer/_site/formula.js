// ============================================================================
// TENSOR FORMULA GENERATION
// ============================================================================

// Generate the tensor contraction formula in Einstein notation
function generateTensorFormula() {
  // Handle empty diagram
  if (tensors.length === 0) {
    return '$$T = 1$$';
  }

  // Sort tensors alphabetically by name
  const sortedTensors = [...tensors].sort((a, b) => a.name.localeCompare(b.name));

  // Build right-hand side: collect all tensor terms
  const tensorTerms = [];
  const externalLegs = new Set(); // Legs that appear in the final result
  const contractedLegs = new Set(); // Legs that are summed over

  // First pass: classify all legs
  legs.forEach(leg => {
    const connectedTensorCount = (leg.startTensor ? 1 : 0) + (leg.endTensor ? 1 : 0);

    if (connectedTensorCount === 2) {
      // Both ends connected to tensors -> contracted (summed over)
      contractedLegs.add(leg.name);
    } else if (connectedTensorCount === 1) {
      // One end connected, one free -> external
      externalLegs.add(leg.name);
    }
    // connectedTensorCount === 0 shouldn't happen (removeUnconnectedLegs handles this)
  });

  // Second pass: build tensor terms
  sortedTensors.forEach(tensor => {
    // Find all legs connected to this tensor
    const connectedLegs = legs.filter(leg =>
      leg.startTensor === tensor || leg.endTensor === tensor
    );

    // Sort leg names alphabetically
    const legNames = connectedLegs.map(leg => leg.name).sort();

    // Build tensor term in LaTeX
    if (legNames.length > 0) {
      tensorTerms.push(`${tensor.name}_{${legNames.join('')}}`);
    } else {
      // Tensor with no legs
      tensorTerms.push(tensor.name);
    }
  });

  // Build right-hand side
  const rightSide = tensorTerms.join(' \\, ');

  // Build left-hand side: T with external indices
  const sortedExternalLegs = Array.from(externalLegs).sort();
  let leftSide;
  if (sortedExternalLegs.length > 0) {
    leftSide = `T_{${sortedExternalLegs.join('')}}`;
  } else {
    // All indices contracted -> scalar result
    leftSide = 'T';
  }

  // Combine as LaTeX (using $$ for display math)
  return `$$${leftSide} = ${rightSide}$$`;
}

// Update the formula display element
function updateFormulaDisplay() {
  const formulaElement = document.getElementById('formulaDisplay');
  if (formulaElement) {
    const formula = generateTensorFormula();
    formulaElement.innerHTML = formula;

    // Trigger MathJax to re-render
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise([formulaElement]).then(() => {
        // Auto-rescale if content is too wide
        const container = formulaElement;
        const mathContent = container.querySelector('mjx-container');

        if (mathContent) {
          const containerWidth = container.offsetWidth;
          const contentWidth = mathContent.scrollWidth;

          if (contentWidth > containerWidth) {
            // Scale down to fit
            const scale = containerWidth / contentWidth;
            mathContent.style.transform = `scale(${scale})`;
            mathContent.style.transformOrigin = 'center center';
          } else {
            // Remove any previous scaling
            mathContent.style.transform = '';
          }
        }
      }).catch((err) => console.log('MathJax error:', err));
    }
  }
}
