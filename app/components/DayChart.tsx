"use client";

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import { useEffect, useState } from "react";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Filler);

type Point = { hour: number; temperature: number };

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm === 60 ? 59 : mm).padStart(2, "0")}`;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function DayChart({ points }: { points: Point[] }) {
  const [colors, setColors] = useState({ accent: "#d9622b", soft: "rgba(217,98,43,0.15)", muted: "#6b6b66", border: "#e3e3de" });

  useEffect(() => {
    const read = () =>
      setColors({
        accent: cssVar("--accent", "#d9622b"),
        soft: cssVar("--accent-soft", "rgba(217,98,43,0.15)"),
        muted: cssVar("--muted", "#6b6b66"),
        border: cssVar("--border", "#e3e3de"),
      });
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  return (
    <div className="chart">
      <Scatter
        data={{
          datasets: [
            {
              label: "Température",
              data: points.map((p) => ({ x: p.hour, y: p.temperature })),
              showLine: true,
              borderColor: colors.accent,
              backgroundColor: colors.soft,
              fill: "origin",
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2,
              tension: 0.3,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "nearest", intersect: false, axis: "x" },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                title: (items) => fmtHour(items[0].parsed.x ?? 0),
                label: (item) => `${(item.parsed.y ?? 0).toFixed(1)} °C`,
              },
            },
          },
          scales: {
            x: {
              type: "linear",
              min: 0,
              max: 24,
              ticks: { stepSize: 3, color: colors.muted, callback: (v) => `${v}h` },
              grid: { color: colors.border },
            },
            y: {
              grace: "10%",
              ticks: { color: colors.muted, callback: (v) => `${Number(v).toFixed(1)}°` },
              grid: { color: colors.border },
            },
          },
        }}
      />
    </div>
  );
}
