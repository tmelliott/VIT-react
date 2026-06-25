# VIT React

Visual Inference Tools (VIT) rebuilt with React, RserveTS, and D3.

## Dev workflow

Two terminals:

```bash
# Terminal 1 — R server (from app/)
cd ws1_tools/VIT/VIT-react/app
bun run compile && bun run rserve

# Terminal 2 — Vite dev server
cd ws1_tools/VIT/VIT-react/app
bun install
bun run dev
```

Open http://localhost:5173, open **Sampling Variation**, load a dataset (or click **Use example**), choose variable / sample size / statistic, click **Confirm**, then use animation controls.

Shareable module URLs use query params, e.g. `/sampvar?url=https%3A%2F%2F...&xvar=size&sampleSize=30`. A dataset is loaded automatically only when `url` is present; otherwise use **Load dataset** or **Use example**.

## Security (future work)

Dataset import accepts an http(s) URL from the user and passes it to R `load_dataset()`, which fetches and reads the file. Before any public or multi-tenant deployment, add defence in depth:

- **R server:** validate URL scheme (http/https only), block private/metadata IP ranges and `file://`, optionally allowlist hosts.
- **Proxy:** fetch datasets in a sandboxed fetcher rather than letting R open arbitrary URLs (SSRF risk).
- **Frontend:** current zod validation is UX-only; do not rely on it for security.

Track implementation when deployment model is decided.

## Local packages

`rserve-ts` (0.9.3) and `@tmelliott/react-rserve` (0.10.2) are installed from npm. After changing those libraries, reinstall and restart Vite.

## Sampling Variation (v1)

One numeric variable, mean or median. R pre-computes 1000 bootstrap samples on Confirm; React animates through them with M = 1 / 5 / 20 / 1000 in sampling and sampling-distribution modes.

After editing R modules in `server/`, run `bun run compile` to regenerate `app/src/rserve/vit.rserve.ts`.

TypeScript: the generated schema is checked with `@ts-nocheck` (full `z.infer` OOMs tsc). App types are in `src/rserve/vit.types.ts`. Run `bun run typecheck` for a fast check; `bun run build` uses Vite only.

## Deploy (single container)

The React app and Rserve run together in one image: **nginx** serves the Vite build and proxies `/rserve` to Rserve on `localhost:6311`. The browser reads the Rserve URL from **`RSERVE_HOST`** (runtime) via `public/rserve-config.js`; local dev uses **`VITE_RSERVE_HOST`** in `.env` instead. All app code goes through `getRserveHost()` in `src/lib/rserveHost.ts`.

On Railway, set **`HOSTNAME`** to your public URL (or rely on **`RAILWAY_PUBLIC_DOMAIN`**, which the entrypoint picks up automatically) and the browser connects to `wss://<hostname>/rserve`.

### Docker (local smoke test)

```bash
cd ws1_tools/VIT/VIT-react
docker build -t vit-react .
docker run --rm -p 8080:8080 vit-react
```

Open http://localhost:8080 — the app should connect to Rserve without a separate server process.

### Railway

One service replaces a two-service setup (static app + separate Rserve).

1. Set the Railway service **root directory** to `ws1_tools/VIT/VIT-react`.
2. Builder: **Dockerfile** (see `railway.toml`).
3. Deploy:

   ```bash
   cd ws1_tools/VIT/VIT-react
   railway link    # once
   railway up -m "VIT React"
   ```

4. Generate a public domain in the Railway dashboard.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | Set by Railway automatically |
| `HOSTNAME` | — | Public site URL (e.g. `https://vit.up.railway.app`); browser uses `wss://…/rserve` |
| `RAILWAY_PUBLIC_DOMAIN` | — | Railway sets this; used when `HOSTNAME` is unset |
| `RSERVE_PATH` | `/rserve` | Path appended when deriving from `HOSTNAME` |
| `RSERVE_HOST` | derived | Override WebSocket URL/path entirely (skips `HOSTNAME` logic) |

Local Docker without `HOSTNAME` falls back to same-origin `/rserve`. Override `RSERVE_HOST` only if Rserve is on a different path or host.

### Architecture

```
Browser ──HTTPS──► nginx (:PORT)
                     ├─ /        → static dist/
                     └─ /rserve  → ws proxy → Rserve (:6311)
```
