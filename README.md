# ACDT Group 33 — study time and Portuguese grades

An interactive research webpage using all 649 original records in UCI Student Performance's `student-por.csv`. The primary predictor is categorical weekly study time and the outcome is final Portuguese grade G3 (0–20). Numeric-code simple linear regression is a sensitivity analysis. Past failures are an exploratory predictive comparison, not a demonstrated causal influence.

The website runs as static HTML, CSS and JavaScript, without external scripts, accounts, or a backend. `dist/index.html` is the entry point. The application recalculates regressions, F tests, confidence intervals and predictor rankings for the visible filters. Cross-validation and random-forest results are explicitly fixed full-sample reference analyses from the downloadable executed notebook.

Data source: Cortez (2008), UCI Student Performance, https://doi.org/10.24432/C5TG7T, CC BY 4.0. Original CSV SHA-256: `a7594a11d7771c0efe1a740824e0e833da9c4cad07c39a9766a874575563fb3f`.

Resources in `dist/downloads/` include the exact CSV, one-page executive summary, four-page System Maps and Justification report, executed Colab-compatible notebook, analysis code, source data dictionary and downloadable website source. No generated 100-student dataset is used.

Run the notebook in Google Colab by downloading it and using File > Upload notebook. It contains the original data and requires no Drive connection or separate CSV upload.

To serve locally, run `python -m http.server --directory dist 8000` and open `http://localhost:8000`. The downloaded source ZIP contains the same static application. No build is required.

Verification: `python scripts/verify_statistics.py` independently compares browser calculations against NumPy/SciPy over 972 filter, model and confidence-level combinations. Requires pandas, NumPy, SciPy and Node. `node scripts/verify_dashboard.cjs` checks UI events and state in a DOM mock and renders SVG charts using Sharp (`CODEX_PRIMARY_RUNTIME_NODE_MODULES` must point to an installation with Sharp). This is not a real-browser layout test. Browser WebMCP is feature-detected; its tool/state contract is mock-tested, and native browser validation is unavailable in the plain-static managed preview environment.

## Final edition: 17 October 2026

The final edition adds a plain-language takeaway, a proposed four-step support protocol, a nine-scene presentation mode, and a separate browser-local CSV workspace. The workspace supports quoted comma/semicolon/tab files, one categorical or numeric X and a numeric Y, confidence intervals, missing-row counts and JSON export. It does not fit adjusted models or retrain the published random forest on uploaded data. Uploaded results never replace the original Portuguese reference figures.

Run `node scripts/verify_final.cjs` for CSV and presentation regressions. Validation uses a DOM mock and SVG renders, not a real browser layout test.

## Publish on GitHub Pages

The public repository is https://github.com/eunsulee07/acdt-group33 . Its root is prepared for static publication. The connected editing tools cannot enable Pages settings. The owner must open Settings > Pages, choose Deploy from a branch, select main and /(root), then Save.

After GitHub reports a successful deployment, the site should be available at https://eunsulee07.github.io/acdt-group33/ . This URL is an expected destination until Pages has been enabled and verified; uploading code alone does not establish that the site is live.

In this exported repository, open index.html or serve the root directory. In the original Sites checkout, the same files are in dist/.
