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
  Legend,
} from "recharts";
import { useLanguage } from "@/lib/i18n/context";

export function TopicChart({ data = [] }) {
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
        No topic distribution data available yet.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    rawTopic: item.topic,
    name: t.topics[item.topic] || item.topic,
    shortName: (t.topics[item.topic] || item.topic).slice(0, 16) + "...",
    total: item.count,
    Supported: item.supported,
    Contradicted: item.contradicted,
    Misleading: item.misleading,
    Unverified: item.unverified,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 max-w-xs">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{d.name}</p>
          <div className="space-y-0.5">
            <p className="text-emerald-400">Supported: {d.Supported}</p>
            <p className="text-rose-400">Contradicted: {d.Contradicted}</p>
            <p className="text-amber-400">Misleading: {d.Misleading}</p>
            <p className="text-slate-400">Unverified: {d.Unverified}</p>
            <p className="text-slate-300 font-semibold pt-1 border-t border-slate-800">
              Total Claims: {d.total}
            </p>
          </div>
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
          margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="shortName"
            stroke="#94a3b8"
            fontSize={10}
            tickLine={false}
            interval={0}
            angle={-15}
            textAnchor="end"
          />
          <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={30}
            formatter={(val) => <span className="text-xs text-slate-300">{val}</span>}
          />
          <Bar dataKey="Contradicted" stackId="a" fill="#f43f5e" />
          <Bar dataKey="Misleading" stackId="a" fill="#f59e0b" />
          <Bar dataKey="Supported" stackId="a" fill="#10b981" />
          <Bar dataKey="Unverified" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
