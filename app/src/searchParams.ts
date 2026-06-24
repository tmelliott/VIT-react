import { z } from 'zod'

const httpUrlSchema = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), {
    message: 'Only http/https URLs are allowed',
  })

export const appSearchSchema = z.object({
  url: httpUrlSchema.optional(),
  xvar: z.string().optional(),
  yvar: z.string().optional(),
  sampleSize: z.coerce.number().int().positive().optional(),
  statistic: z.enum(['mean', 'median']).optional(),
})

export type AppSearch = z.infer<typeof appSearchSchema>

export function parseAppSearch(search: Record<string, unknown>): AppSearch {
  const result = appSearchSchema.safeParse(search)
  return result.success ? result.data : {}
}
