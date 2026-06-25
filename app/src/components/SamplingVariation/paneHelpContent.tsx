import type { ReactNode } from 'react'
import type { StatKind } from './types'
import type { VariableSupport } from './variableSupport'

export type PaneHelpContext = {
  paneIndex: 0 | 1 | 2
  variableSupport: VariableSupport
  statistic: 'mean' | 'median'
  nGroups: number
  statKind: StatKind
  sampleSize: number
}

function statSymbol(statistic: 'mean' | 'median'): string {
  return statistic === 'median' ? 'M' : 'x̄'
}

function grandStatLabel(statistic: 'mean' | 'median'): string {
  return statistic === 'median' ? 'population median' : 'population mean'
}

/** Shared note: population visible but treated as unknown during sampling. */
function populationPhilosophyNote(): ReactNode {
  return (
    <p>
      Your dataset is treated as the <strong>population</strong>. Although it is visible here,
      the sampling process treats it as <em>unknown</em> — as in a real study where you cannot
      observe the whole population before sampling.
    </p>
  )
}

/** Shared note: SRS without replacement, no prior knowledge of levels. */
function samplingPhilosophyNote(): ReactNode {
  return (
    <p>
      Samples are drawn <strong>without replacement</strong> from the pooled population, with no
      prior knowledge of existing group levels or proportions. Each individual can appear at most
      once per sample.
    </p>
  )
}

function p1OneNum(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const sym = statSymbol(ctx.statistic)
  const label = ctx.statistic === 'median' ? 'median' : 'mean'
  return {
    summary: (
      <p>
        The full dataset — treated as the <strong>population</strong>. Each dot is one
        observation. The summary statistic marks the <strong>{label}</strong> of all values; this
        is the parameter sample estimates will vary around.
      </p>
    ),
    details: (
      <>
        {populationPhilosophyNote()}
        <p>
          With <em>n</em> observations <em>x</em>
          <sub>1</sub>, …, <em>x</em>
          <sub>n</sub>:
        </p>
        {ctx.statistic === 'mean' ? (
          <p className="font-mono text-[0.95em]">
            {sym} = (1/<em>n</em>) Σ<sub>i=1</sub>
            <sup>n</sup> <em>x</em>
            <sub>i</sub>
          </p>
        ) : (
          <p className="font-mono text-[0.95em]">
            M = median(<em>x</em>
            <sub>1</sub>, …, <em>x</em>
            <sub>n</sub>)
          </p>
        )}
        <p>
        The soft gray reference in the sample and sampling-distribution panes is this same
        value.
        </p>
      </>
    ),
  }
}

function p1TwoGroup(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const sym = statSymbol(ctx.statistic)
  return {
    summary: (
      <p>
        The full population split by group. Each group has its own {ctx.statistic}; the summary
        is the <strong>difference</strong> between the two group statistics (higher group minus
        lower group, ordered by population stat).
      </p>
    ),
    details: (
      <>
        {populationPhilosophyNote()}
        <p>
          For groups 1 and 2 with {ctx.statistic}s {sym}
          <sub>1</sub> and {sym}
          <sub>2</sub> (ordered so {sym}
          <sub>2</sub> ≥ {sym}
          <sub>1</sub>):
        </p>
        <p className="font-mono text-[0.95em]">
          Δ = {sym}
          <sub>2</sub> − {sym}
          <sub>1</sub>
        </p>
        <p>
          Arrows above the axis show this difference on the same scale as the data. The P3
          reference line is the population difference Δ.
        </p>
      </>
    ),
  }
}

function p1MultiGroup(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const sym = statSymbol(ctx.statistic)
  const grand = grandStatLabel(ctx.statistic)
  return {
    summary: (
      <p>
        The full population with <em>K</em> = {ctx.nGroups} groups. The dashed vertical line is
        the {grand}. The summary is the <strong>average deviation</strong>: mean arrow length
        from each group stat to that centre.
      </p>
    ),
    details: (
      <>
        {populationPhilosophyNote()}
        <p>
          Let {sym}
          <sub>k</sub> be the group {ctx.statistic} and {sym} the overall {ctx.statistic} of
          the whole population. With <em>K</em> groups:
        </p>
        <p className="font-mono text-[0.95em]">
          D = (1/<em>K</em>) Σ<sub>k=1</sub>
          <sup>K</sup> |{sym}
          <sub>k</sub> − {sym}|
        </p>
        <p>
          Blue arrows show |{sym}
          <sub>k</sub> − {sym}| for each group. The label “Average deviation = …” is{' '}
          <em>D</em>. The gray reference line in P3 marks this population value.
        </p>
      </>
    ),
  }
}

