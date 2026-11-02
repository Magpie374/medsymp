# Deploy MedSymp to GitHub Pages

1. Sign in to GitHub and create a **new public repository** named `MedSymp` (or another available name).
2. Upload the **contents** of `MedSymp_GitHub_Ready` to the root of the repository (do not upload only the ZIP if you want Pages to work).
3. Commit the uploaded files.
4. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, `main`, and `/ (root)`, then save.
5. Once GitHub reports a published site address, open it and test an FDA request.

GitHub Pages deploys static content. No Python server, npm install or API key is required for this prototype. Use the HTTPS site; FDA lookups need a network connection and must be permitted by the FDA API's browser access policies.

## Privacy and publication checklist

- Never commit real patient medication lists, personal symptoms, user data or secret API keys.
- Keep example data generic. Browser requests to openFDA can reveal the queried medication/symptom text to the FDA service.
- Show the non-diagnostic limitation and do not claim FDA endorsement.
- Do not assume GitHub Pages makes this a clinically validated application.
- Check deployment on Safari and another browser, particularly the direct API requests and source links.

## No-code editing alternative

GitHub's website allows editing text files directly in the repository. That is independent of whether the desktop version of VS Code is supported on a Mac.
