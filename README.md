# Digital Diary

A private, password-protected diary that runs as a **website**, a **Windows desktop app**, and an **Android app** — all from one shared codebase.

```
dairy/
├── src/                 # React app (shared by all platforms)
├── website/             # Promo/landing site (deploy target for the whole site)
│   ├── index.html       # One-page promo site
│   └── releases/        # .exe installer + .apk for download
├── electron/            # Desktop shell (main.cjs + preload.cjs)
├── android/             # Capacitor Android project (gitignored, regenerated)
├── scripts/             # Icon/splash generator (no dependencies)
├── assets/              # Source icons & splashes for @capacitor/assets
└── dist/                # Vite build output (gitignored)
```

## Prerequisites

- Node.js 18+
- For the **Windows .exe**: nothing extra (electron-builder downloads what it needs)
- For the **Android APK**: Java JDK 17+ and an Android SDK (Android Studio install works)

## Quick commands

| What | Command |
|---|---|
| Web dev server | `npm run dev` |
| Build web app | `npm run build` |
| Preview web build | `npm run preview` |
| Open desktop app in dev | `npm run electron:dev` |
| Build Windows installer + portable .exe | `npm run electron:build` |
| Regenerate all icons/splashes | `npm run icons` |
| Sync web build into Android | `npm run cap:sync` |
| Open Android project in Android Studio | `npm run cap:android` |
| Build debug APK | `npm run cap:apk` |
| Serve promo website locally | `npm run website` |

## Build outputs

| Artifact | Location |
|---|---|
| Windows installer | `release/Digital Diary Setup 1.0.0.exe` |
| Portable .exe | `release/Digital Diary 1.0.0.exe` |
| Android APK (debug) | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Promo site + downloads | `website/` |

## Desktop app (Windows .exe)

```bash
npm run electron:build
```

- Installs to `release/` — both an NSIS **installer** and a **portable** .exe
- App icon: `electron/icons/icon.ico` (regenerate with `npm run icons`)
- Config lives in the `build` section of `package.json`
- Note: binaries are unsigned, so Windows SmartScreen may show a warning — click "More info → Run anyway". Proper code signing requires a certificate.

## Android app (APK)

```bash
npm run cap:apk        # builds android/app/build/outputs/apk/debug/app-debug.apk
```

- Debug APK installs on any Android 6+ phone (enable "Install unknown apps" for your browser/file manager)
- First Gradle run downloads dependencies; if `services.gradle.org` times out on your network, this project's wrapper already points at the Tencent mirror in `android/gradle/wrapper/gradle-wrapper.properties`
- For a **release APK** (smaller + Play Store ready):
  1. Create `android/keystore.jks` and set signing properties (Android Studio: Build → Generate Signed Bundle/APK)
  2. Run `cd android && gradlew.bat assembleRelease`

## Promo website

Dependency-free static pages:

- **`website/index.html`** — small intro/home page: logo, one-line pitch, big **Download for Windows** / **Download for Android** buttons, web-app link
- **`website/features.html`** — full page: real app screenshots in the hero (clickable thumbnails), feature cards, FAQ, downloads

Test locally with `npm run website` (or `npx serve website`).

**Regenerating the screenshots** (drives the real app, seeds demo entries, captures every screen):

```bash
taskkill //IM electron.exe //F   # close any running instance first
node scripts/screenshot-site.cjs   # writes website/assets/shots/*.png
node scripts/verify-shots.cjs      # sanity-checks the captures
```

**Deploying to Vercel** (project is already wired for it):

- `vercel.json` sets everything: build command (`npm run vercel-build`) and output directory (`website`)
- The web app is built and copied to `website/app/`, so it deploys as part of the same project
- Result: intro page at `/`, features page at `/features`, web app at `/app/`, APK at `/releases/digital-diary-1.0.0.apk`

```bash
npx vercel login        # one-time authentication
npx vercel --prod       # deploy from the project root
```

### Downloads & releases

- The **Windows .exe** is hosted on **GitHub Releases** (free, 2 GB/file) — the site links to `github.com/VISHNU2407-hub/dairy/releases/latest/download/DigitalDiary-Setup.exe`, so it always serves the newest release. The `.exe` is gitignored to keep the repo/deploy small.
- The **Android APK** ships with the website at `website/releases/`.
- **Automated releases**: push a version tag and GitHub Actions builds both artifacts and publishes the release:

  ```bash
  git tag v1.0.1 && git push origin v1.0.1
  ```

  The workflow (`.github/workflows/release.yml`) builds the installer + APK on a Windows runner and attaches them with stable names: `DigitalDiary-Setup.exe`, `DigitalDiary-Portable.exe`, `DigitalDiary.apk`.

## Branding

- App name: **Digital Diary** (`appId` / package id: `com.digitaldiary.app`)
- The 📖 book icon is drawn programmatically — edit `scripts/generate-icons.cjs` and run `npm run icons`, then `npx @capacitor/assets generate --android` to refresh Android res, and `npm run electron:build` to re-embed the Windows icon.
