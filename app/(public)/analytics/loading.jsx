export default function AnalyticsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8 animate-pulse">
      <div className="border-b border-slate-800 pb-6 space-y-3">
        <div className="h-5 w-48 bg-slate-800 rounded-full" />
        <div className="h-8 w-80 bg-slate-800 rounded-lg" />
        <div className="h-4 w-96 bg-slate-800/60 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="h-4 w-28 bg-slate-800 rounded" />
            <div className="h-8 w-16 bg-slate-800 rounded" />
            <div className="h-3 w-36 bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="h-5 w-48 bg-slate-800 rounded" />
            <div className="h-64 bg-slate-950 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
