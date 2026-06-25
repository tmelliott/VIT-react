import { Link } from '@tanstack/react-router'

type ModuleHeaderProps = {
  docsPath?: string
}

export function ModuleHeader({ docsPath = '/sampvar/docs' }: ModuleHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-3">
      <Link
        to="/"
        search={(prev) => prev}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Modules
      </Link>
      <h1 className="text-xl font-bold text-[#094b85]">Sampling Variation</h1>
      <Link
        to={docsPath}
        search={(prev) => prev}
        className="ml-auto inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
      >
        <svg aria-hidden className="h-4 w-4 shrink-0" viewBox="0 0 21 20">
          <use href="/icons.svg#documentation-icon" />
        </svg>
        Documentation
      </Link>
    </header>
  )
}
