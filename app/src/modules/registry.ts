export type VitModuleId = 'sampvar'

export type VitModuleDefinition = {
  id: VitModuleId | null
  path: string
  title: string
  description: string
  available: boolean
}

export const vitModules: VitModuleDefinition[] = [
  {
    id: 'sampvar',
    path: '/sampvar',
    title: 'Sampling Variation',
    description:
      'Take repeated samples without replacement from a population and see how sample statistics vary. The population is visible but treated as unknown during sampling.',
    available: true,
  },
  {
    id: null,
    path: '/bootstrap',
    title: 'Bootstrapping',
    description:
      'Resample from an observed sample to estimate uncertainty for a statistic.',
    available: false,
  },
  {
    id: null,
    path: '/randvar',
    title: 'Randomisation Variation',
    description:
      'Shuffle group labels to see how much a statistic would vary by chance alone.',
    available: false,
  },
  {
    id: null,
    path: '/randtest',
    title: 'Randomisation Test',
    description:
      'Use randomisation to assess evidence against a null hypothesis.',
    available: false,
  },
]

export function getModuleByPath(path: string): VitModuleDefinition | undefined {
  return vitModules.find((module) => module.path === path)
}

export function isAvailableModulePath(
  path: string,
): path is `/sampvar` {
  const module = getModuleByPath(path)
  return module?.available === true && module.id === 'sampvar'
}
