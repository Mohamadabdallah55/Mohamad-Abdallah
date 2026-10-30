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
 * Ultra-light GPU-accelerated: 380ms total animation with scale & opacity only. Zero thread lag.
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
    <div className={`strike-cinema strike-count-${Math.min(3, count)}`} role="alert" aria-label={`خطأ رقم ${Math.min(3, count)}`}>
      <div className="strike-cinema-flash" />
      <div className="strike-cinema-rings"><i /><i /><i /></div>
      <div className="strike-cinema-mark"><span>×</span></div>
      <strong>{count >= 3 ? 'ثلاثة أخطاء' : 'إجابة خاطئة'}</strong>
      <small>{count >= 3 ? 'الدور ينتقل — فرصة السرقة' : `الخطأ ${count} من 3`}</small>
    </div>
  );
}
