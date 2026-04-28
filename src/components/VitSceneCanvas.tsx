import { useLayoutEffect, useRef, useState } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { motion } from "motion/react";
import type { z } from "zod";
import { scenePointZ } from "@/scene/schema";

type Point = z.infer<typeof scenePointZ>;

function useContainerWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(400);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setW(Math.max(120, el.clientWidth));
    });
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

export function BandPlot({
  label,
  points,
  mark,
}: {
  label: string;
  points: Point[];
  mark?: { x: number; y?: number; value?: number };
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { ref, width } = useContainerWidth();
  const h = 120;
  const padding = 8;

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const g = select(svgRef.current).select("g.markup");
    g.select("circle.current").remove();
    g.selectAll<SVGCircleElement, Point>("circle.dat")
      .data(points, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "dat")
            .attr("r", 4)
            .attr("fill", "steelblue")
            .attr("opacity", 0.15)
            .attr("cx", (d) => d.x * (width - 2 * padding) + padding)
            .attr("cy", (d) => d.y * (h - 2 * padding) + padding)
            .call((s) => s.transition().duration(400).attr("opacity", 0.95)),
        (update) =>
          update
            .transition()
            .duration(400)
            .attr("cx", (d) => d.x * (width - 2 * padding) + padding)
            .attr("cy", (d) => d.y * (h - 2 * padding) + padding),
        (exit) => exit.remove(),
      );
    if (mark && typeof mark.x === "number") {
      g.append("circle")
        .attr("class", "mark current")
        .attr("r", 5)
        .attr("fill", "none")
        .attr("stroke", "crimson")
        .attr("stroke-width", 2)
        .attr("cx", mark.x * (width - 2 * padding) + padding)
        .attr("cy", 0.1 * (h - 2 * padding) + padding);
    }
  }, [points, width, h, mark, label]);

  return (
    <motion.div
      ref={ref}
      className="w-full"
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <p
        className="mb-1 pl-1 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
        style={{ letterSpacing: "0.08em" }}
      >
        {label}
      </p>
      <div className="w-full" style={{ height: h }}>
        <svg ref={svgRef} width={width} height={h} className="block w-full text-slate-200">
          <g className="markup" transform="translate(0,0)">
            <line
              x1={padding}
              x2={width - padding}
              y1={h - padding}
              y2={h - padding}
              stroke="currentColor"
            />
          </g>
        </svg>
      </div>
    </motion.div>
  );
}
