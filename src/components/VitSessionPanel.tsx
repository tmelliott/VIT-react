import { useWidget, type AppType } from "@tmelliott/react-rserve";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import vitAppSchema from "@/lib/vit.rserve";
import { parseGatingJson, parseSceneJson, parseDataSummaryJson } from "@/scene/schema";
import { VitAnimatedInference } from "@/components/VitAnimatedInference";

type AppT = AppType<typeof vitAppSchema>;

export function VitSessionPanel({ app }: { app: AppT }) {
  const w = useWidget(app.VitSession);
  const state = w.state;
  const m = w.methods;
  const scene = useMemo(() => {
    const raw = state?.sceneJson;
    if (raw == null) return null;
    try {
      return parseSceneJson(raw);
    } catch {
      return null;
    }
  }, [state?.sceneJson]);
  const gating = useMemo(() => {
    const raw = state?.gatingJson;
    if (raw == null) return null;
    try {
      return parseGatingJson(raw);
    } catch {
      return null;
    }
  }, [state?.gatingJson]);
  const summary = useMemo(() => {
    const raw = state?.dataSummaryJson;
    if (raw == null) return null;
    try {
      return parseDataSummaryJson(raw);
    } catch {
      return null;
    }
  }, [state?.dataSummaryJson]);

  const [csv, setCsv] = useState<string>("x\n1\n2\n3\n4\n5");
  const [x, setX] = useState("x");
  const [y, setY] = useState("");
  const [module, setModule] = useState<"sampvar" | "bootstrap">("sampvar");
  const [stat, setStat] = useState<"mean" | "median">("mean");
  const [n, setN] = useState(3);
  const [seed, setSeed] = useState(0);
  const [paired, setPaired] = useState(false);
  const [resampleWithin, setResampleWithin] = useState(false);
  const plotWrapRef = useRef<HTMLDivElement>(null);
  const [plotW, setPlotW] = useState(560);
  const animBusyRef = useRef(false);
  const [animUiBusy, setAnimUiBusy] = useState(false);

  useLayoutEffect(() => {
    const el = plotWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPlotW(Math.max(200, el.clientWidth)));
    ro.observe(el);
    setPlotW(Math.max(200, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const onAnimBusy = useCallback((b: boolean) => {
    animBusyRef.current = b;
    setAnimUiBusy(b);
  }, []);

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const waitAnim = useCallback(async () => {
    await sleep(50);
    const deadline = Date.now() + 25000;
    while (animBusyRef.current && Date.now() < deadline) {
      await sleep(40);
    }
  }, []);

  const load = useCallback(async () => {
    if (!m?.loadCsv) return;
    const fn = m.loadCsv;
    if (typeof fn === "object" && "call" in fn) {
      await (fn as { call: (t: string) => Promise<void> }).call(csv);
    } else if (typeof fn === "function") {
      await (fn as (t: string) => Promise<void>)(csv);
    }
  }, [m, csv]);

  const onModule = useCallback(
    async (mod: "sampvar" | "bootstrap") => {
      setModule(mod);
      if (m?.setModule) {
        const fn = m.setModule;
        if (typeof fn === "object" && "call" in fn) {
          await (fn as { call: (s: string) => Promise<void> }).call(mod);
        } else {
          await (fn as (s: string) => Promise<void>)(mod);
        }
      }
    },
    [m],
  );

  const onRoles = useCallback(async () => {
    if (m?.setVarRoles) {
      const fn = m.setVarRoles;
      if (typeof fn === "object" && "call" in fn) {
        await (fn as { call: (a: string, b: string, c: string) => Promise<void> }).call(
          x,
          y,
          "",
        );
      } else {
        await (fn as (a: string, b: string, c: string) => Promise<void>)(x, y, "");
      }
    }
  }, [m, x, y]);

  const onStat = useCallback(async () => {
    if (m?.setStatConfig) {
      const fn = m.setStatConfig;
      if (typeof fn === "object" && "call" in fn) {
        await (fn as { call: (a: string, b: number) => Promise<void> }).call(stat, n);
      } else {
        await (fn as (a: string, b: number) => Promise<void>)(stat, n);
      }
    }
  }, [m, stat, n]);

  const onRecord = useCallback(async () => {
    if (m?.recordAndBuild) {
      const fn = m.recordAndBuild;
      if (typeof fn === "object" && "call" in fn) {
        await (fn as { call: () => Promise<void> }).call();
      } else {
        await (fn as () => Promise<void>)();
      }
    }
  }, [m]);

  const onResample = useCallback(async () => {
    if (m?.resample) {
      const fn = m.resample;
      if (typeof fn === "object" && "call" in fn) {
        await (fn as { call: (s: number) => Promise<void> }).call(seed);
      } else {
        await (fn as (s: number) => Promise<void>)(seed);
      }
    }
  }, [m, seed]);

  const onResampleBatch = useCallback(
    async (count: number) => {
      const fn = m?.resampleBatch;
      if (!fn) return;
      if (typeof fn === "object" && "call" in fn) {
        await (fn as { call: (c: number, s: number) => Promise<void> }).call(count, seed);
      } else {
        await (fn as (c: number, s: number) => Promise<void>)(count, seed);
      }
    },
    [m, seed],
  );

  const colNames = summary?.columns?.map((c) => c.name) ?? [];
  const canRecord = Boolean(gating?.canRecord);
  const dataLoaded = colNames.length > 0;

  const runMulti = useCallback(
    async (n: number) => {
      if (!canRecord || animUiBusy) return;
      if (n === 1) {
        await onResample();
        await waitAnim();
        return;
      }
      if (n === 5) {
        for (let i = 0; i < 5; i++) {
          await onResample();
          await waitAnim();
        }
        return;
      }
      if (n === 10) {
        for (let i = 0; i < 2; i++) {
          await onResample();
          await waitAnim();
        }
        await onResampleBatch(8);
        await waitAnim();
        return;
      }
      await onResampleBatch(n);
      await waitAnim();
    },
    [canRecord, animUiBusy, onResample, onResampleBatch, waitAnim],
  );

  return (
    <div className="flex w-full min-h-[32rem] flex-col gap-4 p-4 md:flex-row">
      <div
        className="w-full min-w-0 space-y-3 overflow-auto rounded border border-slate-800/20 bg-slate-50/80 p-3 md:max-w-sm"
        style={{ minHeight: "20rem" }}
      >
        <h2
          className="text-sm font-semibold tracking-tight text-slate-800"
        >
          Data &amp; model
        </h2>
        <textarea
          className="box-border w-full min-h-24 rounded border border-slate-300/80 p-2 font-mono text-xs"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <button
          type="button"
          className="w-full rounded bg-amber-600/90 py-1.5 text-sm text-white"
          onClick={load}
        >
          Load CSV
        </button>
        {summary?.nRow != null && (
          <p className="text-xs text-slate-600">
            Loaded {String(summary.nRow)} rows, {String(summary.nCol)} columns
          </p>
        )}

        <div className="space-y-1.5 text-sm">
          <p className="text-xs font-medium text-slate-500">Module</p>
          <div className="flex gap-2">
            {(["sampvar", "bootstrap"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`flex-1 rounded border px-2 py-1 text-xs ${module === m ? "border-amber-600 bg-amber-100" : "border-slate-300"}`}
                onClick={() => onModule(m)}
              >
                {m === "sampvar" ? "Sampling" : "Bootstrap"}
              </button>
            ))}
          </div>
        </div>

        {dataLoaded && (
          <div className="space-y-1.5 text-sm">
            <label className="text-xs text-slate-500">X variable</label>
            <select
              className="w-full rounded border border-slate-300/80 p-1 text-sm"
              value={x}
              onChange={(e) => setX(e.target.value)}
            >
              {colNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {gating?.canPickY && colNames.length > 1 && (
              <>
                <label className="text-xs text-slate-500">Y (optional)</label>
                <select
                  className="w-full rounded border border-slate-300/80 p-1 text-sm"
                  value={y}
                  onChange={(e) => setY(e.target.value)}
                >
                  <option value="">(none)</option>
                  {colNames
                    .filter((c) => c !== x)
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </>
            )}
            <button
              type="button"
              className="mt-1 w-full rounded border border-slate-800/30 bg-white py-1.5 text-xs font-medium text-slate-800"
              onClick={onRoles}
            >
              Set variable roles
            </button>
            {!canRecord && (
              <p className="text-[0.65rem] leading-snug text-amber-800/90">
                Click <strong>Set variable roles</strong> so R knows which column is X — then
                Record / Resample unlock below.
              </p>
            )}
          </div>
        )}

        {dataLoaded && (
          <div className="space-y-1.5 border-t border-slate-200 pt-2 text-sm">
            <p className="text-xs font-medium text-slate-600">Statistic &amp; resampling</p>
            <div className="flex flex-wrap gap-2">
              {(gating?.statChoices ?? ["mean", "median"]).map((s) => (
                <label key={s} className="text-xs">
                  <input
                    type="radio"
                    name="stat"
                    value={s}
                    checked={stat === s}
                    onChange={() => setStat(s as "mean" | "median")}
                  />
                  {s}
                </label>
              ))}
            </div>
            <label className="text-xs text-slate-500">
              n:{" "}
              <input
                type="number"
                className="w-16 rounded border px-1"
                min={gating?.sampleSizeMin ?? 1}
                max={gating?.sampleSizeMax ?? 9999}
                value={n}
                onChange={(e) => setN(parseInt(e.target.value, 10) || 1)}
              />
            </label>
            {module === "bootstrap" && (
              <div className="text-xs">
                <label>
                  <input
                    type="checkbox"
                    checked={paired}
                    onChange={async (e) => {
                      const v = e.target.checked;
                      setPaired(v);
                      const fn = m?.setBootstrapOptions;
                      if (fn) {
                        if (typeof fn === "object" && "call" in fn) {
                          await (fn as { call: (a: boolean, b: boolean) => Promise<void> }).call(
                            v,
                            resampleWithin,
                          );
                        } else {
                          await (fn as (a: boolean, b: boolean) => Promise<void>)(
                            v,
                            resampleWithin,
                          );
                        }
                      }
                    }}
                  />{" "}
                  Paired
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    checked={resampleWithin}
                    onChange={async (e) => {
                      const v = e.target.checked;
                      setResampleWithin(v);
                      const fn = m?.setBootstrapOptions;
                      if (fn) {
                        if (typeof fn === "object" && "call" in fn) {
                          await (fn as { call: (a: boolean, b: boolean) => Promise<void> }).call(
                            paired,
                            v,
                          );
                        } else {
                          await (fn as (a: boolean, b: boolean) => Promise<void>)(paired, v);
                        }
                      }
                    }}
                  />{" "}
                  Resample within groups
                </label>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                className="w-full rounded bg-slate-700 py-1 text-sm text-white disabled:opacity-40"
                onClick={onStat}
                disabled={!canRecord || animUiBusy}
                title={!canRecord ? "Set variable roles first" : undefined}
              >
                Update stat / n
              </button>
              <button
                type="button"
                className="w-full rounded border-2 border-amber-700 bg-amber-50 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={onRecord}
                disabled={!canRecord || animUiBusy}
                title={!canRecord ? "Set variable roles first" : undefined}
              >
                Record choices
              </button>
              <label className="text-xs text-slate-500">
                Resample seed (0 = auto)
                <input
                  type="number"
                  className="ml-2 w-20 rounded border px-1"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                  disabled={!canRecord}
                />
              </label>
              <button
                type="button"
                className="w-full rounded bg-amber-700 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => runMulti(1)}
                disabled={!canRecord || animUiBusy}
                title={!canRecord ? "Set variable roles first" : undefined}
              >
                Resample ×1
              </button>
              <p className="text-[0.65rem] text-slate-500">Batch (animated)</p>
              <div className="grid grid-cols-4 gap-1">
                {[5, 10, 100, 1000].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="rounded border border-amber-800/40 bg-white py-1 text-[0.65rem] font-medium text-slate-800 disabled:opacity-40"
                    disabled={!canRecord || animUiBusy}
                    onClick={() => runMulti(k)}
                  >
                    ×{k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {state?.lastError && String(state.lastError).length > 0 && (
          <p className="text-xs text-red-700">{String(state.lastError)}</p>
        )}
        <p className="text-[0.7rem] text-slate-400">Status: {w.status}</p>
      </div>

      <div className="min-w-0 flex-1" ref={plotWrapRef}>
        {scene && (
          <div className="h-full w-full px-1 pt-2" style={{ minHeight: 360 }}>
            <VitAnimatedInference scene={scene} width={plotW} onAnimationBusy={onAnimBusy} />
          </div>
        )}
        {!scene && (
          <p className="p-4 text-slate-500">Connect to Rserve and load data to see the scene.</p>
        )}
      </div>
    </div>
  );
}
