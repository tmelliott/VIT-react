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

/** Rserve may send empty or plain arrays instead of typed arrays. */
const zInt32Array = () =>
  z
    .union([z.instanceof(Int32Array), z.array(z.number()), z.undefined()])
    .transform((val) => {
      if (val === undefined) return undefined
      if (val instanceof Int32Array) return val
      if (Array.isArray(val)) return Int32Array.from(val)
      return new Int32Array(0)
    })

const zFloat64Array = () =>
  z
    .union([z.instanceof(Float64Array), z.array(z.number()), z.undefined()])
    .transform((val) => {
      if (val === undefined) return undefined
      if (val instanceof Float64Array) return val
      if (Array.isArray(val)) return Float64Array.from(val)
      return new Float64Array(0)
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
  'z.union([z.instanceof(Int32Array), z.undefined()])',
  'zInt32Array()',
)
src = src.replaceAll(
  /z\.union\(\[\s*z\.instanceof\(Int32Array\),\s*z\.undefined\(\),\s*\]\)/g,
  'zInt32Array()',
)
src = src.replaceAll(
  'z.union([z.instanceof(Float64Array), z.undefined()])',
  'zFloat64Array()',
)
src = src.replaceAll(
  /z\.union\(\[\s*z\.instanceof\(Float64Array\),\s*z\.undefined\(\),\s*\]\)/g,
  'zFloat64Array()',
)

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

// State callbacks may receive plain JS arrays inside nested objects (e.g. scales).
src = src.replaceAll('pop: z.instanceof(Float64Array)', 'pop: zFloat64Array()')
src = src.replaceAll(
  'sample: z.instanceof(Float64Array)',
  'sample: zFloat64Array()',
)
src = src.replaceAll('dist: z.instanceof(Float64Array)', 'dist: zFloat64Array()')

if (!src.startsWith(marker)) {
  src = `${marker}\n${src}`
}

src = src.replace(
  /export const vitAppSchema = \{\n  ping,\n  vitWidget,\n\} satisfies z\.ZodRawShape;/,
  'export const vitAppSchema = {\n  ping: ping.optional(),\n  vitWidget,\n} satisfies z.ZodRawShape;',
)

writeFileSync(path, src)
