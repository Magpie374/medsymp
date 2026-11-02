# MedSymp — Design Document

## 1. Goal

Provide a compact, understandable method to check **whether a symptom is mentioned as a potential medication-related effect in retrieved FDA labeling**. Keep the medication and symptom inputs and short, evidence-linked outputs on one page. The app is a **label-text search aid**, not a test of causation.

## 2. Intended audience and use

People learning about medication labeling and students exploring API-based web applications. No personal identifying data is required. Clinical diagnosis, risk assessment, treatment selection and medication adjustment are out of scope.

## 3. User experience

1. The user enters medication names and symptoms on separate lines.
2. The page gives optional typo suggestions **without** silently substituting a different medication.
3. One button runs all lookups in the background and displays progress or errors.
4. Results are grouped by medication. Each symptom has a brief status and summary. When available, the original supporting label passage and FDA API link can be opened.
5. The concise medical-use limitation stays after the search results.

The header places the MedSymp pain-themed logo and the main question in one row; the logo itself contains the name to avoid duplicate branding.

## 4. Functional design

**Inputs:** Up to five medication names and eight symptoms; each entry is length-limited and deduplicated. A local list supplies typo suggestions; it is not a complete drug dictionary.

**Drug lookup:** `script.js` calls `https://api.fda.gov/drug/label.json` from the browser, querying generic name, brand name and substance name. It collects matching records, ranks by name closeness and labeling effective date, and checks up to eight recent candidates with relevant sections. A broad `insulin` request is marked **Unable to check** and asks for a specific insulin product name.

**Matching:** A small synonym dictionary and directional glucose terms are used. Sentences from `adverse_reactions`, `warnings_and_cautions`, `boxed_warning`, `warnings` and `precautions` are checked. The program attempts to differentiate risk statements, negations and contextual references. It is a heuristic rather than a medical-grade NLP model.

**Results:**

| Status | Meaning |
|---|---|
| **Yes** | A checked label contains a matching statement categorized by the program as an adverse-effect/warning mention |
| **Mentioned** | Related terminology appears, but the algorithm cannot establish that it is an adverse-effect claim |
| **No** | No qualifying match was found in the **bounded set** of checked label sections |
| **Unable to check** | Lookup or identification failed, or the medication requires a more specific product name |

**Sources:** A click opens the FDA-hosted openFDA structured JSON record associated with the result. The link does not necessarily open a nicely formatted, section-scrolled FDA PDF. Label dates are displayed when available.

## 5. Nonfunctional priorities

- **Ease of use:** Minimal visual distractions, clear labels and compact per-symptom answers.
- **Accessibility:** Keyboard-operable controls, labeled text fields, focus indicators, text explanations alongside statuses, responsive widths and live status messaging.
- **Privacy:** No account, no analytics, no database, no intentionally persisted medication list. Queries are sent to FDA over the internet.
- **Resilience:** Request timeout, error messaging, 404/rate-limit handling; multiple label candidates reduce dependence on one record.
- **Portability:** Static website for GitHub Pages, with an additional self-contained HTML version for double-click use.

## 6. Data and technical boundaries

The app cannot establish which of several marketed products the user actually takes. It does not prove that a product was involved in any symptom, quantify risks, evaluate timing, account for other illnesses, or establish real drug-drug interactions. FDA labeling fields may be missing, irregular, dated, or organized as tables. The API may return incomplete coverage of relevant variants. **No is not a medical safety conclusion.**

## 7. Manual acceptance tests

| Input | Expected behavior to inspect |
|---|---|
| `rosuvastain` | Suggest `rosuvastatin`; don't auto-correct |
| `insuli` | Suggest `insulin` |
| `insulin` | Ask for specific insulin product; show no per-symptom results |
| `rosuvastatin` + `glucose increase` | Check positive glucose/HbA1c wording against live cited label excerpts |
| `rosuvastatin` + `muscle pain` | Check myalgia wording and source |
| `insulin aspart` + `glucose decrease` | Check hypoglycemia language and source |
| `insulin aspart` + `glucose increase` | Inspect whether mention is an adverse effect or conditional warning |
| Nonsense drug name | Show lookup failure rather than misleading **No** |
| Offline / blocked network | Show meaningful unable-to-check error rather than a blank screen |

Do not treat these as guaranteed medical outputs. The test objective is to check whether observed outputs match the *actual fetched text and context*.

## 8. Planned improvements

1. Product-level identification using manufacturer, strength, dosage form and package identity.
2. Better detection of contextual warnings and negated or tabular statements.
3. More complete and audited label retrieval with explicit search coverage indicators.
4. Automated API integration tests using carefully reviewed, anonymized fixtures.
5. Accessibility evaluation and privacy review prior to wider distribution.

### Current source-link policy
PDF links are generated from openFDA SPL `set_id` identifiers and point to DailyMed's latest PDF for that labeling SET ID. FDA-hosted approved labeling PDFs are not deterministically derivable from arbitrary openFDA records. A missing SET ID falls back to structured FDA data.

### FDA PDF source links

The display retrieves approved-label PDF URLs from the separate Drugs@FDA API by application number, when available. Results are based on FDA-submitted structured labels and may not exactly correspond to the FDA-approved PDF. Missing PDF links fall back to the FDA Drugs@FDA official search page.


### Latest-label coverage (November 2026)
The application paginates openFDA search matches and groups versions by `set_id`, retaining the newest `effective_time` per label lineage. It no longer stops at eight records. API pagination limits, connectivity failures, and a 38-second per-medication time budget can make a search incomplete; in that case, a negative result is shown as **Unable to check**, not definitive **No**. This is not an authoritative guarantee of all FDA-approved product labeling.


### Product-aware results (update)

- Resolve names from brand, generic, ingredient or labeling name fields.
- Retrieve pages within timeout/pagination limits; preserve completeness status.
- Deduplicate by SPL SET ID, keeping the most recent effective date per SET ID.
- Classify ingredients, dosage form and route. For a single-ingredient generic search, exclude combinations. Keep brand-associated products distinct.
- If multiple non-equivalent formulations/routes remain, request more specific input; do not conflate their evidence.
- Show one compact symptom summary with the supporting excerpt and source link.
- Source is FDA-hosted application labeling PDF if linked from Drugs@FDA; otherwise exact FDA structured label link. Application PDFs are not guaranteed to be the SPL revision used in matching.


### PDF versus structured data

The app links directly to an FDA-hosted prescribing-information PDF **only when** the Drugs@FDA API returns a document URL under an FDA domain for the corresponding application. Otherwise it explicitly offers **FDA label data (JSON)**. That structured data is not a formatted PDF. Application-level prescribing information may not be identical to the specific SPL record used for the symptom result.


### Status and scope
Separate deliberately excluded incompatible product groups from failed/incomplete API searches. Do not label a completed compatible-group search as incomplete solely because other formulations exist. Limit No to the selected compatible product group. The generic term insulin requires a more specific name and suppresses symptom rows.


## Current source-link behavior (simplified)
MedSymp shows detected FDA label passages inline and links to the FDA FDALabel search page for manual verification. It does not guarantee exact-version or PDF deep links. See `docs/LABEL_SOURCES.md`.


Current revision: a server-side FDA application verification endpoint (`/api/approval`) supplements browser lookup in deployed versions. Matching words are highlighted in red using safe text nodes.
