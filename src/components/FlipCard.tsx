import { useEffect, useState } from 'react';

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
  const [showGoldFlash, setShowGoldFlash] = useState(false);

  // Trigger flash sheen when revealed
  useEffect(() => {
    if (isRevealed) {
      setShowGoldFlash(true);
      const timer = setTimeout(() => setShowGoldFlash(false), 800);
      return () => clearTimeout(timer);
    } else {
      setShowGoldFlash(false);
    }
  }, [isRevealed]);

  // Dynamic responsive font size based on text length to prevent clipping ("مشرو...")
  const getTextSizeClass = (text: string) => {
    const len = text.length;
    if (len <= 12) return 'text-lg sm:text-2xl md:text-3xl font-black';
    if (len <= 20) return 'text-base sm:text-xl md:text-2xl font-black';
    if (len <= 28) return 'text-sm sm:text-lg md:text-xl font-extrabold';
    return 'text-xs sm:text-base md:text-lg font-bold';
  };

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`relative min-h-[4.25rem] sm:min-h-[5rem] md:min-h-[5.75rem] h-auto w-full perspective-1200 ${
        interactive ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-transform' : ''
      }`}
    >
      {/* 3D Slat Flip Container: Flips along X-axis (rotateX) with hardware acceleration */}
      <div
        className={`relative h-full min-h-[4.25rem] sm:min-h-[5rem] md:min-h-[5.75rem] w-full transform-style-preserve-3d transition-transform duration-700 cubic-bezier(0.2, 0.8, 0.2, 1) rounded-2xl shadow-xl will-change-transform ${
          isRevealed ? 'rotate-x-180' : 'rotate-x-0'
        }`}
      >
        {/* FRONT SIDE (Hidden): Dark Blue Slat with Metallic Gold Ring & Number */}
        <div className="absolute inset-0 backface-hidden flex items-center justify-center rounded-2xl border-3 border-amber-400/80 bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 px-4 shadow-[inset_0_3px_15px_rgba(59,130,246,0.35),0_6px_20px_rgba(0,0,0,0.6)]">
          {/* Slat bevel groove highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-xl" />
          <div className="pointer-events-none absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:10px_10px]" />

          {/* Number Emblem */}
          <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 items-center justify-center rounded-full border-3 border-amber-300 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-display font-black text-xl sm:text-2xl md:text-3xl shadow-[0_0_20px_rgba(251,191,36,0.7)]">
            {index + 1}
          </div>
        </div>

        {/* BACK SIDE (Revealed): Big Text & Points Box - No ellipsis, dynamic multi-line scale */}
        <div
          style={{ transform: 'rotateX(180deg)' }}
          className="absolute inset-0 backface-hidden flex items-center justify-between gap-2 sm:gap-3 rounded-2xl border-3 border-amber-400 bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 px-3 sm:px-4 md:px-5 py-1.5 shadow-[0_0_25px_rgba(59,130,246,0.6),inset_0_2px_8px_rgba(255,255,255,0.2)] overflow-hidden"
        >
          {/* Top slat bevel highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent rounded-t-xl" />

          {/* Golden Sheen Flash Animation when first revealed */}
          {showGoldFlash && (
            <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-transparent via-amber-200/50 to-transparent animate-gold-sheen" />
          )}

          {/* Answer Text - Scaled dynamically without ellipsis or cutting letters */}
          <div className="relative z-10 flex-1 min-w-0 pr-1 text-right flex items-center overflow-visible">
            <span
              className={`font-display text-white leading-tight break-words drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${getTextSizeClass(
                answerText
              )}`}
            >
              {answerText}
            </span>
          </div>

          {/* Points Box Badge */}
          <div className="relative z-10 flex h-10 min-w-12 sm:h-12 sm:min-w-15 md:h-14 md:min-w-18 shrink-0 items-center justify-center rounded-xl border-2 sm:border-3 border-amber-300 bg-gradient-to-b from-amber-300 via-amber-500 to-yellow-600 px-2 sm:px-3 text-slate-950 font-display font-black text-xl sm:text-2xl md:text-3xl tabular-nums shadow-[0_0_15px_rgba(251,191,36,0.6),inset_0_2px_4px_rgba(255,255,255,0.7)]">
            {points}
          </div>
        </div>
      </div>
    </div>
  );
}
