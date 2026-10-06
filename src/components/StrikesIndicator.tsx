interface StrikesIndicatorProps {
  strikes: number;
}

export function StrikesIndicator({ strikes }: StrikesIndicatorProps) {
  return (
    <div className="flex items-center gap-2 md:gap-3 rounded-2xl border-2 border-red-500/50 bg-slate-950/90 px-4 py-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
      <span className="text-xs md:text-sm font-black text-red-300">الأخطاء</span>
      <div className="flex items-center gap-2 md:gap-3">
        {[1, 2, 3].map((slot) => {
          const isStruck = slot <= strikes;
          return (
            <div
              key={slot}
              className={`flex h-8 w-8 md:h-11 md:w-11 items-center justify-center rounded-xl border-2 font-black transition-all ${
                isStruck
                  ? 'border-red-400 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_0_15px_rgba(239,68,68,0.9)] scale-110'
                  : 'border-slate-800 bg-slate-900/60 text-slate-700'
              }`}
            >
              <span className="text-lg md:text-2xl leading-none">❌</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Fullscreen Giant Strike Overlay
 * Pops up massive ❌ with rapid dramatic screen shake and instantaneous red studio flash
 */
export function StrikeOverlay({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  if (!active || count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-150">
      {/* Instantaneous full-screen red strobe flash */}
      <div className="absolute inset-0 bg-red-600/45 animate-red-strobe" />

      {/* Red radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(220,38,38,0.5)_100%)] animate-pulse" />

      {/* Giant Red ❌ Boxes with dramatic shake animation */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-10 animate-screen-shake">
        {Array.from({ length: Math.min(3, count) }).map((_, i) => (
          <div
            key={i}
            className="flex h-44 w-44 sm:h-56 sm:w-56 md:h-72 md:w-72 lg:h-84 lg:w-84 items-center justify-center rounded-3xl md:rounded-[40px] border-4 md:border-6 border-red-400 bg-gradient-to-b from-red-500 via-red-600 to-red-950 shadow-[0_0_90px_rgba(239,68,68,1),inset_0_4px_20px_rgba(255,255,255,0.4)] animate-strike"
          >
            <span className="text-8xl sm:text-9xl md:text-[14rem] lg:text-[16rem] text-white font-black leading-none drop-shadow-[0_8px_25px_rgba(0,0,0,0.9)] select-none">
              ✕
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
