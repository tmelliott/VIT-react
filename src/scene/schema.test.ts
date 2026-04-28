import { describe, it, expect } from "vitest";
import { parseSceneJson, parseGatingJson, vitSceneZ } from "./schema";

const minimalGolden = `{
  "version": 1,
  "meta": { "module": "sampvar", "stat": "mean", "n": 3, "iter": 0, "seed": 0 },
  "bands": {
    "population": { "xlim": [0, 1], "points": [ { "id": "p1", "x": 0.2, "y": 0.5 } ] },
    "sample": { "points": [ { "id": "s1", "x": 0.2, "y": 0.5 } ] },
    "statistic": { "current": { "x": 0.3, "value": 0.1 }, "history": [] }
  },
  "transitionHint": { "movedFrom": "resample" }
}`;

describe("vitSceneZ", () => {
  it("parses golden JSON from R", () => {
    const s = parseSceneJson(minimalGolden);
    expect(s.bands.population.points).toHaveLength(1);
    expect(s.bands.population.points[0].id).toBe("p1");
  });

  it("parses scene when already a plain object (Rserve may deliver JSON pre-parsed)", () => {
    const o = JSON.parse(minimalGolden) as unknown;
    const s = parseSceneJson(o);
    expect(s.meta.module).toBe("sampvar");
  });

  it("coerces R jsonlite null numbers (NA) on points and animation so the scene still parses", () => {
    const w = JSON.parse(
      `{"version":1,"meta":{"module":"sampvar","stat":"mean","n":3,"iter":1,"seed":1},
      "bands":{"population":{"xlim":[0,1],
        "points":[{"id":"p1","x":0.2,"y":0.5}]},
        "sample":{"points":[{"id":"s1","x":null,"y":0.5}]},
        "statistic":{"current":null,
          "history":[{"id":"h1","x":null,"y":0.9}]}},"transitionHint":{"movedFrom":"r"}}`,
    ) as unknown;
    const s = parseSceneJson(w);
    expect(s.bands.sample.points[0].x).toBe(0);
    expect(s.bands.statistic.history[0].x).toBe(0);
  });

  it("parses gating when canRecord is a JSON array (legacy R jsonlite)", () => {
    const g = parseGatingJson(
      '{"module":["sampvar","bootstrap"],"canPickY":false,"canPickGroup":false,"statChoices":["mean","median"],"sampleSizeMin":1,"sampleSizeMax":5,"canRecord":[true]}',
    );
    expect(g.canRecord).toBe(true);
  });

  it("validates empty history", () => {
    const out = vitSceneZ.safeParse(
      JSON.parse(
        `{"version":1,"meta":{"module":"sampvar","stat":"mean","n":null,"iter":null,"seed":null},
        "bands":{"population":{"xlim":[0,1],"points":[]},
        "sample":{"points":[]},
        "statistic":{"current": null,"history":[]}},
        "transitionHint":{"movedFrom":"init"}}`
      )
    );
    expect(out.success).toBe(true);
  });
});
