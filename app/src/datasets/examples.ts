export type DatasetExample = {
  id: string
  label: string
  description: string
  url: string
}

/** Curated datasets for "Use example". Add more entries here over time. */
export const datasetExamples: DatasetExample[] = [
  {
    id: 'cas500',
    label: 'CAS 500',
    description: 'School sizes for 500 NZ schools',
    url: 'https://raw.githubusercontent.com/iNZightVIT/iNZightTools/refs/heads/dev/tests/testthat/cas500.csv',
  },
]

export const defaultDatasetExample = datasetExamples[0]
