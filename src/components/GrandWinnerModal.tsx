import { Team } from '../types/game';
import { Confetti } from './Confetti';
import { IbnTaymiyyahLogo } from './IbnTaymiyyahLogo';

interface GrandWinnerModalProps {
  winner: 'A' | 'B' | 'TIE';
  teamA: Team;
  teamB: Team;
  onRestart: () => void;
  onClose: () => void;
}

export function GrandWinnerModal({
  winner,
  teamA,
  teamB,
  onRestart,
  onClose,
}: GrandWinnerModalProps) {
  const winningTeam = winner === 'A' ? teamA : teamB;
  const losingTeam = winner === 'A' ? teamB : teamA;
  const isTie = winner === 'TIE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
      <Confetti active={true} />

      {/* Dramatic ambient lights */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-amber-500/25 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-emerald-600/20 blur-[130px]" />

      <div className="relative z-10 w-full max-w-2xl rounded-[40px] border-4 border-amber-400 bg-gradient-to-b from-blue-950 via-slate-950 to-blue-950 p-6 md:p-10 text-center shadow-[0_0_80px_rgba(245,158,11,0.8),inset_0_2px_20px_rgba(255,255,255,0.4)] animate-strike">
        {/* Top Mosque Logo + Trophy */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <IbnTaymiyyahLogo className="h-16 w-16 md:h-20 md:w-20" />
          <div className="flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-3xl border-3 border-amber-400 bg-gradient-to-b from-amber-400 to-amber-600 text-4xl md:text-5xl shadow-[0_0_30px_rgba(251,191,36,0.8)] animate-bounce">
            🏆
          </div>
        </div>

        {/* Grand Title */}
        <span className="inline-block rounded-full border border-amber-400/80 bg-amber-500/20 px-5 py-1 text-xs md:text-sm font-black text-amber-300 uppercase tracking-widest mb-2 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
          مسجد ابن تيمية · ختام المسابقة الكبير
        </span>

        {isTie ? (
          <div>
            <h2 className="font-display font-black text-3xl md:text-5xl text-gold-gradient mb-2">
              تعادل تاريخي حماسي! 🤝
            </h2>
            <p className="text-sm md:text-base text-slate-200">
              تساوى الفريقان في مجموع النقاط برصيد ({teamA.score}) نقطة لكل منهما!
            </p>
          </div>
        ) : (
          <div>
            <h3 className="font-display font-black text-xl md:text-2xl text-amber-200 mb-1">
              🏆 تتويج بطل مسابقة فاميلي فيود 🏆
            </h3>
            {/* Giant Winning Team Name */}
            <div className="my-4 py-2">
              <span
                className="font-display font-black text-4xl sm:text-5xl md:text-6xl text-gold-gradient block"
                style={{
                  textShadow: '0 4px 15px rgba(245,158,11,0.6)',
                }}
              >
                {winningTeam.name}
              </span>
              <span className="block text-sm md:text-lg font-bold text-emerald-400 mt-1">
                🎉 ألف مبروك الفوز الساحق والمركز الأول! 🎉
              </span>
            </div>
          </div>
        )}

        {/* Scores Podium Breakdown */}
        <div className="my-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-950/40 p-4 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
            <span className="text-xs font-bold text-amber-300 block mb-1 truncate">
              🥇 {winningTeam.name}
            </span>
            <span className="font-display font-black text-3xl md:text-5xl text-gold-gradient tabular-nums">
              {winningTeam.score}
            </span>
            <span className="block text-[11px] text-slate-400 mt-0.5">نقطة</span>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <span className="text-xs font-bold text-slate-400 block mb-1 truncate">
              🥈 {losingTeam.name}
            </span>
            <span className="font-display font-black text-3xl md:text-5xl text-slate-300 tabular-nums">
              {losingTeam.score}
            </span>
            <span className="block text-[11px] text-slate-400 mt-0.5">نقطة</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            className="flex-1 min-w-[200px] cursor-pointer rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 py-3.5 px-6 font-display font-black text-base text-slate-950 shadow-[0_0_25px_rgba(251,191,36,0.7)] hover:brightness-110 active:scale-95 transition-all"
          >
            بدء مباراة جديدة ↺
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="cursor-pointer rounded-2xl border border-slate-700 bg-slate-800/90 py-3.5 px-6 font-bold text-sm text-slate-200 hover:bg-slate-700 active:scale-95 transition-all"
          >
            إغلاق العرض ✕
          </button>
        </div>
      </div>
    </div>
  );
}
