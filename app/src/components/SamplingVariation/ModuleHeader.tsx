import { Link } from '@tanstack/react-router'
import { RserveStatusIndicator } from '../RserveStatusIndicator'

type ModuleHeaderProps = {
  docsPath?: string
}

export function ModuleHeader({ docsPath = '/sampvar/docs' }: ModuleHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 sm:gap-3">
      <Link
        to="/"
        search={(prev) => prev}
        className="shrink-0 text-sm text-blue-600 hover:underline"
      >
        ← Modules
      </Link>
      <h1 className="min-w-0 truncate text-lg font-bold text-[#094b85] sm:text-xl">
        Sampling Variation
      </h1>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Link
          to={docsPath}
          search={(prev) => prev}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <svg aria-hidden className="h-4 w-4 shrink-0" viewBox="0 0 21 20">
            <use href="/icons.svg#documentation-icon" />
          </svg>
          <span className="hidden sm:inline">Documentation</span>
        </Link>
        <RserveStatusIndicator />
      </div>
    </header>
  )
}
