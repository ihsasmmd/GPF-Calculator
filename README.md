# GPF Calculator — Installable Web App (PWA)

A personal GPF ledger, passbook and final-report generator that installs
straight from the browser — no app store, no Android Studio, no build step.
Plain HTML/CSS/JS, so you can host it anywhere that serves static files.

## What you get

- Installs to the home screen with its own icon (Chrome on Android: menu →
  "Install app" / "Add to Home screen"; it'll usually prompt automatically too).
- Works fully **offline** after the first visit (a service worker caches the app).
- Tracks **one GPF account** — month-by-month ledger, rate chart, and a final
  consolidated report. New passbooks default to opening in fiscal year
  **2026-27**.
- **PDF export** of the final report, generated entirely on-device (no
  external library, no network call — works with the phone in airplane mode).
- **Backup / restore** to a JSON file, using the native share sheet on
  Android/iOS where available, or a plain download otherwise.
- **Optional 4-digit PIN lock** on the app itself (the closest equivalent to
  biometric lock that's available to a plain web page — there's no real
  fingerprint API for websites the way there is for native apps).
- **Delete All Data** — a Danger Zone on the Cover tab wipes the passbook and
  every year of ledger data from the device, with a confirmation prompt.
- All your data stays on your device (`localStorage`) — nothing is sent
  anywhere.

## Why hosting is needed (and why HTTPS)

Browsers only allow "Add to Home Screen" as a **real installable app**
(offline support, standalone window, no browser address bar) when the site is
served over HTTPS — or from `localhost` while you're testing. Opening the
HTML file directly (`file://…`) works for viewing, but the browser won't
register the service worker or offer to install it. So you need any static
file host. Two free, no-fuss options:

### Option A — GitHub Pages (recommended, free, permanent)

1. Create a new GitHub repository and upload everything in this folder to it
   (or `git init`, commit, and push).
2. Repository → **Settings → Pages** → Source: "Deploy from a branch" →
   branch `main`, folder `/ (root)` → Save.
3. GitHub gives you a URL like `https://yourname.github.io/gpf-passbook/`.
   Open it on your phone in Chrome.
4. Chrome should show an "Install" prompt, or use the menu (⋮) →
   **"Install app"**.

### Option B — Netlify Drop (fastest, no account strictly required)

1. Go to https://app.netlify.com/drop in a browser.
2. Drag this whole folder onto the page.
3. Netlify gives you an instant HTTPS URL — open it on your phone and install
   the same way.

### Option C — test locally first

```bash
# from inside this folder
python3 -m http.server 8080
```

Then open `http://localhost:8080` on the same computer (or use your phone on
the same Wi-Fi with your computer's local IP instead of `localhost`, though
some install features may need HTTPS even then — GitHub Pages/Netlify are the
reliable route for actually installing it on your phone).

## Installing on your Android phone

1. Open the hosted URL in **Chrome**.
2. Tap the **⋮** menu → **"Install app"** (or you'll see an automatic banner).
3. It now sits on your home screen with its own icon and opens full-screen,
   like any other app — and keeps working offline from then on.

## Updating it later

Just edit the files and re-upload/re-push. Bump `CACHE_VERSION` in
`service-worker.js` (e.g. `gpf-passbook-v2`) whenever you change any cached
file, so installed copies pick up the update — otherwise the service worker
may keep serving the old cached version for a while.

## Project structure

```
index.html              — entry point, registers the service worker
manifest.webmanifest     — makes the app installable (name, icons, colors)
service-worker.js        — offline caching
css/styles.css           — the passbook/ledger design system
icons/                   — app icons (192px, 512px, maskable)
js/
  data/rateTable.js      — official GPF rate chart + revision dates
  lib/gpfCalc.js         — all GPF math (rates, monthly balances, interest)
  lib/storage.js         — load/save app data (localStorage)
  lib/pinLock.js         — optional PIN app-lock (SHA-256 hashed, via Web Crypto)
  lib/fileExport.js      — download / Web Share API / file picker
  lib/pdfWriter.js        — minimal, dependency-free PDF byte-writer (no network needed)
  lib/pdfExport.js       — builds the GPF report PDF using pdfWriter.js
  components/render.js   — HTML templates for each screen
  app.js                 — state, event handling, rendering — the whole app
```

No `npm install`, no bundler, no CDN — every JS file is loaded directly as a
native ES module (`<script type="module">` in `index.html`), and the PDF
export has zero external dependencies, so it works fully offline.

## Updating GPF rates in future years

Edit `js/data/rateTable.js`:

- Add a new entry to `REV_DATES` (effective year/month).
- Add the new rate to the end of each BPS row in `RATE_TABLE`.
- Add the new fiscal year's interest rate to `DEFAULT_INTEREST` if known, or
  just type it into the Ledger tab's "Interest Rate" field when the time comes.

Re-deploy (re-push/re-drag the folder) and bump `CACHE_VERSION` as above.

## Publishing to the Play Store (optional, beyond sideloading)

Sideloading the APK (covered above) is enough for personal use. If you want
it listed on the Play Store instead:

1. **Package as an AAB**, not an APK — in PWABuilder, choose the Android App
   Bundle output instead of APK. Keep the generated signing keystore safe;
   every future update must be signed with the same key.
2. **Digital Asset Links** — PWABuilder also generates an `assetlinks.json`
   file. Host it at `https://you.github.io/gpf-passbook/.well-known/assetlinks.json`
   (create a `.well-known` folder in the repo) so the app opens full-screen
   instead of showing a browser address bar.
3. **Play Console account** — one-time $25 fee at play.google.com/console.
4. **Store listing assets** — included in this project under `store-assets/`:
   - `play-store-icon-512.png` — 512×512 app icon
   - `feature-graphic-1024x500.png` — 1024×500 store banner
   - `privacy-policy.html` (repo root) — host it the same way as everything
     else here; its live URL (`https://you.github.io/gpf-passbook/privacy-policy.html`)
     goes into the Play Console listing. Edit the placeholder contact email
     in it first.
5. **Data safety form** in Play Console — since nothing leaves the device,
   answer "No data collected."
6. Upload the AAB, fill in the content rating questionnaire, and submit —
   an internal testing track first is recommended before a public release.
