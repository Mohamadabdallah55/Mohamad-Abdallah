import { Team } from '../types/game';
import { Confetti } from './Confetti';

interface GrandWinnerModalProps {
  winner: 'A' | 'B' | 'TIE';
  teamA: Team;
  teamB: Team;
  onRestart: () => void;
  onClose: () => void;
}

export function GrandWinnerModal({ winner, teamA, teamB, onRestart, onClose }: GrandWinnerModalProps) {
  const isTie = winner === 'TIE';
  const winningTeam = winner === 'A' ? teamA : teamB;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 select-none"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-title"
    >
      <Confetti active={!isTie} />

      <div className="relative w-full max-w-xl rounded-3xl border-4 border-amber-400 bg-gradient-to-b from-blue-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(245,158,11,0.5),inset_0_2px_12px_rgba(255,255,255,0.2)]">
        {/* Glow halo */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex h-24 w-24 items-center justify-center rounded-full border-4 border-amber-300 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 text-5xl shadow-[0_0_30px_rgba(251,191,36,0.8)]">
          🏆
        </div>

        <div className="pt-8">
          <span className="text-xs sm:text-sm font-bold text-amber-300 tracking-wider">
            مسجد ابن تيمية · اختتام المنافسة
          </span>
          <h2 id="winner-title" className="font-display font-black text-2xl sm:text-4xl text-white mt-1">
            {isTie ? 'تعادل الفريقان!' : 'الفائز باللقب!'}
          </h2>
          <p className="font-display font-black text-3xl sm:text-5xl text-amber-400 mt-2 text-gold-gradient">
            {isTie ? 'نتيجة متساوية' : winningTeam.name}
          </p>
        </div>

        {/* Score comparison */}
        <div className="my-6 grid grid-cols-2 gap-4">
          <div
            className={`rounded-2xl border-2 p-3 ${
              winner === 'A'
                ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'border-slate-800 bg-slate-950/60'
            }`}
          >
            <span className="text-xs font-bold text-slate-300 block">{teamA.name}</span>
            <span className="font-display font-black text-3xl sm:text-4xl text-white block mt-1">
              {teamA.score}
            </span>
            <span className="text-[11px] text-amber-300">نقطة</span>
          </div>

          <div
            className={`rounded-2xl border-2 p-3 ${
              winner === 'B'
                ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'border-slate-800 bg-slate-950/60'
            }`}
          >
            <span className="text-xs font-bold text-slate-300 block">{teamB.name}</span>
            <span className="font-display font-black text-3xl sm:text-4xl text-white block mt-1">
              {teamB.score}
            </span>
            <span className="text-[11px] text-amber-300">نقطة</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRestart}
            className="flex-1 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-400 to-amber-600 py-3 font-display font-black text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-lg"
          >
            بدء مباراة جديدة ↺
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3 font-bold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
