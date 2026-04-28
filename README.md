# VIT React

**Visual Inference Tools** rebuilt with **React**, **RserveTS**, and **rserve-ts**: R holds the session and statistics; the browser renders a **JSON scene** (population / sample / statistic bands) with **D3** transitions and **Motion** for panel motion.

## Prerequisites

- R with packages: `Rserve`, `RserveTS`, `jsonlite`
- Node 20+ (for the Vite app)

## R server

```bash
cd server
# Regenerate TypeScript after changing vit.R or R/* (from repo root you can use npm run r:compile in VIT-react)
Rscript -e "RserveTS::ts_compile('vit.R'); RserveTS::ts_deploy('vit.R')"
Rscript vit.rserve.R
```

Default WebSocket: `http://localhost:6311` (Rserve with `websockets = TRUE`).

## Web app

```bash
npm install
# Optional: point at a custom Rserve URL
# export VITE_RSERVE=http://127.0.0.1:6311
npm run dev
```

After changing the R app, run:

```bash
npm run r:compile
```

This runs `ts_compile` / `ts_deploy` in `server/` and copies [server/vit.rserve.ts](server/vit.rserve.ts) to [src/lib/vit.rserve.ts](src/lib/vit.rserve.ts).

## Tests

- **R:** from `server/`, `Rscript tests/test-scene.R` (requires `testthat`)
- **TypeScript:** `npm test` (Zod scene parsing)

## Docs

- [MODULE_FEATURES.md](MODULE_FEATURES.md) — module × feature matrix
- [docs/flows/FLOWS.md](docs/flows/FLOWS.md) — mermaid flowcharts per module

## Layout

- [server/vit.R](server/vit.R) — Rserve app entry, `sys.source` of `R/*`
- [server/R/vit_session.R](server/R/vit_session.R) — `createWidget` **VitSession**
- [src/scene/schema.ts](src/scene/schema.ts) — Zod schema for `sceneJson` / `gatingJson`
- [src/components/VitSessionPanel.tsx](src/components/VitSessionPanel.tsx) — upload, controls, `useWidget`
- [src/components/VitSceneCanvas.tsx](src/components/VitSceneCanvas.tsx) — D3 + Motion band plots
