# MedSymp

**MedSymp** is a beginner-friendly educational web prototype for comparing reported symptoms with publicly available U.S. FDA drug labeling. It provides short results, supporting excerpts, and links to FDA-approved labeling documents when FDA-hosted PDFs can be verified.

> **Medical limitation:** The app does not diagnose conditions, establish causation, determine drug-interaction risk, or recommend medication changes. A **No** means the searched label sections did not yield a qualifying match; it is not proof that a drug cannot cause the symptom. Seek a healthcare professional's advice about medication concerns.

## Quick start

**GitHub Pages:** The root `index.html` is the website entry point. After uploading the repository, enable GitHub Pages under **Settings → Pages**, then select **Deploy from a branch**, `main` and `/ (root)`. See [deployment instructions](docs/DEPLOYMENT.md).

**Mac double-click:** Open `double-click-version/Open MedSymp.html` in your web browser. Keep both PNGs in the same folder. FDA search requires internet access. Some browsers may restrict remote requests from `file://` pages; if so, try GitHub Pages or serve the root folder locally.

**Local web server (optional):** In the repository root run `python3 -m http.server 8000`, then visit `http://localhost:8000`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Web interface for GitHub Pages |
| `style.css` | Styling and responsive layout |
| `script.js` | FDA search, typo suggestions, text matching and results |
| `assets/` | Logo and browser favicon |
| `double-click-version/` | Standalone HTML entry plus image assets |
| `docs/DESIGN.md` | Design document, decisions and limitations |
| `docs/ARCHITECTURE.md` | Architecture explanation and Mermaid diagram |
| `docs/architecture.svg` | Visual architecture diagram (viewable without Mermaid) |
| `docs/DEPLOYMENT.md` | GitHub setup and privacy notes |
| `tests/smoke.test.js` | Small Node.js checks for bundled matching logic |

## Search behavior

