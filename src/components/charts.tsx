"use client";
import { Localize } from "@/components/localize";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useApp } from "./providers";
const colors = [
  "#258d78",
  "#7fb6a6",
  "#597f9f",
  "#aac8db",
  "#dcc49a",
  "#b8c8c7",
  "#91a6ba",
  "#dfcabc",
];
export function TrendChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const { t } = useApp();
  return (
    <Localize>
      <div
        className="chart-box"
        role="img"
        aria-label={`Applications over time: ${data.map((d) => `${d.name}: ${d.value}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data.map((d) => ({ ...d, name: t(d.name) }))}
            margin={{ top: 12, right: 12, left: -23, bottom: 0 }}
          >
            <defs>
              <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#278e79" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#278e79" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#edf1f3"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8a9aa6", fontSize: 9 }}
              tickMargin={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: "#8a9aa6", fontSize: 9 }}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid #e3eae9",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Area
              dataKey="value"
              name={t("Applications")}
              type="monotone"
              stroke="#278e79"
              strokeWidth={2.5}
              fill="url(#chartArea)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Localize>
  );
}
export function DonutChart({
  data,
  total,
}: {
  data: { name: string; value: number }[];
  total: number;
}) {
  const { t } = useApp();
  return (
    <Localize>
      <>
        <div
          className="donut-wrap"
          role="img"
          aria-label={data.map((d) => `${d.name}: ${d.value}`).join(", ")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.map((d) => ({ ...d, name: t(d.name) }))}
                dataKey="value"
                innerRadius={62}
                outerRadius={83}
                paddingAngle={3}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <strong>{total}</strong>
            <small>Applications</small>
          </div>
        </div>
        <div className="chart-legend">
          {data.map((d, i) => (
            <span key={d.name}>
              <i
                className="legend-dot"
                style={{ background: colors[i % colors.length] }}
              />
              {d.name} <strong>{d.value}</strong>
            </span>
          ))}
        </div>
      </>
    </Localize>
  );
}
export function RankBars({
  data,
  onSelect,
}: {
  data: { name: string; value: number }[];
  onSelect?: (value: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Localize>
      <div className="rank-list">
        {data.map((d, i) => (
          <div key={d.name} className="rank-row">
            <button
              className="text-button"
              style={{
                fontSize: 10,
                color: "#627d87",
                textAlign: "left",
                fontWeight: 500,
              }}
              disabled={!onSelect}
              onClick={() => onSelect?.(d.name)}
            >
              {d.name}
            </button>
            <div className="rank-bar">
              <span
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: i === 0 ? "#318d77" : "#83b7a7",
                }}
              />
            </div>
            <strong>{d.value}</strong>
          </div>
        ))}
      </div>
    </Localize>
  );
}
