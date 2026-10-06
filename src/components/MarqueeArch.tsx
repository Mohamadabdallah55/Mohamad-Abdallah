interface MarqueeArchProps {
  isCorrectFlash?: boolean;
  isStrikeFlash?: boolean;
}

export function MarqueeArch({
  isCorrectFlash = false,
  isStrikeFlash = false,
}: MarqueeArchProps) {
  // Generate light bulbs along the top arch
  const bulbs = Array.from({ length: 28 });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Ambient stage spotlights with hardware acceleration */}
      <div
        className={`absolute -top-32 left-1/4 h-96 w-96 rounded-full blur-3xl transition-colors duration-500 will-change-transform ${
          isStrikeFlash ? 'bg-red-600/35' : isCorrectFlash ? 'bg-amber-400/35' : 'bg-blue-500/20'
        }`}
      />
      <div
        className={`absolute -top-32 right-1/4 h-96 w-96 rounded-full blur-3xl transition-colors duration-500 will-change-transform ${
          isStrikeFlash ? 'bg-red-600/35' : isCorrectFlash ? 'bg-amber-400/35' : 'bg-amber-500/15'
        }`}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-blue-600/15 blur-[120px]" />

      {/* Top curved marquee frame */}
      <div className="relative mx-auto flex max-w-5xl justify-center pt-2">
        <div
          className={`flex items-center gap-2 md:gap-3.5 px-6 py-2 rounded-full border bg-slate-950/70 backdrop-blur-sm transition-all duration-300 ${
            isStrikeFlash
              ? 'border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.5)] scale-[1.02]'
              : isCorrectFlash
              ? 'border-amber-300 shadow-[0_0_35px_rgba(251,191,36,0.6)] scale-[1.02]'
              : 'border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          }`}
        >
          {bulbs.map((_, i) => {
            let bulbClass = 'bg-amber-400 border-amber-300';
            if (isStrikeFlash) {
              bulbClass = 'bg-red-500 border-red-300 scale-125';
            } else if (isCorrectFlash) {
              bulbClass = 'bg-yellow-200 border-white scale-125';
            } else {
              bulbClass = i % 2 === 0
                ? 'bg-amber-300 border-amber-300 animate-bulb-glow'
                : 'bg-amber-400 border-amber-400 animate-bulb-glow-alt';
            }

            return (
              <span
                key={i}
                className={`h-2.5 w-2.5 md:h-3.5 md:w-3.5 rounded-full border transition-all duration-200 will-change-transform ${bulbClass}`}
              />
            );
          })}
        </div>
      </div>

      {/* Stage floor reflection grid lines */}
      <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-blue-950/60 to-transparent">
        <div className="mx-auto h-full max-w-5xl border-t border-amber-500/20" />
      </div>
    </div>
  );
}