function p2Content(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const n = ctx.sampleSize
  const sampling =
    ctx.variableSupport === 'one_num'
      ? 'simple random sample without replacement'
      : 'simple random sample without replacement from the pooled population'

  const summary = (
    <p>
      One random sample of size <strong>{n}</strong>: {sampling}. Grey dots are the chosen
      observations; markers show the sample statistic (same definition as P1, but computed from
      the sample only).
    </p>
  )

  const details = (
    <>
      {samplingPhilosophyNote()}
      <p>
        Each time you press Go, a new sample is drawn: <em>n</em> distinct individuals from the
        population (without replacement), so no row appears twice in one sample.
      </p>
      {ctx.variableSupport === 'num_cat' && ctx.nGroups >= 3 && (
        <p>
          For multiple groups, sample group {ctx.statistic}s are compared to the{' '}
          <strong>{grandStatLabel(ctx.statistic)}</strong> from P1 (fixed centre), not the
          sample&apos;s own overall {ctx.statistic}. If a group is missing from the sample,
          it is omitted from the average deviation (divided by the number of groups present).
        </p>
      )}
      {ctx.variableSupport === 'num_cat' && ctx.nGroups === 2 && (
        <p>
          Group statistics are computed within each group; the sample summary is the difference
          between the two sample group stats (same ordering as P1).
        </p>
      )}
      {ctx.variableSupport === 'one_num' && (
        <p>
          The sample {ctx.statistic} is compared visually to the population {ctx.statistic}{' '}
          (gray reference line).
        </p>
      )}
      <p>
        Earlier samples leave faint stat lines so you can see how estimates change from draw to
        draw.
      </p>
    </>
  )

  return { summary, details }
}

function p3OneNum(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const sym = statSymbol(ctx.statistic)
  return {
    summary: (
      <p>
        Each dot is the sample {ctx.statistic} from one replicate. Stacking shows how often
        similar values occur. The gray reference line is the population {sym} from P1 — with many
        replicates, the pile should centre near it, illustrating <strong>sampling variation</strong>.
      </p>
    ),
    details: (
      <>
        <p>
          This pane demonstrates the core goal of the module: how sample estimates vary from
          draw to draw, and how they cluster around the true population parameter.
        </p>
        <p>
          After Confirm, the module pre-computes 1000 samples. Each contributes one value (sample{' '}
          {ctx.statistic}) to this distribution.
        </p>
        <p>
          This is the <strong>sampling distribution</strong> of the sample {ctx.statistic}: the
          pattern of variation you would see if you repeated sampling many times from the same
          population.
        </p>
        <p>
          For a large number of replicates, the average of the dots should be close to the
          population {ctx.statistic} (unbiased estimators).
        </p>
      </>
    ),
  }
}

function p3TwoGroup(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const sym = statSymbol(ctx.statistic)
  return {
    summary: (
      <p>
        Each dot is the sample difference ({sym}
        <sub>2</sub> − {sym}
        <sub>1</sub>) from one replicate. The gray line is the population difference from P1.
      </p>
    ),
    details: (
      <>
        <p>
          Every replicate: draw a sample → compute both group {ctx.statistic}s → take the
          difference. One dot per replicate, up to 1000.
        </p>
        <p className="font-mono text-[0.95em]">
          Δ* = {sym}
          <sub>2</sub>
          * − {sym}
          <sub>1</sub>*
        </p>
        <p>
          The sampling distribution shows how much sample differences vary around the true
          population difference.
        </p>
      </>
    ),
  }
}

function p3MultiGroup(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const sym = statSymbol(ctx.statistic)
  return {
    summary: (
      <p>
        Each dot is one replicate&apos;s <strong>average deviation</strong> — the same measure
        as P1, but using sample group stats. The gray line is the population value{' '}
        <em>D</em> from P1.
      </p>
    ),
    details: (
      <>
        <p>For each replicate, with population centre {sym} (fixed from P1):</p>
        <p className="font-mono text-[0.95em]">
          D* = (1/<em>K</em>) Σ<sub>k=1</sub>
          <sup>K</sup> |{sym}
          <sub>k</sub>* − {sym}|
        </p>
        <p>
          where {sym}
          <sub>k</sub>* is the sample {ctx.statistic} in group <em>k</em>. Because sample group
          stats are noisy, <em>D</em>* often varies <strong>above</strong> as well as below{' '}
          <em>D</em>; the peak may sit slightly to the right of the reference line, especially
          when the sample size is small relative to the number of groups.
        </p>
        <p>
          This pane combines all 1000 replicate statistics into one picture of sampling
          variability.
        </p>
      </>
    ),
  }
}

function emptyPane(ctx: PaneHelpContext): { summary: ReactNode; details: ReactNode } {
  const labels = ['Data', 'Sample', 'Sampling distribution'] as const
  return {
    summary: (
      <p>
        Select variables and confirm settings to see the {labels[ctx.paneIndex]} pane in action.
        This module explores <strong>sampling variation</strong>: how sample statistics differ
        when you repeatedly draw random samples from a fixed population.
      </p>
    ),
    details: (
      <>
        {populationPhilosophyNote()}
        {samplingPhilosophyNote()}
        <p>
          Choose a numeric primary variable (and optionally a grouping variable), set sample size
          and statistic, then click Confirm.
        </p>
      </>
    ),
  }
}

export function paneHelpContent(ctx: PaneHelpContext): {
  summary: ReactNode
  details: ReactNode
} {
  if (ctx.variableSupport === 'empty' || ctx.variableSupport === 'unsupported') {
    return emptyPane(ctx)
  }

  if (ctx.paneIndex === 0) {
    if (ctx.variableSupport === 'one_num') return p1OneNum(ctx)
    if (ctx.nGroups === 2) return p1TwoGroup(ctx)
    return p1MultiGroup(ctx)
  }

  if (ctx.paneIndex === 1) {
    return p2Content(ctx)
  }

  // P3
  if (ctx.variableSupport === 'one_num') return p3OneNum(ctx)
  if (ctx.nGroups === 2) return p3TwoGroup(ctx)
  return p3MultiGroup(ctx)
}
