# Deploy MedSymp with automatic SPL fallback

1. Upload the contents of this folder to your GitHub repository.
2. In Vercel, import the GitHub repository and deploy. No build command is required.
3. Open the Vercel site, **not** `double-click-version/Open MedSymp.html`, for recently approved drugs.
4. Check the endpoint `/api/find?drug=rosuvastatin`. It should return DailyMed JSON.
5. Test matching excerpts for both older and new products; if the public source has no usable adverse-reactions sections, the UI will report analysis unavailable.

This endpoint is a read-only, fixed-host proxy. Do not change it to accept arbitrary upstream URLs.

**Limits:** This deployment does not guarantee every recently approved label is already indexed. Manual validation remains essential.
