# Eigenhybridization

Interactive visualization for exploring eigenvalue hybridization in random matrices.

## Architecture

This visualization uses a modular backend system:

- **Pyodide backend** (primary): Python WebAssembly running NumPy directly in the browser for fast eigendecomposition
- **JavaScript backend** (fallback): Pure JavaScript using ml-matrix library if Pyodide fails to load

The backend system automatically tries Pyodide first, then falls back to JavaScript if needed.

## Development

```bash
# Run Jekyll as usual
bundle exec jekyll serve

# Visit http://127.0.0.1:4000/eigenhybridization
```

On first load, Pyodide will download and initialize (may take a few seconds). Subsequent loads are much faster due to browser caching.

## File Structure

```
eigenhybridization/
├── app.js                    # Main application logic
├── index.html                # Page structure
├── styles.css                # Styling
├── backend/
│   ├── backend-manager.js    # Coordinates between backends
│   ├── pyodide-backend.js    # WebAssembly Python backend
│   └── js-backend.js         # JavaScript fallback
└── utils/
    └── sliders.js            # Logarithmic slider utilities
```
