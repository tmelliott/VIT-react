import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { defaultDatasetExample } from '../datasets/examples'
import { useVitApp } from './useVitApp'
import type { AppSearch } from '../searchParams'

export function useDatasetFromUrl() {
  const { state, methods } = useVitApp()
  const search = useSearch({ strict: false }) as AppSearch
  const navigate = useNavigate()
  const loadedUrlRef = useRef<string | null>(null)
  const [draftUrl, setDraftUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const urlInput = draftUrl ?? search.url ?? ''

  const updateUrlSearch = useCallback(
    (url: string) => {
      void navigate({
        to: '.',
        search: (prev: AppSearch) => ({ ...prev, url }),
        replace: true,
      })
    },
    [navigate],
  )

  const loadDataset = useCallback(
    async (url: string, syncUrl: boolean) => {
      if (!methods?.load_dataset || url.trim() === '') return
      setLoading(true)
      try {
        await methods.load_dataset(url)
        loadedUrlRef.current = url
        setDraftUrl(null)
        if (syncUrl) {
          updateUrlSearch(url)
        }
      } finally {
        setLoading(false)
      }
    },
    [methods, updateUrlSearch],
  )

  useEffect(() => {
    if (!methods?.load_dataset || !search.url) return
    if (loadedUrlRef.current === search.url) return

    void loadDataset(search.url, false)
  }, [search.url, methods, loadDataset])

  const loadExample = useCallback(() => {
    const example = defaultDatasetExample
    setDraftUrl(example.url)
    void loadDataset(example.url, true)
  }, [loadDataset])

  const hasData = state.dsInfo.nrows > 0

  return {
    urlInput,
    setUrlInput: setDraftUrl,
    loadDataset: (url: string) => loadDataset(url, true),
    loadExample,
    loading,
    hasData,
    dsInfo: state.dsInfo,
    placeholder: defaultDatasetExample.url,
    exampleLabel: defaultDatasetExample.label,
  }
}
