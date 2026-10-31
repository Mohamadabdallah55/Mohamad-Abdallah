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
 * Iconic Family Feud ❌ Buzzer overlay - Ultra-fast GPU accelerated
 */
export function StrikeOverlay({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  if (!active || count === 0) return null;

  const strikeCount = Math.min(3, Math.max(1, count));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none select-none bg-red-950/40 backdrop-blur-[2px]"
      role="alert"
      aria-label={`خطأ رقم ${strikeCount}`}
    >
      {/* Studio red flash */}
      <div className="absolute inset-0 bg-red-600/30 animate-red-flash-fast" />

      {/* Giant Strikes Container */}
      <div className="relative flex items-center justify-center gap-4 sm:gap-8 md:gap-12 animate-fast-strike">
        {Array.from({ length: strikeCount }).map((_, i) => (
          <div
            key={i}
            className="flex h-28 w-28 sm:h-44 sm:w-44 md:h-60 md:w-60 items-center justify-center rounded-3xl sm:rounded-[40px] border-4 sm:border-8 border-red-400 bg-gradient-to-b from-red-600 via-red-700 to-red-900 shadow-[0_0_60px_rgba(239,68,68,0.9),inset_0_4px_20px_rgba(255,255,255,0.4)]"
          >
            <span
              className="text-white font-black text-6xl sm:text-9xl md:text-[140px] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: "'Changa', sans-serif" }}
            >
              ✕
            </span>
          </div>
        ))}
      </div>

      {/* Strike status label */}
      <div className="mt-6 sm:mt-10 rounded-2xl border-2 border-red-400 bg-slate-950/90 px-6 sm:px-10 py-2 sm:py-3 text-center shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-fast-strike">
        <strong className="block text-xl sm:text-3xl font-black text-red-200 font-display">
          {strikeCount >= 3 ? 'ثلاثة أخطاء! دور السرقة ⚡' : `خطأ ${strikeCount} من 3`}
        </strong>
      </div>
    </div>
  );
}
