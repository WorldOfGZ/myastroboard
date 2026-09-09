#### MyAstroShine integration

Send a photo from your Astrodex to [MyAstroShine](https://github.com/myastroboard/myastroshine)
for re-processing and bring the enhanced result back as a **new picture on the same object** - the
original is never touched.

- New **MyAstroShine** card in Parameters -> Connectors (base URL, token + signing secret, optional
  callback-URL override, "copy source rating" toggle). Secrets are masked in every API response.
- A "Send to MyAstroShine" action on each of your own photos opens MyAstroShine with the image and
  its metadata already loaded. When you send the result back it is added as a duplicate carrying the
  source photo's metadata snapshot plus immutable `enhanced_*` provenance fields; the Edit Photo
  modal shows a discreet "Re-processed with MyAstroShine" note. The AstroDex view refreshes itself
  when you switch back from the MyAstroShine tab - no manual reload.
- The AstroDex photo card and the photo detail view now show the linked equipment **combination**
  name (falling back to the free-text device only when no combination is set), and the photo action
  row wraps cleanly when it holds several buttons.
- "Pull + webhook" model: the browser opens MyAstroShine with a signed, single-use handoff token;
  the MyAstroShine container calls the board back server-to-server. Works whether both run on the
  same LAN or the board is remote behind a reverse proxy. No new CSP / CORS surface.
- New routes under `/api/astrodex/integration/*` (see `docs/API_ENDPOINTS.md`). New doc:
  `docs/MYASTROSHINE.md`.
