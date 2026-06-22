/**
 * Prepend @ts-nocheck to the generated vit.rserve.ts.
 * z.infer on the full widget schema exhausts tsc's heap; runtime types live in vit.types.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/rserve/vit.rserve.ts'
const marker = '// @ts-nocheck'
let src = readFileSync(path, 'utf8')
if (!src.startsWith(marker)) {
  src = `${marker}\n${src}`
}
writeFileSync(path, src)
