# Optional SPL relay setup

The standalone app cannot always retrieve DailyMed XML because browsers enforce cross-origin restrictions. This Worker securely relays **only two fixed DailyMed endpoints**, with input validation, size limits, and no user storage.

1. Create a free Cloudflare account and install Wrangler on a computer that supports Node.js, or use Cloudflare's Worker editor to paste `index.js`.
2. Publish the Worker; copy its `https://...workers.dev` URL.
3. In `script.js`, set `SPL_RELAY_BASE` to that URL. For the standalone Mac app, also set the same variable inside `double-click-version/Open MedSymp.html`.
4. Redeploy GitHub Pages, or reopen the standalone HTML. Check `/find?drug=zaynich` and `/spl/c84e652e-5e76-4568-8812-bd5fa34803b6` on the Worker URL.

Never use an open proxy that accepts arbitrary destination URLs. The Worker does not interpret medical meaning or guarantee the upstream service is reachable.

Without the relay, conventional openFDA searches continue to work. New-drug SPL matching can remain unavailable and must not be reported as a confirmed `No`.
