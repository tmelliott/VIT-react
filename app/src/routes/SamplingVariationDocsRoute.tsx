import { Link } from '@tanstack/react-router'
import { ModuleHeader } from '../components/SamplingVariation/ModuleHeader'

export function SamplingVariationDocsRoute() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <ModuleHeader />

      <article className="mx-auto w-full max-w-3xl space-y-8 pb-8 text-sm leading-relaxed text-gray-700">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#094b85]">What this module does</h2>
          <p>
            Sampling Variation lets you explore how <strong>sample statistics vary</strong> when
            you take repeated random samples from a fixed dataset. The three-pane display shows
            the population (Data), one sample at a time (Sample), and the distribution of many
            sample statistics (Sampling Distribution).
          </p>
        </section>

        <section className="space-y-3 rounded-md border border-blue-100 bg-blue-50/60 p-4">
          <h2 className="text-lg font-semibold text-[#094b85]">Core philosophy</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Your data is the population.</strong> The dataset you supply is treated as
              the entire population for this visualisation. While it is visible on screen, we
              deliberately treat it as <em>unknown</em> for the purposes of sampling — as if you
              were sampling from a real-world population you cannot fully observe.
            </li>
            <li>
              <strong>Sample without replacement.</strong> Each sample is a simple random sample
              (SRS) <em>without replacement</em>, mimicking a realistic sampling process where
              each individual can appear at most once in a sample. This is distinct from
              bootstrapping, which resamples <em>with</em> replacement from an observed sample.
            </li>
            <li>
              <strong>No prior knowledge of population parameters.</strong> When drawing a sample,
              the module does not use information about existing population levels — for example,
              when a categorical grouping variable is specified, we do not assume knowledge of
              which levels exist or their proportions in the population. Samples are drawn from
              the pooled population; group membership follows whatever individuals are selected.
            </li>
            <li>
              <strong>Demonstrate variability.</strong> The goal is to show how sample estimates
              differ from draw to draw, and how they cluster around (or spread away from) the true
              population parameter. The red reference line in the Sample and Sampling Distribution
              panes marks the population value from the Data pane — the benchmark against which
              sample estimates are compared.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#094b85]">The three panes</h2>
          <dl className="space-y-4">
            <div>
              <dt className="font-semibold text-gray-900">Data (P1)</dt>
              <dd className="mt-1">
                Shows the full population: every observation as a dot, with the population
                summary statistic (mean, median, difference, or average deviation). This is the
                “truth” we compare samples against — visible to you as the learner, but treated as
                unknown during the sampling process.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900">Sample (P2)</dt>
              <dd className="mt-1">
                One random sample of the chosen size. Grey dots are the selected observations;
                markers show the sample statistic computed from that sample alone. Press Go to draw
                another sample. Faint traces of earlier sample statistics remain so you can see
                variation across draws.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900">Sampling Distribution (P3)</dt>
              <dd className="mt-1">
                After you click Confirm, the module pre-computes 1000 replicate samples. Each dot
                is one replicate&apos;s sample statistic. The pile shows the pattern of variation
                you would see if sampling were repeated many times from the same population.
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#094b85]">Variable configurations</h2>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 font-semibold">Configuration</th>
                <th className="px-3 py-2 font-semibold">Sample statistic</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">One numeric variable</td>
                <td className="px-3 py-2">Sample mean or median</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">Numeric + categorical (2 groups)</td>
                <td className="px-3 py-2">Difference between group means/medians</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">Numeric + categorical (3+ groups)</td>
                <td className="px-3 py-2">Average deviation from population grand mean/median</td>
              </tr>
            </tbody>
          </table>
          <p>
            For grouped data, groups are ordered by their population statistic (lower group
            subtracted from higher). With three or more groups, the average deviation uses the{' '}
            <strong>population grand statistic</strong> as a fixed centre — not the sample&apos;s
            own overall statistic.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#094b85]">Workflow</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Load a dataset (URL or file).</li>
            <li>
              Choose a numeric primary variable and, optionally, a categorical secondary variable
              for grouping.
            </li>
            <li>Set sample size and statistic (mean or median).</li>
            <li>
              Click <strong>Confirm</strong> to compute the population display and pre-generate
              1000 replicate samples.
            </li>
            <li>
              Use <strong>Sampling</strong> to animate individual samples in P2, and{' '}
              <strong>Sampling Distribution</strong> to build the pile of replicate statistics in
              P3.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#094b85]">Sampling method</h2>
          <p>
            All samples use simple random sampling <strong>without replacement</strong> from the
            pooled population (<code className="rounded bg-gray-100 px-1">sample.int(N, n, replace = FALSE)</code>{' '}
            in R). Each replicate draws <em>n</em> distinct individuals. For grouped data, group
            statistics are computed from whichever individuals happen to be in the sample — we do
            not stratify or balance group representation.
          </p>
          <p>
            This matches the original VITonline Sampling Variation module and differs from the
            separate Bootstrap module, which resamples with replacement from an observed sample.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#094b85]">Current scope</h2>
          <p>This release implements the numeric layouts from the original VITonline module:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>One numeric variable — sample mean or median</li>
            <li>Numeric + categorical (2 groups) — difference of group statistics</li>
            <li>Numeric + categorical (3+ groups) — average deviation from population grand statistic</li>
          </ul>
          <p>
            Not yet implemented: categorical-only layouts (proportion), two categorical variables,
            regression slope, quartiles, IQR ratio, t-tests, theoretical distribution overlays, and
            confidence-interval shading. See{' '}
            <code className="rounded bg-gray-100 px-1">docs/sampling-variation-status.md</code> in
            the repository for a full feature matrix.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#094b85]">Further reading</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <a
                className="text-blue-600 hover:underline"
                href="https://www.stat.auckland.ac.nz/~wild/VIT/overview.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                VIT overview
              </a>
            </li>
            <li>
              <a
                className="text-blue-600 hover:underline"
                href="https://www.stat.auckland.ac.nz/~wild/ISR-15/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ISR-15 teaching resources (sampling vs bootstrap)
              </a>
            </li>
            <li>
              <Link to="/sampvar" search={(prev) => prev} className="text-blue-600 hover:underline">
                Back to the module
              </Link>
            </li>
          </ul>
        </section>
      </article>
    </div>
  )
}
