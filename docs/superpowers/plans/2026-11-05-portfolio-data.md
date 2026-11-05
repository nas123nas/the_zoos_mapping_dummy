# Portfolio Data Implementation Plan
> Implement inline using superpowers:executing-plans.
**Goal:** Rich, connected fictional data without operational identifiers.
**Architecture:** Add PortfolioData as the shared source. Adapt existing app and operations fixtures; namespace storage and remove operational links.
**Tech Stack:** Static JavaScript, Node built-in assertions.
**Spec:** ../specs/2026-11-05-portfolio-data-design.md
## Global Constraints
At least 50 products; each existing collection at least doubled; preserve UI; no deployment or dependencies.
## Review Focus
Unique identifiers; matching product names; warehouse totals; reserved stock within current stock; legacy persisted credentials.
### Task 1: Shared fixtures
- [x] Add tests/portfolio-data.test.cjs for count minima, unique barcodes, references, dates, quantities and cross-screen totals; run red.
- [x] Create portfolio-data.js exporting catalog, schedule, workspace fixtures, coordination and operations adapters.
### Task 2: Integration and anonymization
- [x] Load fixtures before engines in index.html, use shared fixtures in app.js and ops-dashboard-engine.js, seed only fresh workspace.
- [x] Replace operational emails/password/sheet links and retailer references, namespace storage consistently; test source scan.
### Task 3: Verification
- [x] Run data suite and syntax checks; exercise all navigation pages in browser; record counts and package clean static files.

## Execution record
Completed 2026-11-05. Node assertions and every JavaScript syntax check pass. Headless Edge: all 11 sidebar destinations plus operations screen, review correction persistence, legacy storage isolation, administrator demo password and coordination seed idempotence pass. Zero page exceptions and zero failed HTTP responses. External request only the existing XLSX CDN.

Independent review identified linked order quantities and repeated fixture generation inside the SKU loop. Both were fixed, with regression assertions added.

Decisions: no git repository exists, so no branch/worktree/commit was created; work stays in the authorized folder. Sold-out screen initially selects the existing zero-stock filter because fictional stock values are nonnegative; users can change the existing filters. Original ZIP remains untouched. Runtime packages were not installed. No deployment.
