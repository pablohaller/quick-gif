# easy-gif

A pnpm monorepo holding two sibling apps that turn videos into GIFs/WebP, plus
the shared packages they're built on. Both are Next.js 16 + React 19 + Tailwind
v4, styled with the same Monokai Pro palette and branded **Quick Gif**.

## Apps

| Path | Package | What it is |
|---|---|---|
| `apps/easy-gif-wasm-web` | `easy-gif-wasm-web` | Fully client-side. Encodes in the browser with self-hosted **ffmpeg.wasm** — upload a video, edit, download. No server, deploys to any static host. |
| `apps/easy-gif-web-app` | `easy-gif-web-app` | Runs **native ffmpeg** via `child_process`. Adds a watch-folder library, batch mode, filesystem delete, an outputs gallery, dedup, and a disk thumbnail cache. Real export progress over SSE. |

Same editor UX in both (crop, trim, text overlays, color tint, presets); they
differ only in where the pixels get crunched and where files live.

## Shared packages

| Path | Package | Contents |
|---|---|---|
| `packages/core` | `@easy-gif/core` | Engine-agnostic logic: the ffmpeg **filtergraph builder** (`buildPreChain`, `colorFilter`, `textFilters`, `fitDimensions`, `dimsAt`, `singlePassGifChain`), shared value **types** (`ColorFilter`, `TextLayer`, `CropRect`, `ExportParams`, presets…), plus `time` and `naming` helpers. |
| `packages/ui` | `@easy-gif/ui` | Shared React: primitives (`button`, `field`, `accordion`, `toggle-row`, `preset-row`) and the presentational editor components under `@easy-gif/ui/edit` (`player`, `timeline`, `controls`, `crop-overlay`, `text-overlay`, `text-controls`, `render-progress`). |

Packages ship as TS/TSX **source** — no build step. Each app lists them in
`transpilePackages`, and `globals.css` has an `@source` directive so Tailwind
scans the UI package.

### What is deliberately *not* shared
The two engines (`engine.ts` in wasm, `ffmpeg.ts` in native), the export/estimate
buttons (in-browser vs SSE), settings storage (localStorage vs a server
`giffer.config.json`), routes, API handlers, and each app's editor shell. The
filtergraph **string** is shared; how each app runs it is not.

## Commands

```bash
pnpm install            # install the whole workspace

pnpm dev:wasm           # run the browser app
pnpm dev:web            # run the native-ffmpeg app (needs ffmpeg + ffprobe on PATH)

pnpm build              # build both apps
pnpm build:wasm         # build one
pnpm build:web
```

Shared dependency versions (React/Next/Tailwind/…) are pinned once in the
`catalog:` block of `pnpm-workspace.yaml`, so the two apps can't drift apart.

> The standalone `giffing-web/` and `giffer-app/` folders this monorepo was
> assembled from are kept as-is for reference; this repo has a fresh history.