1. Enter up to 5 medication names and up to 8 symptoms (one per line).
2. Optional typo suggestions appear below the inputs and must be accepted explicitly.
3. The browser queries the public [openFDA drug labeling API](https://open.fda.gov/apis/drug/label/), searching generic, brand and substance name fields.
4. A ranked shortlist of up to eight matching recent records is checked for adverse-reaction and warning language. This is **not** an exhaustive search of every FDA label.
5. Results are **Yes**, **Mentioned**, **No**, or **Unable to check**. The app provides the matching text and FDA API source for inspection.

## Known issues / scope

- FDA label results can vary by manufacturer, formulation and label update. MedSymp cannot identify the precise product a person uses from a generic name alone.
- Search is bounded and API responses can fail, time out or be rate limited. **No** only describes information identified in records checked, not every existing label.
- Rule-based synonyms and sentence matching can create false positives or negatives, particularly in tables, negated statements, warnings and complex glucose-control language.
- The app has no backend, user accounts or persistent medication storage. Browser requests to the FDA do disclose search queries to that service; avoid entering personally identifying information.
- The project uses the official **FDA-hosted API data**, but **MedSymp is not affiliated with or endorsed by the FDA**.
- Current project is a software prototype, not a validated medical device or medical decision support tool.

## Tests

With [Node.js](https://nodejs.org/) installed, run:

```bash
node --check script.js
node tests/smoke.test.js
```

These are local tests; they do **not** validate live FDA endpoint access, label completeness or clinical accuracy. Manual test cases are documented in [the design document](docs/DESIGN.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please report reproducible issues using anonymized, non-personal examples. Do not submit real patient details.

## Licensing

See [LICENSE-NOTES.md](LICENSE-NOTES.md) for the current distribution/licensing status, including artwork. No open-source license is granted by the presence of these files alone.

## Brand/generic lookup and PDF sources

MedSymp searches the openFDA drug-label endpoint using brand, generic, ingredient, and SPL name fields. Brand and generic results are matched against label metadata; when the correct product cannot be identified, MedSymp shows an error rather than inventing a result.

Each selected label with a valid SPL SET ID links to the newest available PDF **for that SET ID** at the U.S. National Library of Medicine’s DailyMed. This PDF is based on FDA-submitted labeling but is **not an FDA-hosted approved-label PDF**. The newest label for one SET ID may not be the newest FDA-approved prescribing information for every manufacturer or formulation.

## FDA-hosted PDF links

The app queries the Drugs@FDA API for PDF documents tied to the selected label’s application number. Only verified FDA-domain PDF URLs are linked directly; otherwise the link opens the official Drugs@FDA search portal. A PDF may describe FDA-approved labeling that differs from the FDA-submitted structured label analyzed in the results. No PDF URL is invented.

Typo suggestions use separate medication and symptom dictionaries, and never silently change input.


### Latest-label coverage (November 2026)
The application paginates openFDA search matches and groups versions by `set_id`, retaining the newest `effective_time` per label lineage. It no longer stops at eight records. API pagination limits, connectivity failures, and a 38-second per-medication time budget can make a search incomplete; in that case, a negative result is shown as **Unable to check**, not definitive **No**. This is not an authoritative guarantee of all FDA-approved product labeling.


### Product-aware labeling and FDA PDF links

MedSymp groups label revisions by SPL SET ID and retains the latest retrieved revision. Before combining evidence it classifies matching products using ingredient, dosage form and route metadata. Combination products are not combined into single-ingredient generic results. When several distinct product types match, the app requests a more specific product rather than displaying a misleading No. Records with incomplete metadata may not be eligible for a definitive result.

For an FDA-hosted PDF, MedSymp looks up FDA-approved labeling documents associated with the matching application number in Drugs@FDA and checks the returned official PDF URL. **A Drugs@FDA PDF may belong to a different revision than the chosen SPL record.** When no verifiable PDF exists, the result links to the specific openFDA structured label record, not a generic website. Never assume PDF date and SPL effective date are identical.

A complete "No" means no matching mention was detected in the checked and classified records, not absence of an adverse reaction. This prototype has not been clinically validated.

### Product-group handling
Equivalent oral tablet descriptions are normalized before grouping. If incompatible product groups remain, MedSymp checks one compatible group, flags the search as incomplete, and does not return a definitive negative across excluded groups.


### PDF versus structured data

The app links directly to an FDA-hosted prescribing-information PDF **only when** the Drugs@FDA API returns a document URL under an FDA domain for the corresponding application. Otherwise it explicitly offers **FDA label data (JSON)**. That structured data is not a formatted PDF. Application-level prescribing information may not be identical to the specific SPL record used for the symptom result.


### Result-status behavior
For a completed FDA search with no matching adverse-effect text, MedSymp reports **No** for the checked compatible label group. If FDA requests fail or the time budget runs out, it reports **Unable to check** instead. The broad name **insulin** asks for a specific formulation/product and intentionally has no symptom rows. A No result is not proof that an effect is impossible.

### FDA document links and product identification

PDF links are resolved using the documented Drugs@FDA `applications_doc_type`, `application_docs_url`, and `applications_doc_date` fields. If a matching PDF cannot be verified, the app opens the FDA application overview, clearly labeled as a document search rather than a PDF. The date of an FDA-approved PDF may differ from the selected structured-label revision. Brand names can be searched in both harmonized and original labeling fields; Repatha/evolocumab is a supported fallback alias. Searches are educational and not clinically validated.

### Three-fix patch notes
- Double-click HTML uses sibling logo and favicon paths.
- Repatha/evolocumab lookup prioritizes ingredient metadata.
- Direct PDF uses FDA-hosted document when verified, with documented fallback otherwise.

### FDA PDF and product-name lookup notes
Repatha is searched first by FDA brand name, then by its active ingredient (evolocumab). No symptom result is hard-coded. A verified FDA-hosted Repatha prescribing-information PDF is linked when its label is identified. Other FDA PDFs are resolved from official Drugs@FDA document metadata when possible; a document-search fallback may be shown when no corresponding FDA-hosted PDF is available. PDF revisions and structured label revisions may differ.

## Feedback

The FEEDBACK button in the dark header opens an email draft in the visitor’s default mail application. The recipient is not printed on the page.

## PDF references

See `docs/FDA_PDF_LINKS.md` for source-link behavior and limitations.


### Feedback button and insulin glargine PDF reference
The header now aligns Feedback on the right of Important. When the app cannot resolve an exact FDA application PDF for insulin glargine, it may provide the FDA-hosted Lantus 2023 reference PDF, clearly labeled as a reference that may differ from the matched product/label. This is **not** a claim that the reference is the newest or identical to the searched label.

### Medication discovery (2026 update)
Brand and generic names are searched through the FDA label index. When no usable label is found, MedSymp checks FDA's NDC directory for a current generic-name mapping, retries, and can display a link to the official DailyMed label when the openFDA index lacks the new label. A readable label link is not presented as an automated symptom match. External directory lookups may fail under browser CORS restrictions.


### Newly approved drug fallback
If a new brand or ingredient is not yet available through openFDA, MedSymp attempts a current structured-label lookup, then consults a small verified recent FDA PDF catalog. The fallback only supplies an official source document and deliberately does **not** fabricate symptom Yes/No results. The catalog requires periodic maintenance and is not an exhaustive drug directory.

### New combination-brand lookup safeguard
A brand with multiple active ingredients is not automatically excluded when the FDA's `openfda.brand_name` annotation is missing. Product classification recognizes brand fields outside `openfda`. If automated label text is unavailable, a verified official label may be linked without producing a Yes/No symptom conclusion.


### Current SPL/XML fallback (November 2026)
If openFDA cannot return usable safety text, MedSymp discovers a current SPL SET ID via the DailyMed listing and retrieves `/dailymed/services/v2/spls/{SETID}.xml`. It extracts adverse reaction and warning sections for the existing text matcher. If browser cross-origin restrictions block retrieval or text cannot be parsed, the app displays *Unable to check* and the official source link. Do not treat unmatched symptoms as medically ruled out. Not yet validated end-to-end in Safari.


## SPL browser limitation and optional relay

Direct browser access to the DailyMed SPL/XML endpoint can fail due to CORS, especially from the double-click `file://` version. A static website cannot change that policy. To enable the SPL fallback, deploy the read-only Cloudflare Worker in [`worker/`](worker/) and set `SPL_RELAY_BASE` in the JavaScript (and standalone HTML). This requires a separately hosted service. The worker validates SET IDs, restricts the upstream host, and does not store medication or symptom inputs. Without it, display an explicit retrieval limitation rather than a misleading No.

## FDA PDF resolver
The general resolver uses FDA application documents metadata. It has no per-drug PDF overrides. When a PDF URL is absent from accessible FDA metadata, the app links to the application page and makes no claim that no FDA PDF exists. See `docs/FDA_PDF_LINKS.md`.


### FDA PDF indexing (optional)
For wider official FDA PDF coverage, download the Drugs@FDA data tables from the FDA site, extract them, and run `python3 tools/build_fda_pdf_index.py <extracted-folder>`. This creates `fda-pdf-index.json` beside both versions of MedSymp. The prepackaged index is empty: **PDF discovery has not been fully populated**, and some direct PDF links may still be missing. Unlike the previous implementation, the interface does not say an FDA PDF is unavailable when metadata lookup fails.


## Current source-link behavior (simplified)
MedSymp shows detected FDA label passages inline and links to the FDA FDALabel search page for manual verification. It does not guarantee exact-version or PDF deep links. See `docs/LABEL_SOURCES.md`.

### Streamlined result messages
When a verified official label exists but automated analysis is blocked, MedSymp shows **Analysis unavailable** with a short explanation and the FDA search link. The status line below the Check FDA labels button is cleared after results render; incomplete retrieval remains reflected in applicable individual results.

### New-drug application identification
If openFDA safety text and the SPL/XML fallback cannot be accessed, MedSymp checks the official Drugs@FDA application directory for a matching brand or active ingredient name. A verified application is reported as **Analysis unavailable** with an application link, not a symptom-level Yes/No. This is a general directory lookup, not a per-drug whitelist. Standalone browser access and availability of up-to-date FDA indexing may vary.


## Recent labels: deployable SPL fallback

This version adds a same-origin Vercel function (`api/index.js`). When deployed to Vercel, MedSymp automatically calls `/api/find` and `/api/spl/{setid}` to retrieve DailyMed structured labeling. There is **no Worker URL to paste**. Install no extra dependencies.

To deploy: import this repository into Vercel (Framework Preset: Other), deploy at the repository root, then open the Vercel URL. The static `index.html` and the `/api` endpoints run on the same site. Confirm `/api/find?drug=rosuvastatin` returns JSON, then test recently approved drugs and symptom evidence.

**Mac double-click file cannot use this serverless function**. It works for openFDA-supported drugs; when new label text is only available via SPL, visit the deployed Vercel site instead. GitHub Pages is static and cannot run the `/api` function.

No user medication/symptom inputs are saved by the function. Only drug-name searches and FDA SET IDs are relayed to DailyMed. Server access logs may still be retained by hosting providers.

## Recent medications: simple results

See `docs/RECENT_DRUG_STATUS.md`. When an official label or application is verified but automated analysis is inaccessible, the app displays a concise “Analysis unavailable” status and links to FDA labeling search, without exposing technical relay errors.


### Unverified medication lookup status
When all automated sources fail to identify a medication, MedSymp reports **Analysis unavailable** and explicitly states that FDA labeling could not be verified or analyzed. It never claims a label was found without verified source evidence. This is separate from the confirmed-label message, which states that official labeling was found.

### Recent FDA approvals / search availability
The app tries exact and broad FDA Drugs@FDA product/ingredient searches and validates the returned names locally. The FDA APIs may lag behind a newly published approval PDF. If the app cannot verify a result, it does **not** claim an official label was found; it displays a brief analysis-unavailable explanation and links to official Drugs@FDA search. The standalone Mac version cannot directly read DailyMed XML because of browser cross-origin limitations. Deploying the included server-side SPL API provides additional coverage.


## FDA application verification (hosted version)
A server-side `api/approval.js` endpoint verifies exact brand or ingredient names
against live public FDA Drugs@FDA and NDC APIs before reporting that official
application information was found. This is not a comprehensive offline index and
does not assert a drug is unapproved when a lookup is unsuccessful. The double-click
file cannot use this same-origin endpoint and may be less reliable for new drugs.

## Matching highlights
The precise substring matched in the evidence excerpt is shown in dark red.
This indicates wording found in the retrieved label, not proof of causality.

### Search results display

Each medication has a separate bordered card with a larger blue name. Symptom outcomes are visible immediately; matching adverse-reaction passages can be expanded with “View matched label text”. This is a presentation-only change.
