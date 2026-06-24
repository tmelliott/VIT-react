import RserveClient from 'rserve-ts'
import vitAppSchema from '../src/rserve/vit.rserve.ts'

const DEFAULT_URL =
  'https://raw.githubusercontent.com/iNZightVIT/iNZightTools/refs/heads/dev/tests/testthat/cas500.csv'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Rserve js_function pushes must ack or the R side blocks forever. */
const ackPush = (_state, k) => {
  k(null, null)
}

async function runCase(label, configure) {
  console.log(`[${label}] connecting`)
  const client = await RserveClient.create({
    host: process.env.VITE_RSERVE_HOST ?? 'http://127.0.0.1:6311',
  })
  const app = await client.ocap(vitAppSchema)

  let lastState = {}
  const root = await app.vitWidget(ackPush)
  const child = await root.children.samplingVariation((state, k) => {
    lastState = { ...lastState, ...state }
    if (state.status || state.progress != null) {
      console.log(`[${label}] push`, {
        status: lastState.status,
        progress: lastState.progress,
        yvar: lastState.yvar,
        sampleStats: lastState.sample_stats?.length,
      })
    }
    ackPush(state, k)
  })

  console.log(`[${label}] load_dataset`)
  await root.methods.load_dataset(DEFAULT_URL)
  await sleep(300)
  await configure(child)
  await sleep(500)

  console.log(`[${label}] before confirm`, {
    xvar: lastState.xvar,
    yvar: lastState.yvar,
    status: lastState.status,
    population: lastState.population?.length,
  })

  await child.methods.record_choices()
  await sleep(300)

  console.log(`[${label}] after confirm`, {
    status: lastState.status,
    progress: lastState.progress,
    sampleStats: lastState.sample_stats?.length,
    sampleIdx: lastState.sample_indices?.length,
    error: lastState.error_message,
  })

  client.close()
  return lastState.status === 'ready'
}

async function main() {
  const oneNum = await runCase('one-num', async (child) => {
    await child.properties.xvar.set('height')
    await child.properties.yvar.set('')
    await child.properties.sample_size.set(30)
  })

  const numCat = await runCase('num-cat', async (child) => {
    await child.properties.xvar.set('height')
    await child.properties.yvar.set('gender')
    await child.properties.sample_size.set(30)
  })

  console.log({ oneNum, numCat })
  process.exit(oneNum && numCat ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
