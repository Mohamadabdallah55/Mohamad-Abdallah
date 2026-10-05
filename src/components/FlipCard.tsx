interface FlipCardProps {
  index: number;
  answerText: string;
  points: number;
  isRevealed: boolean;
  onClick?: () => void;
  interactive?: boolean;
}

export function FlipCard({
  index,
  answerText,
  points,
  isRevealed,
  onClick,
  interactive = false,
}: FlipCardProps) {
  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`relative h-14 sm:h-16 md:h-20 w-full perspective-1000 ${
        interactive ? 'cursor-pointer hover:scale-[1.01] transition-transform' : ''
      }`}
    >
      <div
        className={`relative h-full w-full transform-style-preserve-3d transition-transform duration-600 ease-out shadow-lg rounded-xl ${
          isRevealed ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front Side: Hidden answer showing Slot Number */}
        <div className="absolute inset-0 backface-hidden flex items-center justify-center rounded-xl border-2 border-amber-400/80 bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 px-4 shadow-[inset_0_2px_12px_rgba(59,130,246,0.4)]">
          {/* Ribbed metallic texture lines */}
          <div className="pointer-events-none absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px]" />

          {/* Number Emblem */}
          <div className="relative flex h-9 w-9 sm:h-11 sm:w-11 md:h-13 md:w-13 items-center justify-center rounded-full border-2 border-amber-300 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-display font-extrabold text-lg sm:text-xl md:text-2xl shadow-[0_0_15px_rgba(251,191,36,0.6)]">
            {index + 1}
          </div>
        </div>

        {/* Back Side: Revealed Answer & Points Box */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-between rounded-xl border-2 border-amber-400 bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 px-3 sm:px-4 md:px-5 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
          {/* Answer Text */}
          <span className="font-display font-bold text-base sm:text-lg md:text-2xl text-white tracking-wide truncate pr-1">
            {answerText}
          </span>

          {/* Score Points Box */}
          <div className="flex h-9 min-w-10 sm:h-11 sm:min-w-13 md:h-13 md:min-w-16 items-center justify-center rounded-lg border-2 border-amber-300 bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-600 px-2 sm:px-3 text-slate-950 font-display font-extrabold text-lg sm:text-xl md:text-2xl tabular-nums shadow-[inset_0_1px_4px_rgba(255,255,255,0.6)]">
            {points}
          </div>
        </div>
      </div>
    </div>
  );
}
