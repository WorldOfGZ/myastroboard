#### MyAstroShine integration

Round-trip an Astrodex photo through
[MyAstroShine](https://github.com/myastroboard/myastroshine) for re-processing and get the
enhanced result back as a **new picture on the same object** - the original is never modified or
replaced.

- **New connector card** in Parameters -> Connectors: MyAstroShine base URL, access token and
  signing secret (both masked in every API response, blank = keep current), an optional
  callback-URL override for reverse-proxy deployments, and a "copy the source photo's rating"
  toggle. A server-side reachability test button probes `<url>/api/health`.
- **"Send to MyAstroShine"** action on every photo you own: opens MyAstroShine in a new tab with
  the image and its full metadata (equipment, location, exposure, date, notes...) already loaded
  into an edit session.
- On the way back, the enhanced image is added as a **duplicated picture** on the same item,
  keeping the source photo's frozen metadata snapshot and stamped with immutable provenance
  fields (`enhanced_by`, `enhanced_at`, `enhanced_from_picture_id`, `enhanced_parameters`,
  `enhanced_source_version`). The Edit Photo modal shows a discreet "Re-processed with
  MyAstroShine" note, dated, with the parameters behind a *view settings* disclosure.
- The Astrodex view **refreshes itself** when you switch back from the MyAstroShine tab - the new
  picture appears and a toast confirms it, no manual reload.
- **"Pull + webhook" architecture**: the browser carries a signed, single-use, 12-hour handoff
  token; MyAstroShine then talks to the board server-to-server (HMAC-signed) to read the source
  image and post the result. Works both when everything is on one LAN and when the board is
  remote behind an HTTPS reverse proxy. The browser makes no cross-origin request - nothing to
  add to the CSP and no CORS to open.
- New endpoints under `/api/astrodex/integration/*` (documented in `docs/API_ENDPOINTS.md`);
  full feature doc at `docs/MYASTROSHINE.md`. It is **not** a `BaseConnector` - a bidirectional
  Astrodex feature that only stores its config alongside the connectors so it rides along in the
  backup ZIP.
- The Parameters -> Connectors intro text no longer implies every connector feeds the
  Observatory tab.

#### Astrodex

- The photo card and the photo detail view now show the linked equipment **combination name**
  (resolved live), falling back to the free-text device field only when no combination is set -
  previously a photo attached to a combination could show no equipment on its card at all.
- The photo action row (set-as-main, edit, delete, send-to-MyAstroShine, observation-log link)
  wraps cleanly on narrow cards instead of overflowing onto a broken second line.
