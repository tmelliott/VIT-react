export function ProgressBar({
  progress,
  visible,
}: {
  progress: number
  visible: boolean
}) {
  if (!visible) return null

  return (
    <div className="w-full" role="progressbar" aria-valuenow={progress}>
      <div className="h-2 rounded bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 mt-1">Computing samples… {progress}%</p>
    </div>
  )
}
