import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { VitScene } from "@/scene/schema";

const PAD = 12;
const H_POP = 118;
const H_SAMP = 118;
const H_STAT = 132;
const TOTAL_H = H_POP + H_SAMP + H_STAT;

type Phase = "idle" | "highlight" | "fly" | "stat" | "arrow" | "done";

function cxFromNorm(x: number, w: number) {
  return PAD + x * Math.max(8, w - 2 * PAD);
}

function bandLabelY(bandTop: number) {
  return bandTop + 14;
}

function statToNormX(stat: number, vr: { min: number; max: number } | undefined): number {
  if (!vr || !Number.isFinite(stat)) return 0.5;
  const d = vr.max - vr.min;
  if (d < 1e-12) return 0.5;
  return Math.min(1, Math.max(0, (stat - vr.min) / d));
}

export function VitAnimatedInference({
  scene,
  width,
  onAnimationBusy,
}: {
  scene: VitScene;
  width: number;
  onAnimationBusy?: (busy: boolean) => void;
}) {
  const w = Math.max(200, width);
  const yPop = H_POP * 0.55;
  const ySamp = H_POP + H_SAMP * 0.55;
  const yStatBase = H_POP + H_SAMP;

  const anim = scene.animation;
  const burst = anim?.tier === "burst";
  const single = anim?.tier === "single";

  const [phase, setPhase] = useState<Phase>("idle");
  const [histMask, setHistMask] = useState<number | null>(null);
  const [burstShown, setBurstShown] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, []);

  const popPts = scene.bands.population.points;
  const vr = scene.bands.population.valueRange;
  const sampPts = scene.bands.sample.points;
  const histPts = scene.bands.statistic.history;
  const animStat = anim?.statValue;

  const highlightSet = useMemo(
    () => new Set(single ? (anim?.popHighlightIds ?? []) : []),
    [single, anim?.popHighlightIds],
  );

  /** Ghost paths: start at population point for each sampled index; land at sampleXs[i]. */
  const ghosts = useMemo(() => {
    if (!single || !anim?.sampleXs?.length) return [];
    const xs = anim.sampleXs;
    const ids = anim.popHighlightIds ?? [];
    return xs.map((sx, i) => {
      const id = ids[i] ?? `p${i + 1}`;
      const pop = popPts.find((p) => p.id === id);
      const x0 = pop?.x ?? sx;
      return { id: `ghost-${i}`, x0, x1: sx, i };
    });
  }, [single, anim?.sampleXs, anim?.popHighlightIds, popPts]);

  const statCx = useMemo(() => {
    if (animStat == null || !Number.isFinite(animStat)) return cxFromNorm(0.5, w);
    return cxFromNorm(statToNormX(animStat, vr), w);
  }, [animStat, vr, w]);

  const lastHist = histPts.length ? histPts[histPts.length - 1] : null;
  const arrowEndCx = lastHist ? cxFromNorm(lastHist.x, w) : statCx;
  const arrowEndCy = lastHist
    ? yStatBase + lastHist.y * (H_STAT - 2 * PAD) + PAD
    : yStatBase + H_STAT * 0.5;

  /* --- Single-resample choreography --- */
  useEffect(() => {
    clearTimers();
    if (!anim) {
      setPhase("done");
      setHistMask(null);
      onAnimationBusy?.(false);
      return;
    }
    if (burst) {
      return;
    }
    if (!single) {
      setPhase("done");
      setHistMask(null);
      return;
    }
    const prev = anim.prevHistoryCount ?? 0;
    setHistMask(prev);
    setPhase("idle");
    onAnimationBusy?.(true);

    timers.current.push(window.setTimeout(() => setPhase("highlight"), 30));
    timers.current.push(window.setTimeout(() => setPhase("fly"), 380));
    timers.current.push(window.setTimeout(() => setPhase("stat"), 380 + 920));
    timers.current.push(window.setTimeout(() => setPhase("arrow"), 380 + 920 + 420));
    timers.current.push(
      window.setTimeout(() => {
        setPhase("done");
        setHistMask(null);
        onAnimationBusy?.(false);
      }, 380 + 920 + 420 + 580),
    );

    return () => {
      clearTimers();
      onAnimationBusy?.(false);
    };
  }, [
    single,
    anim?.prevHistoryCount,
    anim?.statValue,
    scene.meta?.iter,
    scene.meta?.seed,
    clearTimers,
    onAnimationBusy,
  ]);

  /* --- Burst: grow visible history quickly --- */
  useEffect(() => {
    if (!burst || !anim?.stats?.length) {
      setBurstShown(null);
      if (!single) onAnimationBusy?.(false);
      return;
    }
    const from = anim.fromHistoryCount ?? 0;
    const to = anim.toHistoryCount ?? histPts.length;
    const add = to - from;
    if (add <= 0) {
      setBurstShown(to);
      return;
    }
    onAnimationBusy?.(true);
    setBurstShown(from);
    const duration =
      add <= 5 ? 1200 : add <= 10 ? 900 : add <= 100 ? 700 : add <= 1000 ? 550 : 400;
    const start = performance.now();

    const tick = (now: number) => {
      const u = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - u) * (1 - u);
      const cur = Math.min(to, Math.floor(from + eased * add));
      setBurstShown(cur);
      if (u < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setBurstShown(null);
        onAnimationBusy?.(false);
        raf.current = null;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      onAnimationBusy?.(false);
    };
  }, [
    burst,
    anim?.fromHistoryCount,
    anim?.toHistoryCount,
    anim?.stats?.length,
    histPts.length,
    onAnimationBusy,
    single,
  ]);

  const visibleHistory = useMemo(() => {
    if (burstShown != null) return histPts.slice(0, burstShown);
    if (histMask != null) return histPts.slice(0, histMask);
    return histPts;
  }, [histPts, histMask, burstShown]);

  const showSamplePoints = !single || phase === "stat" || phase === "arrow" || phase === "done";
  const showStatLine = single && (phase === "stat" || phase === "arrow" || phase === "done");
  const showArrow = single && (phase === "arrow" || phase === "done");

  return (
    <div className="w-full select-none" style={{ maxWidth: "100%" }}>
      <svg width={w} height={TOTAL_H} className="block text-slate-300">
        <defs>
          <marker id="vit-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="crimson" />
          </marker>
        </defs>

        <rect x={0} y={0} width={w} height={H_POP} fill="#f8fafc" stroke="#e2e8f0" />
        <text x={PAD} y={bandLabelY(0)} className="fill-slate-500 text-[10px] font-semibold uppercase">
          Population
        </text>
        {popPts.map((p) => {
          const hl = highlightSet.has(p.id) && (phase === "highlight" || phase === "fly");
          return (
            <circle
              key={p.id}
              cx={cxFromNorm(p.x, w)}
              cy={yPop}
              r={hl ? 7 : 4}
              fill={hl ? "#f59e0b" : "#3b82f6"}
              stroke={hl ? "#b45309" : "none"}
              strokeWidth={hl ? 2 : 0}
              opacity={0.88}
            />
          );
        })}

        <rect x={0} y={H_POP} width={w} height={H_SAMP} fill="#f1f5f9" stroke="#e2e8f0" />
        <text
          x={PAD}
          y={bandLabelY(H_POP)}
          className="fill-slate-500 text-[10px] font-semibold uppercase"
        >
          Sample
        </text>
        <AnimatePresence>
          {single &&
            phase === "fly" &&
            ghosts.map((g) => {
              const cx0 = cxFromNorm(g.x0, w);
              const cx1 = cxFromNorm(g.x1, w);
              return (
                <motion.circle
                  key={g.id}
                  r={5}
                  fill="#f59e0b"
                  stroke="#b45309"
                  strokeWidth={1.5}
                  initial={{ cx: cx0, cy: yPop, opacity: 0.95 }}
                  animate={{ cx: cx1, cy: ySamp, opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.82, ease: "easeInOut", delay: g.i * 0.035 }}
                />
              );
            })}
        </AnimatePresence>
        {showSamplePoints &&
          sampPts.map((p) => (
            <circle
              key={p.id}
              cx={cxFromNorm(p.x, w)}
              cy={ySamp}
              r={4}
              fill="#0ea5e9"
              opacity={0.92}
            />
          ))}
        {showStatLine && animStat != null && (
          <g>
            <line
              x1={statCx}
              x2={statCx}
              y1={H_POP + 10}
              y2={H_POP + H_SAMP - 10}
              stroke="#be123c"
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.95}
            />
            <text x={statCx + 6} y={H_POP + H_SAMP * 0.38} className="fill-rose-800 text-[11px] font-mono">
              {Number(animStat).toFixed(3)}
            </text>
          </g>
        )}

        <rect x={0} y={H_POP + H_SAMP} width={w} height={H_STAT} fill="#eef2ff" stroke="#e2e8f0" />
        <text
          x={PAD}
          y={bandLabelY(H_POP + H_SAMP)}
          className="fill-slate-500 text-[10px] font-semibold uppercase"
        >
          Statistics
        </text>
        {visibleHistory.map((p) => (
          <circle
            key={p.id}
            cx={cxFromNorm(p.x, w)}
            cy={yStatBase + p.y * (H_STAT - 2 * PAD) + PAD}
            r={3.5}
            fill="#6366f1"
            opacity={0.9}
          />
        ))}
        {showArrow && lastHist && (
          <line
            x1={statCx}
            y1={ySamp + 22}
            x2={arrowEndCx}
            y2={arrowEndCy - 10}
            stroke="crimson"
            strokeWidth={2}
            markerEnd="url(#vit-arrow)"
            opacity={0.88}
          />
        )}
      </svg>
    </div>
  );
}
