# YapCord for macOS

YapCord is a Vencord-style mod for the Yapper desktop app: plugins, themes and extra
settings on top of the official Yapper client. This guide covers **macOS only** —
building a YapCord app yourself from source. **You need an actual Mac for this** —
a proper macOS app bundle can't be reliably built from Windows or Linux.

## Requirements

- **A Mac** (Intel or Apple Silicon — see the Apple Silicon note below).
- **Node.js** 18 or newer — install via [nodejs.org](https://nodejs.org), or with Homebrew (`brew install node`).
- **Xcode Command Line Tools** (`xcode-select --install` in Terminal, if you don't have them already — needed by some native build steps).
- An internet connection the first time you build.

Check Node is installed:

```bash
node -v
npm -v
```

## 1. Get the source

Download the YapCord source (zip, or `git clone` the repo) and extract it, then
open Terminal **in the extracted folder** (the one that directly contains
`package.json`). Install dependencies once:

```bash
npm install
```

## 2. Build the app

This repo's `package.json` only has ready-made build scripts for Windows and
Linux — macOS needs one extra, explicit `electron-builder` command instead of
an `npm run` shortcut:

```bash
npx --yes electron-builder --mac zip
```

Output lands in `dist/`, as something like `YapCord-<version>-mac.zip`
(the exact name depends on your Mac's chip — see below).

> No code signing is configured, so this produces an **unsigned** app. That's
> fine for running it yourself; see "First launch" below for the one extra click
> Gatekeeper will ask for.

### Apple Silicon (M1/M2/M3/...) vs Intel

By default, electron-builder builds for the chip you're running it on. To build
for the other architecture (e.g. you're on an M-series Mac but want an Intel
build too), add `--x64` or `--arm64`:

```bash
npx --yes electron-builder --mac zip --x64     # Intel
npx --yes electron-builder --mac zip --arm64   # Apple Silicon
```

You can run both commands one after another to get both in `dist/`.

## 3. Install and run it

1. Unzip the `.zip` from `dist/` — you'll get `YapCord.app`.
2. Drag `YapCord.app` to `/Applications` (or wherever you keep apps).
3. Double-click it to launch.

### First launch (Gatekeeper warning)

Because the app isn't signed/notarized by Apple, the first launch will show a
warning that it "cannot be opened because it is from an unidentified developer"
(or similar). To get past this **once**:

- **Right-click (or Control-click) `YapCord.app` → Open → Open** in the dialog that follows, or
- Go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to the YapCord warning.

After that first approval, it opens normally from then on (double-click works).

## 4. Updating to a new version

Grab the new source, extract it somewhere fresh (don't mix old and new files),
run `npm install` again if `package.json`'s dependencies changed, and repeat
step 2. Replace the old `YapCord.app` in `/Applications` with the new one.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npx electron-builder --mac zip` fails right away | Run `npm install` first if you haven't, and make sure you're in the folder that directly contains `package.json`. |
| "cannot be opened because it is from an unidentified developer" | Expected for an unsigned app — right-click → Open → Open once (see "First launch" above). |
| App built but won't launch, no error shown | Try launching from Terminal instead, to see the real error: `/Applications/YapCord.app/Contents/MacOS/YapCord` |
| Wrong chip architecture (e.g. "bad CPU type in executable") | Rebuild with the matching `--x64` or `--arm64` flag for your Mac (see above). |
| Build fails downloading electron-builder's pieces | Check your internet connection — the first build needs to fetch some tooling. |
