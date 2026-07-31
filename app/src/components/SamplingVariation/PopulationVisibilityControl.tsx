import type { CSSProperties } from 'react'
import {
  POPULATION_VISIBILITY_OPTIONS,
  type PopulationVisibility,
} from './d3/populationVisibility'

type PopulationVisibilityControlProps = {
  value: PopulationVisibility
  onChange: (mode: PopulationVisibility) => void
  style?: CSSProperties
}

/** Compact Show / Fuzz / Hide control for the Data (P1) pane header. */
export function PopulationVisibilityControl({
  value,
  onChange,
  style,
}: PopulationVisibilityControlProps) {
  return (
    <div
      className="absolute z-10 flex items-center gap-0.5 rounded border border-gray-200 bg-white/95 p-0.5 text-xs shadow-sm"
      style={style}
      role="group"
      aria-label="Population visibility"
    >
      {POPULATION_VISIBILITY_OPTIONS.map(({ value: option, label }) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
              selected
                ? 'bg-gray-800 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => onChange(option)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
