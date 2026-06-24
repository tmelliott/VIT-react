import { Link } from '@tanstack/react-router'
import { useVitApp } from '../hooks/useVitApp'
import { SamplingVariation } from '../components/SamplingVariation'

export function SamplingVariationRoute() {
  const { children } = useVitApp()

  if (!children?.samplingVariation) {
    return (
      <p className="p-4 text-gray-600" role="alert">
        Sampling variation module is not available.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <header className="flex shrink-0 items-center gap-3">
        <Link
          to="/"
          search={(prev) => prev}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Modules
        </Link>
        <h1 className="text-xl font-bold text-[#094b85]">Sampling Variation</h1>
      </header>

      <SamplingVariation module={children.samplingVariation} />
    </div>
  )
}
