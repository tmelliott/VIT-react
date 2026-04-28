import { z } from "zod";

/**
 * R jsonlite often encodes NA_real_ as null; some numeric paths can yield
 * non-finite values. z.number() rejects null — that fails the whole scene
 * and the UI shows "Connect to Rserve…".
 */
const rNum: z.ZodType<number, z.ZodTypeDef, unknown> = z.preprocess((v) => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}, z.number());

const rNumOpt: z.ZodType<number | undefined, z.ZodTypeDef, unknown> = z.preprocess((v) => {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}, z.number().optional());

/** Aligned with R: vit_scene.R build_scene_from_state — wire JSON in sceneJson. */
export const scenePointZ = z.object({
  id: z.string(),
  x: rNum,
  y: rNum,
});

export const statCurrentZ = z.object({
  x: rNum,
  value: rNumOpt,
});

export const sceneBandsZ = z.object({
  population: z.object({
    xlim: z.tuple([rNum, rNum]),
    valueRange: z.object({ min: rNum, max: rNum }).optional(),
    points: z.array(scenePointZ),
  }),
  sample: z.object({
    points: z.array(scenePointZ),
  }),
  statistic: z.object({
    current: statCurrentZ.nullable().optional(),
    history: z.array(scenePointZ),
  }),
});

export const sceneAnimZ = z.object({
  tier: z.enum(["single", "burst"]),
  popHighlightIds: z.array(z.string()).optional(),
  sampleXs: z.array(rNum).optional(),
  statValue: rNumOpt,
  prevHistoryCount: rNumOpt,
  stats: z.array(rNum).optional(),
  fromHistoryCount: rNumOpt,
  toHistoryCount: rNumOpt,
});

export const vitSceneZ = z.object({
  version: z.number().optional(),
  meta: z.object({
    module: z.string(),
    stat: z.string().optional(),
    n: z.number().optional().nullable(),
    iter: z.number().optional().nullable(),
    seed: z.number().optional().nullable(),
  }),
  bands: sceneBandsZ,
  transitionHint: z
    .object({
      movedFrom: z.string().optional(),
    })
    .optional(),
  animation: sceneAnimZ.optional(),
});

export type VitScene = z.infer<typeof vitSceneZ>;

/** Rserve may deliver scene as a JSON string, or a value already parsed to an object. */
export function parseSceneJson(raw: string | unknown): VitScene {
  if (raw == null || raw === "") {
    throw new Error("empty scene");
  }
  if (typeof raw === "string") {
    return vitSceneZ.parse(JSON.parse(raw));
  }
  if (typeof raw === "object") {
    return vitSceneZ.parse(raw);
  }
  throw new Error("invalid scene type");
}

/** Accept R/jsonlite quirks: length-1 logicals sometimes arrive as [true]. */
const boolish = z
  .union([z.boolean(), z.array(z.boolean())])
  .transform((v) => (Array.isArray(v) ? Boolean(v[0]) : v));

export const gatingZ = z.object({
  module: z.array(z.string()).optional(),
  canPickY: boolish.optional(),
  canPickGroup: boolish.optional(),
  statChoices: z.array(z.string()).optional(),
  sampleSizeMin: z.number().optional(),
  sampleSizeMax: z.number().optional(),
  canRecord: boolish.optional(),
});

export type Gating = z.infer<typeof gatingZ>;

export function parseGatingJson(raw: string | unknown): Gating {
  if (raw == null || raw === "") {
    throw new Error("empty gating");
  }
  if (typeof raw === "string") {
    return gatingZ.parse(JSON.parse(raw));
  }
  if (typeof raw === "object") {
    return gatingZ.parse(raw);
  }
  throw new Error("invalid gating type");
}

const colSummaryZ = z.object({
  name: z.string(),
  role: z.string(),
  n: z.number().optional(),
  nValid: z.number().optional(),
});

export const dataSummaryZ = z.object({
  columns: z.array(colSummaryZ).optional(),
  nRow: z.number().optional(),
  nCol: z.number().optional(),
  loaded: z.boolean().optional(),
});

export function parseDataSummaryJson(raw: string | unknown) {
  if (raw == null || raw === "") {
    throw new Error("empty data summary");
  }
  if (typeof raw === "string") {
    return dataSummaryZ.parse(JSON.parse(raw));
  }
  if (typeof raw === "object") {
    return dataSummaryZ.parse(raw);
  }
  throw new Error("invalid data summary type");
}
