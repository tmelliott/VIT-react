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
