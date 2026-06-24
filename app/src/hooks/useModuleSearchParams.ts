import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { SamplingVariationHook } from '../rserve/vit.types'
import type { AppSearch } from '../searchParams'

type ModuleSearchFields = Pick<
  AppSearch,
  'xvar' | 'yvar' | 'sampleSize' | 'statistic'
>

export function useModuleSearchParams({
  variables,
  groupVariables,
  hasData,
  set,
  onConfigChange,
}: {
  variables: string[]
  groupVariables: string[]
  hasData: boolean
  set: SamplingVariationHook['set']
  onConfigChange?: () => void
}) {
  const search = useSearch({ strict: false }) as AppSearch
  const navigate = useNavigate()
  const prevSearchRef = useRef<ModuleSearchFields>({})

  const updateSearch = useCallback(
    (patch: Partial<ModuleSearchFields>) => {
      void navigate({
        to: '.',
        search: (prev: AppSearch) => ({ ...prev, ...patch }),
        replace: true,
      })
    },
    [navigate],
  )

  useEffect(() => {
    if (!hasData || variables.length === 0) return

    const prev = prevSearchRef.current
    const next: ModuleSearchFields = {
      xvar: search.xvar,
      yvar: search.yvar,
      sampleSize: search.sampleSize,
      statistic: search.statistic,
    }

    if (
      search.xvar &&
      search.xvar !== prev.xvar &&
      variables.includes(search.xvar)
    ) {
      void set('xvar', search.xvar)
    }
    if (search.yvar !== undefined && search.yvar !== prev.yvar) {
      const nextYvar =
        search.yvar === '' || groupVariables.includes(search.yvar)
          ? search.yvar
          : ''
      void set('yvar', nextYvar)
    }
    if (
      search.sampleSize !== undefined &&
      search.sampleSize !== prev.sampleSize
    ) {
      void set('sample_size', search.sampleSize)
    }
    if (search.statistic && search.statistic !== prev.statistic) {
      void set('statistic', search.statistic)
    }

    prevSearchRef.current = next
  }, [
    hasData,
    variables,
    groupVariables,
    search.xvar,
    search.yvar,
    search.sampleSize,
    search.statistic,
    set,
  ])

  const onXvarChange = useCallback(
    (value: string) => {
      onConfigChange?.()
      void set('xvar', value)
      updateSearch({ xvar: value || undefined })
    },
    [set, updateSearch, onConfigChange],
  )

  const onYvarChange = useCallback(
    (value: string) => {
      onConfigChange?.()
      void set('yvar', value)
      updateSearch({ yvar: value || undefined })
    },
    [set, updateSearch, onConfigChange],
  )

  const onSampleSizeChange = useCallback(
    (value: number) => {
      onConfigChange?.()
      void set('sample_size', value)
      updateSearch({ sampleSize: value })
    },
    [set, updateSearch, onConfigChange],
  )

  const onStatisticChange = useCallback(
    (value: string) => {
      onConfigChange?.()
      void set('statistic', value)
      if (value === 'mean' || value === 'median') {
        updateSearch({ statistic: value })
      }
    },
    [set, updateSearch, onConfigChange],
  )

  return {
    onXvarChange,
    onYvarChange,
    onSampleSizeChange,
    onStatisticChange,
  }
}
