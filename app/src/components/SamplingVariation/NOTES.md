# Sampling Variation — parity & pedagogy notes

## Pedagogical goal (research summary, June 2025)

The module lets students explore **sampling variation**: repeated random samples from a **fixed, visible population** produce different sample statistics. P1 shows population parameters; P2 shows one sample at a time; P3 builds the **sampling distribution** of the statistic across many replicates. This prepares later VIT modules (bootstrap, randomisation tests) that reuse the same three-pane visual grammar.

> “An appreciation of the variation produced by random sampling is a central foundation for motivating statistical inferences…” — [VIT overview](https://www.stat.auckland.ac.nz/~wild/VIT/overview.html)

### Is our approach valid?

**Yes**, for intro visual inference:

| Design choice | Verdict |
|---|---|
| SRS **without replacement** from pooled population | Correct — matches desktop VIT; distinct from bootstrap (with replacement from sample) |
| P3 reference = **population parameter** from P1 | Correct — “variation about the true (population) value” |
| K≥3: average deviation with **population grand mean** as centre | Correct — matches VITonline; same arrows as P1 |
| K≥3: P3 peak **right of** reference line | Often **expected** (noisy sample group stats vs fixed population centre), not necessarily a bug |
| Resample until all groups present | **Differs from desktop** (desktop uses stat 0 for missing groups) — decide parity vs cleaner pedagogy |

### K ≥ 3 formulas (recommended — match desktop)

**Population (P1 label, P3 red line):**

\[
D_{\text{pop}} = \frac{1}{K}\sum_{k=1}^{K} \left|\text{stat}_k^{\text{(pop)}} - \text{stat}^{\text{(pop)}}_{\text{grand}}\right|
\]

**Each replicate (P3 dot):**

\[
D^{*} = \frac{1}{K}\sum_{k=1}^{K} \left|\widehat{\text{stat}}^{*(k)} - \text{stat}^{\text{(pop)}}_{\text{grand}}\right|
\]

Use **population grand stat** as centre — **not** the sample grand mean.

Wild et al. describe the multi-group measure as the “average length of the group-deviation arrows” — [bootstrap/inference design notes (PDF §5.2)](https://www.stat.auckland.ac.nz/~wild/TEMP/bootstrap.pdf).

### Key references

- [VIT home](https://www.stat.auckland.ac.nz/~wild/VIT/) · [Overview](https://www.stat.auckland.ac.nz/~wild/VIT/overview.html)
- [ISR-15 teaching page](https://www.stat.auckland.ac.nz/~wild/ISR-15/) (sampling vs bootstrap videos)
- Wild et al. (2017), *Accessible Conceptions of Statistical Inference*, [Intl Statistical Review](https://onlinelibrary.wiley.com/doi/10.1111/insr.12117)
- [Exercise 5.13 — sampling variation](https://www.stat.auckland.ac.nz/~wild/d2i/exercises/5.13%20exercise-explore-sampling-variation-numeric_vitonline16.pdf)
- [SERC — Reese’s Pieces sample vs sampling distribution](https://serc.carleton.edu/quantskills/teaching_methods/datasim/examples/reeses.html)
- Pfannkuch et al. (2015), *Students' emergent reasoning about sampling variability*, [Educ Stud Math](https://eric.ed.gov/?id=EJ1052242)

---

## Open implementation decisions

## Desktop VIT vs VIT-react implementation

Sources: `VITonline/samplingVariation/`, `VITonline/shared/bases/visBase.js`, `VITonline/shared/helperFunctions.js` vs `server/modules/sampling_*.R` and `app/src/components/SamplingVariation/`.

### Sampling mechanics

| Aspect | Desktop VIT | VIT-react (current) |
|---|---|---|
| **Draw method** | `pickRand(n, N)` — simple random sample **without replacement** (`helperFunctions.js`) | `sample.int(N, n, replace = FALSE)` — matches |
| **Replicates** | 1000 (`visBase.numSamples`) | 1000 (`NUM_REPS`) |
| **Sample unit** | Draw `sampleSize` individuals from pooled `allPop`, then bucket into fixed group slots | Same idea: draw indices, use `population_group` |
| **All groups required (K ≥ 3)** | **No** — missing groups contribute stat `0` via empty `sample[g]` → `getStatistic` returns 0 | **Yes** — resample until every level appears (`sample_has_all_groups`) |
| **Multiple groups (K = 2)** | No explicit guard; empty group → stat 0 | Resample until ≥ 2 groups present |
| **Animation index pool** | All 1000 samples stored in memory (`this.samples`) | Only first **100** replicates store `sample_indices` (`ANIM_POOL_SIZE`); stats computed for all 1000 |
| **Index reuse for rep ≥ 100** | Full sample data for every rep | `getSampleIndices`: `replicate % 100` for indices but `sample_stats[rep]` for P3 stat → **P2 animation can disagree with P3 dot for rep ≥ 100** (known bug) |

### Statistics (numeric × categorical)

| Aspect | Desktop VIT | VIT-react (current) |
|---|---|---|
| **K = 1** | Sample = mean/median of drawn values; reference = population mean/median | Same (`sampling_one_num.R`) |
| **K = 2** | Difference = stat(group 2) − stat(group 1); ordered groups by population stat | Same (`order_group_levels`, difference) |
| **K ≥ 3 population parameter** | `averageDeviation` from population group stats vs **population grand** stat | `population_summary_stat()` — same formula |
| **K ≥ 3 sample stat** | Mean of \|sample group stat − **population grand** stat\| over **all K group slots** (0 if group absent) | Mean of \|sample group stat − **population grand** stat\| over **present levels only** (after all-groups resampling) |
| **Group ordering** | Fixed group list from data setup | Levels sorted by population group stat (`order_group_levels`) |
| **Median** | Sort items, average middle two (`getStatistic`) | R `stats::median` / `d3.median` — may differ slightly on even counts |

### P3 axis / scales (K ≥ 3 average deviation)

| Aspect | Desktop VIT | VIT-react (current) |
|---|---|---|
| **P3 domain (`sampleStatType == "Deviation"`)** | `[0, pop x-axis span]` (`visBase.setUpSamples`) | `[0, pop domain span]` via `distDomainAlignedToPop()` — matches intent |
| **Dot x-position** | `sampleStatScale(sampleStatistics[k].value)` | `distX(sample_stats[k])` — same scale when aligned |
| **Reference line** | `populationStatistic` (= `averageDeviation`) | `population_stat` / `displayPopulationStat` |
| **K = 2 P3 domain** | Symmetric diff scale centred at 0 | R sends symmetric domain; frontend uses it (not pop-aligned) |

### Animation / UX (implemented vs not)

| Feature | Desktop VIT | VIT-react |
|---|---|---|
| M = 1 / 5 / 20 / 1000 | Yes (`transitionSpeed`, batch jumps) | Yes |
| K ≥ 3 multi-stage P3 fly-in (group dev lines → avg dev line → dot) | `sharedMultiCatDistDrop` | `distArrowDrop.ts` (ported) |
| CI / tail overlays | Yes (`setUpCI`, `showCI`, 10k large CI) | **Not implemented** |
| Large CI (10,000 reps) | Some modules call `makeSample(..., 10000, ...)` | **Not implemented** |
| Two-proportion / two-cat / slope modules | Separate visualisation classes | **Not in scope** (num × cat + one num only) |
| Bootstrap module (`withinSample = true`) | Different resampling (full population per group) | N/A — sampling variation only |

### Other differences

- **Preview vs confirm:** React shows P1 population immediately; desktop builds on load. Both defer full sampling distribution until user runs samples.
- **Progress:** React pushes R compute progress; desktop computes client-side in `setUpSamples`.
- **README** still says “bootstrap samples” — desktop sampling variation uses SRS without replacement, not bootstrap (bootstrap is a separate VIT module).

---

## Files to compare when resolving parity

**Desktop**

- `VITonline/shared/bases/visBase.js` — core stat logic, P3 scale, 1000 reps
- `VITonline/shared/helperFunctions.js` — `pickRand`, `getStatistic`
- `VITonline/samplingVariation/Visualisations/sv_oneNumoneCat.js` — numeric × categorical (main reference)
- `VITonline/shared/sharedAnimations.js` — `sharedMultiCatDistDrop`

**VIT-react**

- `server/modules/sampling_num_cat.R`, `sampling_one_num.R`
- `app/src/components/SamplingVariation/d3/distArrowDrop.ts`
- `app/src/components/SamplingVariation/types.ts` — `getSampleIndices` pool logic
