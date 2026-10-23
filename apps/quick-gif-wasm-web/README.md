# Quick Gif

Turn a video into an animated **GIF** or **WebP** — entirely in your browser.
Upload a clip, trim it, crop it, tint it, drop text on it, and export. There is
**no server and no upload**: all processing runs locally via
[ffmpeg.wasm](https://ffmpegwasm.netlify.app/), so your video never leaves your
device.

It's a browser-only port of a local desktop GIF tool — the editing UI is the
same, but the engine (native `ffmpeg`, a watch folder, an output folder) was
replaced with WebAssembly and browser storage.

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [How it works (architecture)](#how-it-works-architecture)
- [The editor](#the-editor)
- [Settings & presets](#settings--presets)
- [The render engine](#the-render-engine)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Limitations & notes](#limitations--notes)
- [Tech stack](#tech-stack)

---

## Features

- **Upload or drag-and-drop** any browser-readable video (MP4, WebM, MOV, …).
- **Trim** with a zoomable, scrubbable timeline (filmstrip of real poster
  frames), big touch-friendly in/out handles, and frame-accurate stepping.
- **Replay anchor** — drop a point the preview always loops from, even if it
  sits before the trim in-point.
- **Crop** with a draggable/resizable overlay that shows the selection size in
  source pixels (or a one-click centered 200×200 box).
- **Output format**: GIF or animated WebP.
- **Dimensions**: optional max width and/or max height (fit-to-box, aspect
  preserved, never upscaled; `0` keeps the original size).
- **Frame rate**: optional fps (omit to keep the source rate).
- **Color filter**: grayscale, or a color **tint** via **Multiply** / **Screen**
  blend modes — with a **live WYSIWYG preview** over the video.
- **Text layers**: multiple draggable text boxes burned into the output, each
  with its own size, color, and opacity.
- **File-size budget** with optional **auto-downscale** to meet it.
- **Presets** for text styles and color filters — named, renamable, saved to
  your browser, and portable via the settings JSON.
- **Size estimate** before exporting, with a progress bar, spinner, elapsed
  time, and rough ETA.
- **Settings** (defaults + presets) persisted to `localStorage` and
  **exportable/importable as JSON**.
- **Keyboard shortcuts**, a mute-by-default audio toggle, and
  **unsaved-progress warnings** when you reload or navigate away.

Everything is **offline-capable** — the ffmpeg core, worker, and the watermark
font are self-hosted, so there is no runtime CDN dependency.

---

## Quick start

Requirements: **Node 20+** and **pnpm** (`packageManager` pins pnpm 10.7.0).

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Other scripts:

```bash
pnpm build      # production build (Next + Turbopack)
pnpm start      # serve the production build
```

> First render fetches nothing from the network — the ~32 MB wasm core is served
> from `public/ffmpeg/`. Expect the **first** export to take a moment while the
> core initialises; subsequent renders reuse it.

---

## How it works (architecture)

Quick Gif is a **Next.js 16 (App Router) + React 19** app. There is no backend;
the two routes (`/` Studio and `/settings`) are static, and all work happens on
the client.

### In-browser ffmpeg

Rendering uses **ffmpeg compiled to WebAssembly** (`@ffmpeg/ffmpeg` +
`@ffmpeg/core`, single-threaded build). The single-threaded core needs **no**
COOP/COEP headers, so the app deploys to any static host.

A few deliberate choices in `src/lib/engine.ts`:

- **Self-hosted assets.** `public/ffmpeg/` contains the UMD loader
  (`ffmpeg.js`), the worker (`814.ffmpeg.js`), the core (`ffmpeg-core.js` +
  `ffmpeg-core.wasm.gz`), and a bundled font (`font.ttf`). Nothing is fetched
  from a CDN at runtime, so it works offline and never breaks when a CDN is slow
  or blocked.
- **Gzipped core wasm.** The core wasm ships pre-gzipped (`ffmpeg-core.wasm.gz`,
  ~10 MiB vs ~31 MiB raw) because some static hosts cap single assets at 25 MiB
  (e.g. Cloudflare Pages). `engine.ts` decompresses it in the browser via
  `DecompressionStream` and hands ffmpeg a `blob:` URL — the same mechanism
  `@ffmpeg/util`'s `toBlobURL` uses. To refresh it after upgrading `@ffmpeg/core`:
  `gzip -9 -c ffmpeg-core.wasm > ffmpeg-core.wasm.gz`.
- **Loaded via a `<script>` tag, not a bundler import.** The ESM entry of
  `@ffmpeg/ffmpeg` uses `new URL(classWorkerURL, import.meta.url)`, which
  bundlers (Turbopack/webpack) can't statically resolve. Loading the UMD build
  at runtime sidesteps that entirely.
- **No `classWorkerURL`.** Passing it makes the loader spawn a *module* worker,
  but the worker (`814.ffmpeg.js`) is a *classic* worker that calls
  `importScripts()`. Omitting it lets the loader resolve the classic worker
  itself. Core/wasm are passed as plain same-origin URLs.
- **The core runs in its own Web Worker**, so the UI thread never blocks during
  a render.

### Storage

There is no database. State lives in the browser:

- **Settings & presets** → `localStorage` (key `quick-gif.settings`), validated
  with a zod schema.
- **The video** → an in-memory object URL; it's never persisted or uploaded.
- **The exported file** → an object URL you download.

---

## The editor

Everything lives on one page (the **Studio**, `/`). The right column is a stack
of collapsible **accordions** (Output format, Dimensions, Frame rate, Color
filter, Text, File size); each shows its current value in the header so you can
read the whole config at a glance while collapsed.

### Playback & keyboard shortcuts

| Action | Control | Shortcut |
|---|---|---|
| Play / pause | button | **Space** |
| Step one frame | ◁ / ▷ Frame | **←** / **→** |
| Replay from in-point/anchor | Replay | — |
| Set in / out | Set in / Set out | — |

- The preview **loops the selection** precisely using `requestAnimationFrame`
  (the `timeupdate` event is too coarse and overshoots the out-point).
- **Audio is off by default** (checkbox to enable).
- **Replay on trim** re-previews when you move the handles.
- **Pause on click** optionally stops on the frame you click in the timeline.
- Video is **auto-paused** when the tab is hidden (switching macOS Spaces/tabs
  can otherwise leave it in a stuck "playing but frozen" state).

### Trim timeline

A zoomable track (buttons **and** scroll-to-zoom, centered on the cursor) with a
filmstrip of real poster frames generated in the browser (see
[thumbnails](#thumbnails)). Frames still generating show a subtle pulsing
skeleton. In/out points are big circular handles; the replay anchor is a
draggable orange handle.

### Crop & text overlays

Both are DOM layers over the `<video>`:

- **Crop** — drag to draw, drag the rect to move, corner handles to resize; a
  badge shows the pixel size. Clicking elsewhere keeps the existing selection.
- **Text** — each layer is a draggable box; the overlay is transparent to
  pointer events except the boxes, so the crop layer underneath still works.
  Font size uses CSS container-query units so it tracks the displayed frame.

---

## Settings & presets

### Settings model

`src/lib/settings.ts` stores a **partial** settings object. `format` and
`naming` are always present; every other field is **optional**, and *presence
means "this control is enabled by default."* The Studio seeds each field's
enable checkbox from which keys exist. Toggling a field in the Studio affects
**only the current creation** — it never writes back to your saved defaults.

Fields: `format`, `naming`, `width?`, `height?`, `fps?`, `maxSizeMB?`,
`autoDownscale?`, `filter?` (`{ mode, color }`), plus `textPresets?` and
`filterPresets?`.

### Naming template

The download filename is built from a template (default `giffer_{timestamp}`):

- `{timestamp}` → `YYYYMMDDHHMMSS` (keeps each export unique)
- `{stem}` → the source filename without extension

### Export / import

The Settings page can **export** the current settings as JSON, **download an
example**, or **import** a JSON (which replaces your defaults). A settings JSON
only lists the keys you want on, e.g.:

```json
{
  "format": "gif",
  "naming": "giffer_{timestamp}",
  "width": 640,
  "fps": 15,
  "maxSizeMB": 8,
  "autoDownscale": true,
  "filter": { "mode": "multiply", "color": "#ffcc66" }
}
```

### Presets

- **Text presets** store a text style (text, size, color, opacity); applying one
  adds a new text layer.
- **Filter presets** store a color filter (mode + color); applying one sets the
  active filter.
- Both have **editable names** (pencil icon) and are managed with the same row
  component in the Studio **and** in Settings. They persist to `localStorage`
  and travel in the settings JSON.

---

## The render engine

`src/lib/engine.ts` builds an ffmpeg filtergraph and runs it. The "pre" chain is:

```
crop → fps → scale → color filter → text (drawtext per layer)
```

- **Trim** uses fast input seek (`-ss` before `-i`) plus an explicit output
  **duration** (`-t = out − in`), which is unambiguous across ffmpeg builds.
- **Dimensions** are computed in JS: fit the (cropped) source inside the max
  width/height, preserving aspect ratio, **never upscaling**; `0`/unset = no cap.
  Output dimensions are rounded even.
- **Color filters** are single-stream `colorchannelmixer`: *multiply* =
  `in × color`; *screen* = `in·(1−color) + color` (using the alpha coefficient
  as the constant term). Grayscale is `hue=s=0`.
- **Text** → one `drawtext` per layer, remapped from normalized full-frame
  coordinates into the cropped+scaled output (text outside the crop is clipped).
- **GIF uses a two-pass, file-based palette** (`palettegen → palette.png →
  paletteuse`). This is far more memory-friendly in wasm than the single-command
  `split…palettegen` filter, which buffers every frame and could silently
  produce an empty file. **WebP** is a single streaming pass (`libwebp`).
- **Auto-downscale**: if a file-size budget is set and the output is over, the
  render retries up to 3× at progressively smaller dimensions.
- **Errors are surfaced**: ffmpeg.wasm's `exec` resolves even on failure, so the
  engine checks the exit code and throws on a non-zero code or an empty output,
  including the tail of the ffmpeg log.
- **Progress** is routed through a single listener, clamped to 0–100%, and the
  GIF's two passes are mapped into one continuous bar.

### Thumbnails

`use-thumbnails.ts` generates filmstrip frames entirely in the browser: a
dedicated offscreen `<video>` is seeked to each timestamp and drawn to a canvas,
cached by time. Seeks are serialized; a same-time short-circuit and a timeout
guard keep the queue from hanging (setting `currentTime` to its current value
fires no `seeked` event).

---

## Project structure

```
public/ffmpeg/            # self-hosted ffmpeg.wasm core, worker, loader, font
src/
  app/
    layout.tsx            # shell: Montserrat font, Monokai Pro theme, TopBar
    page.tsx              # "/" — the Studio
    settings/page.tsx     # "/settings"
    globals.css           # Tailwind v4 + Monokai Pro color tokens
  components/
    studio/
      studio.tsx          # the whole editor: state, playback, handlers
      top-bar.tsx         # brand, "New Gif", Settings link (+ leave guard)
      session-context.tsx # cross-component reset + unsaved-progress warnings
    edit/
      player.tsx          # <video> + crop/text overlays + WYSIWYG tint
      crop-overlay.tsx    # draggable/resizable crop
      text-overlay.tsx    # draggable text layers
      text-controls.tsx   # text layer list + presets
      controls.tsx        # format/dimensions/fps/color/filesize accordions
      timeline.tsx        # zoomable trim timeline + filmstrip
      use-thumbnails.ts   # in-browser poster-frame generator
      estimate-button.tsx # size estimate
      export-button.tsx   # render + download
      render-progress.tsx # progress bar + spinner + ETA
    settings/form.tsx     # settings editor + JSON import/export
    ui/                   # accordion, button, field, toggle-row, preset-row
  lib/
    engine.ts             # ffmpeg.wasm loader + filtergraph + render
    settings.ts           # localStorage settings + presets (zod)
    types.ts              # shared types (ExportParams, TextLayer, presets, …)
    naming.ts             # download filename templating
    routes.ts             # route constants
    time.ts               # time parsing/formatting
```

---

## Deployment

It's a standard Next.js app with **no server-side logic** and **no secrets**, so
any Next-capable host works (Vercel, Netlify, a static export behind a CDN, …).

The only requirement is that `public/ffmpeg/*` is served as static files. The
core wasm is decompressed client-side from `ffmpeg-core.wasm.gz`, so no special
MIME type is needed for it (the browser builds the `application/wasm` blob). The
gzipped core (~10 MiB) also stays under the 25 MiB per-file limit on hosts like
Cloudflare Pages. Because the core is single-threaded, **no COOP/COEP headers
are needed**.

---

## Limitations & notes

- **Memory / size.** ffmpeg.wasm is bounded by browser memory (~2–4 GB per tab)
  and is slower than native ffmpeg. Very large or long videos can be slow or
  fail; if a GIF truly can't fit, cap the dimensions or frame count.
- **Source fps** isn't readable in the browser, so frame-stepping falls back to
  30 fps (the exported fps is whatever you set).
- **Text preview is approximate.** The editor draws text with a web font; the
  export uses ffmpeg's libfreetype with the bundled DejaVu Sans. Position and
  relative size match; exact glyph metrics differ slightly. Each layer is a
  single line (newlines collapse to spaces) — use multiple layers for multiple
  lines.
- **Per-browser storage.** Settings, presets, and outputs live in the browser;
  clearing site data wipes them. Nothing syncs across devices.
- **Exotic containers** (e.g. MKV/AVI) may export but not preview if the browser
  can't play them in `<video>`.

---

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (Turbopack loader) with a **Monokai Pro** palette and the
  **Montserrat** font
- **ffmpeg.wasm** (`@ffmpeg/ffmpeg`, `@ffmpeg/core`, `@ffmpeg/util`)
- **zod** for settings validation · **lucide-react** for icons
- **pnpm** as the package manager
