"use client";

import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { VerdictDistributionItem } from "@/lib/analytics/stats";
import { useLanguage } from "@/lib/i18n/context";

interface VerdictChartProps {
  data: VerdictDistributionItem[];
}

export function VerdictChart({ data }: VerdictChartProps) {
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

  const chartData = data.map((item) => ({
    name: t.verdicts[item.verdict as keyof typeof t.verdicts]?.label || item.verdict,
    rawVerdict: item.verdict,
    value: item.count,
    percentage: item.percentage,
    color: item.color,
  }));

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
        No published claims to analyze yet.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-bold text-slate-200">{d.name}</p>
          <p className="text-slate-400">
            Count: <span className="text-white font-mono font-semibold">{d.value}</span> ({d.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
