# quick-gif

A pnpm monorepo holding two sibling apps that turn videos into GIFs/WebP, plus
the shared packages they're built on. Both are Next.js 16 + React 19 + Tailwind
v4, styled with the same Monokai Pro palette and branded **Quick Gif**.

- **`quick-gif-wasm-web`** — encodes entirely in the browser with ffmpeg.wasm.
- **`quick-gif-web-app`** — drives native ffmpeg and manages local files.

---

## Requirements

| Tool | Version | Needed by |
|---|---|---|
| **Node.js** | `>= 20.9.0` | both apps (Next 16 engine requirement) |
| **pnpm** | `10.7.0` (pinned via `packageManager`) | the workspace |
| **ffmpeg** + **ffprobe** | `>= 7.x` recommended, on `PATH` | **`quick-gif-web-app` only** |
| A modern browser with WebAssembly | — | `quick-gif-wasm-web` at runtime |

Notes:
- The **wasm app needs no system dependencies** — the ffmpeg core/wasm/worker and
  a font are self-hosted under `apps/quick-gif-wasm-web/public/ffmpeg`, so it runs
  offline and deploys to any static host. It uses the **single-threaded** core, so
  no `COOP`/`COEP` headers are required.
- The **native app shells out** to `ffmpeg`/`ffprobe` via `child_process`; both
  must be installed and on `PATH` (`brew install ffmpeg` on macOS). Heads-up:
  ffmpeg 7.x cannot *decode* animated WebP, so WebP outputs fall back to the full
  file for their grid thumbnail — this is expected, not a bug.
- Install with: `pnpm` (npm/yarn are not supported; see `packageManager`).

### Installing ffmpeg + ffprobe (native app only)

`ffprobe` ships inside the same package as `ffmpeg` on every mainstream
distribution, so installing ffmpeg gives you both. Pick your OS:

**macOS**
```bash
brew install ffmpeg          # Homebrew
# or: sudo port install ffmpeg   # MacPorts
```

**Windows** (run in an elevated terminal; reopen the shell afterwards so `PATH` updates)
```powershell
winget install Gyan.FFmpeg    # winget (built-in on Win 10/11)
# or: choco install ffmpeg     # Chocolatey
# or: scoop install ffmpeg     # Scoop
```
Prefer a manual install? Grab a build from <https://www.gyan.dev/ffmpeg/builds/>
or <https://github.com/BtbN/FFmpeg-Builds/releases>, unzip it, and add the `bin`
folder (containing `ffmpeg.exe` and `ffprobe.exe`) to your `PATH`.

**Linux**
```bash
sudo apt install ffmpeg       # Debian / Ubuntu
sudo dnf install ffmpeg       # Fedora (enable RPM Fusion first)
sudo pacman -S ffmpeg         # Arch
```

**Any OS** — official download index: <https://ffmpeg.org/download.html>

Verify both are found before running the native app:
```bash
ffmpeg -version
ffprobe -version
```

---

## Getting started

```bash
pnpm install            # install the whole workspace

pnpm dev:wasm           # run the browser app   (http://localhost:3000)
pnpm dev:web            # run the native app     (http://localhost:3000)

pnpm build              # build both apps
pnpm build:wasm         # build just one
pnpm build:web
```

Run one app at a time (both default to port 3000).

### Configuring the native app

`quick-gif-web-app` reads a JSON config from its **own working directory**
(`apps/quick-gif-web-app/giffer.config.json`). It's gitignored (local runtime
state). If absent, defaults are derived from `process.cwd()`. Fields:

| Field | Meaning |
|---|---|
| `watchDir` | folder scanned for source videos (the Library) |
| `outputDir` | where exports are written |
| `fps`, `width` | default export frame rate / max width (`0` = source / no cap) |
| `maxSizeMB`, `autoDownscale` | size budget and whether to shrink to meet it |
| `dedup` | skip writing an output identical (by hash) to an existing one |
| `naming` | filename template: `{timestamp}`, `{stem}`, `{n}` |
| `format` | default `gif` or `webp` |
| `cacheEnabled` | use the on-disk probe/thumbnail cache (`.giffer-cache/`) |

The wasm app has no server config — its settings live in `localStorage`.

---

## What the two apps share

Same editor UX in both (crop, trim, text overlays, color tint, named presets);
they differ only in where pixels get crunched and where files live.

| Capability | wasm-web | web-app |
|---|---|---|
| Upload a single video & edit | ✅ | ✅ |
| Crop / trim / text / tint / presets | ✅ | ✅ |
| Export GIF / WebP | ✅ (in browser) | ✅ (native ffmpeg) |
| Real progress bar | ✅ (ffmpeg.wasm progress) | ✅ (SSE from ffmpeg `-progress`) |
| Watch-folder **library** of local videos | — | ✅ |
| **Batch** convert many at once | — | ✅ |
| **Outputs** gallery + delete from disk | — | ✅ |
| Dedup, disk thumbnail/probe cache | — | ✅ |
| Runs with **no system dependencies** | ✅ | needs ffmpeg |
| Deploys as a static site | ✅ | needs a Node server |

---

## Shared packages

| Path | Package | Contents |
|---|---|---|
| `packages/core` | `@quick-gif/core` | Engine-agnostic logic: the ffmpeg **filtergraph builder** (`buildPreChain`, `colorFilter`, `textFilters`, `fitDimensions`, `dimsAt`, `singlePassGifChain`), shared value **types** (`ColorFilter`, `TextLayer`, `CropRect`, `ExportParams`, presets…), plus `time` and `naming` helpers. |
| `packages/ui` | `@quick-gif/ui` | Shared React: primitives (`button`, `field`, `accordion`, `toggle-row`, `preset-row`) and the presentational editor components under `@quick-gif/ui/edit` (`player`, `timeline`, `controls`, `crop-overlay`, `text-overlay`, `text-controls`, `render-progress`). |

Packages ship as TS/TSX **source** — no build step. Each app lists them in
`transpilePackages`, and each `globals.css` has an `@source` directive so
Tailwind scans the UI package (it ignores `node_modules` by default). Shared
dependency versions (React/Next/Tailwind/…) are pinned once in the `catalog:`
block of `pnpm-workspace.yaml`, so the two apps can't drift apart.

### What is deliberately *not* shared
The two engines (`engine.ts` in wasm, `ffmpeg.ts` in native), the export/estimate
buttons (in-browser vs SSE), settings storage (localStorage vs the server
`giffer.config.json`), routes, API handlers, and each app's editor shell. The
filtergraph **string** is shared; how each app runs it is not.

---

## Layout

```
quick-gif/
├─ pnpm-workspace.yaml     # apps/* + packages/* + a dependency catalog
├─ tsconfig.base.json      # both apps extend it
├─ apps/
│  ├─ quick-gif-wasm-web/  # browser ffmpeg.wasm app
│  └─ quick-gif-web-app/   # native ffmpeg app (library / batch / outputs)
└─ packages/
   ├─ core/                # @quick-gif/core
   └─ ui/                  # @quick-gif/ui  (+ ui/src/edit)
```

---

## License

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-only) —
see [`LICENSE`](./LICENSE). In short: you may use, modify, and redistribute it,
but if you run a modified version as a network service, you must offer its
source to that service's users.
