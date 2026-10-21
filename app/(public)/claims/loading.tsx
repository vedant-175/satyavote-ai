export default function ClaimsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8 animate-pulse">
      <div className="border-b border-slate-800 pb-6 space-y-3">
        <div className="h-5 w-40 bg-slate-800 rounded-full" />
        <div className="h-8 w-72 bg-slate-800 rounded-lg" />
        <div className="h-4 w-96 bg-slate-800/60 rounded" />
      </div>

      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="h-10 bg-slate-950 rounded-lg w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-9 bg-slate-950 rounded-lg" />
          <div className="h-9 bg-slate-950 rounded-lg" />
          <div className="h-9 bg-slate-950 rounded-lg" />
          <div className="h-9 bg-slate-950 rounded-lg" />
        </div>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-6 w-32 bg-slate-800 rounded" />
              <div className="h-4 w-24 bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-3/4 bg-slate-800/80 rounded" />
            <div className="h-16 bg-slate-950 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-14 bg-slate-950 rounded-lg" />
              <div className="h-14 bg-slate-950 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
