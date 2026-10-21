"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { StateCountItem } from "@/lib/analytics/stats";
import { useLanguage } from "@/lib/i18n/context";

interface StateChartProps {
  data: StateCountItem[];
}

export function StateChart({ data }: StateChartProps) {
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-500">
        Loading chart...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
        No state distribution data available.
      </div>
    );
  }

  const chartData = data.slice(0, 8).map((item) => ({
    name: t.states[item.state] || item.state,
    count: item.count,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-bold text-slate-200">{d.name}</p>
          <p className="text-slate-400">
            Claims Ingested: <span className="text-blue-400 font-mono font-semibold">{d.count}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 20, left: 25, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
