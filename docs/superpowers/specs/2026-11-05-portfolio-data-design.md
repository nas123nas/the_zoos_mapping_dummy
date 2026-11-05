# Portfolio data design — 2026-11-05
Approved in chat. Expand the 23 fictional products to at least 50; double every populated primary demo collection and seed empty inventory tools. Keep names, barcodes, quantities and dates linked across screens. Preserve the UI. Replace personal email, original password, sheet addresses and named business references; isolate every persisted portfolio setting from the operational storage keys. No deployment.
## Approaches
Chosen: shared fictional data model, with adapters for existing screens. Alternative: independent per-screen fixtures (faster, but inconsistent relationships).
## Constraints
Static HTML/JavaScript; no new runtime dependencies. Dates relative to the current Korea calendar day. Fictional admin access remains demonstrable. Existing operational browser data must not be loaded or erased.
