import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ThreePaneDisplay } from '../components/SamplingVariation/ThreePaneDisplay'
import { ProportionThreePaneDisplay } from '../components/SamplingVariation/ProportionThreePaneDisplay'
import { SlopeThreePaneDisplay } from '../components/SamplingVariation/SlopeThreePaneDisplay'
import {
  p1GalleryFixtures,
  type P1GalleryFixture,
} from '../fixtures/p1Gallery'

/** Visible height of the Data pane; inner shell is 3× so layout stays correct. */
const P1_PANE_HEIGHT_PX = 220

function P1Crop({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-full overflow-hidden rounded border border-gray-300 bg-white shadow-sm"
      style={{ height: P1_PANE_HEIGHT_PX }}
    >
      <div className="w-full" style={{ height: P1_PANE_HEIGHT_PX * 3 }}>
        {children}
      </div>
    </div>
  )
}

function FixtureCard({ fixture }: { fixture: P1GalleryFixture }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-semibold text-[#094b85]">{fixture.title}</h2>
        <p className="text-sm text-gray-600">{fixture.description}</p>
        <p className="mt-0.5 font-mono text-xs text-gray-400">{fixture.id}</p>
      </div>
      <P1Crop>
        {fixture.kind === 'numeric' ? (
          <ThreePaneDisplay {...fixture.props} />
        ) : fixture.kind === 'proportion' ? (
          <ProportionThreePaneDisplay {...fixture.props} />
        ) : (
          <SlopeThreePaneDisplay {...fixture.props} />
        )}
      </P1Crop>
    </section>
  )
}

export function PlotsGalleryRoute() {
  return (
    <div className="min-h-full overflow-y-auto bg-gray-50 px-4 py-6 md:px-8">
      <header className="mx-auto mb-8 max-w-4xl">
        <p className="mb-2 text-sm">
          <Link to="/" search={(prev) => prev} className="text-[#18afe3] hover:underline">
            ← VIT Online
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#094b85]">
          P1 plot gallery
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Mock population data only — no R connection required. Each card crops
          the three-pane shell to the Data pane for visual checking and graphic
          design.
        </p>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        {p1GalleryFixtures.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} />
        ))}
      </div>
    </div>
  )
}
