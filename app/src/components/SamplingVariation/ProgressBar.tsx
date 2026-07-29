export function ProgressBar({
  progress,
  visible,
}: {
  progress: number
  visible: boolean
}) {
  return (
    <div
      className={`h-8 w-full ${visible ? '' : 'invisible'}`}
      role="progressbar"
      aria-valuenow={progress}
      aria-hidden={!visible}
    >
      <div className="h-2 overflow-hidden rounded bg-gray-200">
        <div
          className="h-full bg-blue-500 transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Computing samples… {progress}%
      </p>
    </div>
  )
}
