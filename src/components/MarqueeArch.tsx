export function MarqueeArch() {
  // Generate light bulbs along the top arch
  const bulbs = Array.from({ length: 28 });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Ambient stage spotlights */}
      <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-blue-600/15 blur-[120px]" />

      {/* Top curved marquee frame */}
      <div className="relative mx-auto flex max-w-5xl justify-center pt-2">
        <div className="flex items-center gap-2 md:gap-3.5 px-6 py-2 rounded-full border border-amber-500/40 bg-slate-950/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] backdrop-blur-sm">
          {bulbs.map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 md:h-3.5 md:w-3.5 rounded-full border border-amber-300 ${
                i % 2 === 0
                  ? 'bg-amber-300 shadow-[0_0_12px_#fde047] animate-bulb-glow'
                  : 'bg-amber-400 shadow-[0_0_10px_#facc15] animate-bulb-glow-alt'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stage floor reflection grid lines */}
      <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-blue-950/60 to-transparent">
        <div className="mx-auto h-full max-w-5xl border-t border-amber-500/20" />
      </div>
    </div>
  );
}
