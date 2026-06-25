import { Link } from '@tanstack/react-router'
import { vitModules } from '../modules/registry'
import { useRserveConnection } from '../hooks/useRserveConnection'

function rConnectionMessage(host: string, connectionStatus: string) {
  const waiting =
    connectionStatus === 'connecting' ? ' Please wait…' : ''
  return `Unable to connect to R at ${host}.${waiting} If this continues, contact the developers.`
}

export function LandingPage() {
  const { host, connectionStatus, isReady } = useRserveConnection()
  const showConnectionWarning = !isReady

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-8">
          <h1 className="font-bold tracking-tight">
            <span className="text-5xl text-[#094b85] sm:text-6xl">V</span>
            <span className="text-5xl text-[#18afe3] sm:text-6xl">I</span>
            <span className="text-5xl text-[#094b85] sm:text-6xl">T</span>
            <span className="ml-3 text-3xl text-[#094b85] sm:text-4xl">
              Online
            </span>
          </h1>
        </div>

        <p className="mb-10 text-left text-sm leading-relaxed text-gray-700 sm:text-base">
          Visual Inference Tools for teaching and exploring statistical
          inference. Choose a module below to work with sampling variation,
          bootstrapping, randomisation, and related ideas. Works best in modern
          browsers (Chrome, Firefox, Safari).
        </p>

        {showConnectionWarning ? (
          <p
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950"
            role="status"
          >
            {rConnectionMessage(host, connectionStatus)}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 text-left">
          {vitModules.map((module) => {
            const moduleReady = module.available && isReady

            if (moduleReady) {
              return (
                <Link
                  key={module.path}
                  to={module.path}
                  search={(prev) => prev}
                  className="group rounded-lg border border-[#094b85]/20 bg-white p-4 shadow-sm transition hover:border-[#18afe3] hover:shadow-md"
                >
                  <p className="text-lg font-semibold text-[#094b85] group-hover:text-[#18afe3]">
                    {module.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {module.description}
                  </p>
                </Link>
              )
            }

            return (
              <div
                key={module.path}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 opacity-60"
              >
                <p className="text-lg font-semibold text-gray-500">
                  {module.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {module.description}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {module.available ? 'Unavailable' : 'Coming soon'}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
