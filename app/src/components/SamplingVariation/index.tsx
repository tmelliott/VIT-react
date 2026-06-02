import { useWidget } from '@tmelliott/react-rserve'
import type { TVitApp } from '../../rserve/vit.rserve'

type TSamplingVariationModule = Awaited<
  ReturnType<TVitApp['vitWidget']>
>['children']['samplingVariation']

export function SamplingVariation({
  module,
}: {
  module: TSamplingVariationModule
}) {
  const { state } = useWidget(module)

  if (!state) return <>Loading ...</>;

  return (
    <div>
      <h1>Sampling Variation</h1>
    </div>
  )
}
