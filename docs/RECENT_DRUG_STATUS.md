# Recently approved medications — result display

MedSymp checks openFDA first, then attempts structured labeling and an FDA application lookup. If a **verified** official label or application exists but the browser cannot retrieve suitable machine-readable safety text, the UI shows:

**Analysis unavailable**

> Official FDA labeling found. Automated analysis is not yet available. Please review the labeling or check back later.

The result displays no symptom-level Yes/No because it has not analyzed the safety text. The app hides technical details about the SPL relay, cross-origin access, and timeouts from the result. Internal errors are not interpreted as evidence that a medication is safe.

When no official labeling or application has been verified, the app **does not** claim labeling was found. It instead asks the user to verify the name or search Drugs@FDA.

The standalone HTML remains limited by browser restrictions. Deployment of the included same-site API can enable XML-based analysis; this change simplifies the results but does not overcome those restrictions.
