# VIT modules and `stat.method` coverage

This table extends the architecture plan: every `stat.method` key is defined in the R package [../vit/R/load-functions.R](../vit/R/load-functions.R). **Phase 1** in this repo implements only **Sampling variation** and **Bootstrap** with a reduced surface (1D numeric `x` first; mean/median in R core).

| Module (UI name) | `e$method` in vit | `stat.method` keys (loadStatDetails) | Phase in VIT-react |
|------------------|-------------------|--------------------------------------|-------------------|
| Randomisation variation | `permvar` | `permvar.mean.diff`, `permvar.mean.anova`, `permvar.median.diff`, `permvar.median.anova`, `permvar.proportion.diff`, `permvar.proportion.anova` | 2+ |
| Randomisation tests | `permutation` | `permutation.mean.diff`, `permutation.mean.paired`, `permutation.median.*`, `permutation.proportion.*`, `permutation.mean.anova`, `permutation.median.anova`, `permutation.slope.regression` | 2+ |
| **Sampling variation** | `sampvar` | `sampvar.default`, `sampvar.default.diff`, `sampvar.mean`, `sampvar.mean.diff`, `sampvar.median*`, `sampvar.LQ*`, `sampvar.UQ*`, `sampvar.proportion*`, `sampvar.IQR*`, `sampvar.slope.regression` | **1 (partial)** |
| **Bootstrap CIs** | `bootstrap` | `bootstrap.mean*`, `bootstrap.median*`, `bootstrap.proportion*`, `bootstrap.LQ*`, `bootstrap.UQ*`, `bootstrap.IQR*`, `bootstrap.slope.regression` | **1 (partial)** |
| CI coverage | `ci` | `ci.mean`, `ci.median`, `ci.proportion` (see `load_CI_*`) | 2+ |

**Common (all modules):** dataset load → variable roles (x, optional y, group) → gating of controls → “record” → resample/accumulate. The web app uses **Rserve** + **RserveTS** `VitSession` and a JSON **scene** (see [src/scene/schema.ts](src/scene/schema.ts)) instead of R `grid` graphics.
