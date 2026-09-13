"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Chart wrappers with the Mureeh token palette.
 * Colors read from CSS variables so themes apply automatically.
 * Tooltips are keyboard-accessible via the underlying Recharts semantics;
 * every chart is paired with an aria-label on its container at call sites.
 */

const cssVar = (name: string) => `rgb(var(--${name}))`;

const tooltipStyle: React.CSSProperties = {
  backgroundColor: cssVar("surface-overlay"),
  border: `1px solid ${cssVar("border")}`,
  borderRadius: "var(--radius-md)",
  fontSize: "0.75rem",
  color: cssVar("foreground"),
};

export interface TrendPoint {
  label: string;
  value: number;
}

export function TrendAreaChart({
  data,
  height = 220,
  color = "primary",
}: {
  data: TrendPoint[];
  height?: number;
  color?: "primary" | "info" | "mastery";
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cssVar(color)} stopOpacity={0.28} />
            <stop offset="100%" stopColor={cssVar(color)} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={cssVar("border")} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: cssVar("muted-foreground"), fontSize: 11 }}
          axisLine={{ stroke: cssVar("border") }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: cssVar("muted-foreground"), fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: cssVar("border-strong") }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={cssVar(color)}
          strokeWidth={2}
          fill={`url(#grad-${color})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface PlannedActualPoint {
  label: string;
  actual: number;
  planned: number;
}

export function PlannedActualBarChart({
  data,
  height = 220,
}: {
  data: PlannedActualPoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={2}>
        <CartesianGrid stroke={cssVar("border")} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: cssVar("muted-foreground"), fontSize: 11 }}
          axisLine={{ stroke: cssVar("border") }}
          tickLine={false}
        />
        <YAxis tick={{ fill: cssVar("muted-foreground"), fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: cssVar("muted") }} />
        <Bar dataKey="planned" fill={cssVar("muted-foreground")} opacity={0.35} radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={18}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={entry.actual >= entry.planned ? cssVar("success") : cssVar("warning")}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface RadarDatum {
  axis: string;
  value: number;
}

export function CapabilityRadarChart({
  data,
  height = 280,
  color = "primary",
}: {
  data: RadarDatum[];
  height?: number;
  color?: "primary" | "mastery";
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={cssVar("border")} />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: cssVar("muted-foreground"), fontSize: 11 }}
        />
        <PolarRadiusAxis
          domain={[0, 100]}
          tick={false}
          axisLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Radar
          dataKey="value"
          stroke={cssVar(color)}
          fill={cssVar(color)}
          fillOpacity={0.22}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
