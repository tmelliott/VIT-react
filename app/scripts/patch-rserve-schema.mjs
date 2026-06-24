/**
 * Post-process generated vit.rserve.ts:
 * - prepend @ts-nocheck (full schema inference exhausts tsc heap)
 * - coerce R character vectors that arrive as strings (length-1 or empty)
 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/rserve/vit.rserve.ts'
const marker = '// @ts-nocheck'

const zStringArrayHelper = `
/** Rserve may send length-0/1 character vectors as "" or a plain string. */
const zStringArray = () =>
  z
    .union([z.array(z.string()), z.string(), z.undefined()])
    .transform((val) => {
      if (val === undefined) return undefined
      if (Array.isArray(val)) return val
      if (val === '') return []
      return [val]
    })
`

let src = readFileSync(path, 'utf8')

if (!src.includes('const zStringArray')) {
  src = src.replace(
    'import { z } from "zod";\n',
    `import { z } from "zod";\n${zStringArrayHelper}\n`,
  )
}

src = src.replaceAll(
  'z.union([z.array(z.string()), z.undefined()])',
  'zStringArray()',
)
src = src.replaceAll(
  'Robj.js_function([z.array(z.string())]',
  'Robj.js_function([zStringArray()]',
)
src = src.replaceAll(
  'set: Robj.ocap([z.array(z.string())]',
  'set: Robj.ocap([zStringArray()]',
)

if (!src.startsWith(marker)) {
  src = `${marker}\n${src}`
}

writeFileSync(path, src)
