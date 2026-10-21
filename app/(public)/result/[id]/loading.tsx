export default function ResultLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8 animate-pulse">
      <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
        <div className="h-4 w-32 bg-slate-800 rounded" />
        <div className="h-4 w-24 bg-slate-800 rounded" />
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-6 w-36 bg-slate-800 rounded-lg" />
          <div className="h-4 w-28 bg-slate-800 rounded" />
        </div>
        <div className="h-8 w-3/4 bg-slate-800 rounded" />
        <div className="grid grid-cols-4 gap-3">
          <div className="h-12 bg-slate-950 rounded-lg" />
          <div className="h-12 bg-slate-950 rounded-lg" />
          <div className="h-12 bg-slate-950 rounded-lg" />
          <div className="h-12 bg-slate-950 rounded-lg" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-6 w-48 bg-slate-800 rounded" />
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="h-5 w-40 bg-slate-800 rounded" />
          <div className="h-16 bg-slate-950 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
