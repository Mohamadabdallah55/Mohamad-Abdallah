import { useEffect, useMemo, useRef, useState } from 'react';
import { GameState } from '../types/game';
import { AnimatedCounter } from './AnimatedCounter';
import { GrandWinnerModal } from './GrandWinnerModal';
import { FlipCard } from './FlipCard';
import { StrikesIndicator, StrikeOverlay } from './StrikesIndicator';
import { MarqueeArch } from './MarqueeArch';
import { FeudLogo } from './FeudLogo';
import { IbnTaymiyyahLogo } from './IbnTaymiyyahLogo';
import { Confetti } from './Confetti';

interface AudienceScreenProps {
  state: GameState;
  onOpenControllerTab?: () => void;
  showReturnToHost?: boolean;
  onRestartGame?: () => void;
  onDismissGameOver?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  p2pConnected?: boolean;
  serverConnected?: boolean;
  p2pPeerCount?: number;
  roomId?: string;
}

export function AudienceScreen({
  state,
  onOpenControllerTab,
  showReturnToHost = false,
  onRestartGame,
  onDismissGameOver,
  onToggleFullscreen,
  isFullscreen = false,
  p2pConnected = false,
  roomId = 'FEUD',
}: AudienceScreenProps) {
  const [dismissed, setDismissed] = useState(false);
  const [strikeOverlayActive, setStrikeOverlayActive] = useState(false);
  const [isCorrectFlash, setIsCorrectFlash] = useState(false);
  const [isStrikeFlash, setIsStrikeFlash] = useState(false);
  const previousStrikes = useRef(state.strikes);
  const previousRevealedCount = useRef(
    state.revealedAnswers.filter(Boolean).length
  );

  // Trigger strike effects on strike increment
  useEffect(() => {
    if (state.strikes > previousStrikes.current) {
      setIsStrikeFlash(true);
      setStrikeOverlayActive(true);
      const timer = window.setTimeout(() => {
        setIsStrikeFlash(false);
        setStrikeOverlayActive(false);
      }, 1200);
      previousStrikes.current = state.strikes;
      return () => window.clearTimeout(timer);
    }
    previousStrikes.current = state.strikes;
  }, [state.strikes]);

  // Trigger correct answer flash sheen on arch
  useEffect(() => {
    const currentRevealed = state.revealedAnswers.filter(Boolean).length;
    if (currentRevealed > previousRevealedCount.current) {
      setIsCorrectFlash(true);
      const timer = window.setTimeout(() => setIsCorrectFlash(false), 900);
      previousRevealedCount.current = currentRevealed;
      return () => window.clearTimeout(timer);
    }
    previousRevealedCount.current = currentRevealed;
  }, [state.revealedAnswers]);

  useEffect(() => {
    if (state.phase !== 'GAME_OVER') setDismissed(false);
  }, [state.phase]);

  const winner = useMemo<'A' | 'B' | 'TIE'>(() => {
    if (state.teamA.score > state.teamB.score) return 'A';
    if (state.teamB.score > state.teamA.score) return 'B';
    return 'TIE';
  }, [state.teamA.score, state.teamB.score]);

  // Split answers into Column 1 (odd 1, 3, 5, 7 - indices 0, 2, 4, 6) and Column 2 (even 2, 4, 6, 8 - indices 1, 3, 5, 7)
  const answers = state.currentQuestion?.answers ?? [];
  const rightColumnAnswers: { answer: typeof answers[0]; originalIndex: number }[] = [];
  const leftColumnAnswers: { answer: typeof answers[0]; originalIndex: number }[] = [];

  answers.forEach((ans, idx) => {
    if (idx % 2 === 0) {
      rightColumnAnswers.push({ answer: ans, originalIndex: idx });
    } else {
      leftColumnAnswers.push({ answer: ans, originalIndex: idx });
    }
  });

  return (
    <div
      className="relative w-screen h-screen min-h-screen overflow-hidden feud-stage-bg flex flex-col justify-between select-none p-3 md:p-5 text-white"
      dir="rtl"
    >
      {/* Studio Arch Bulbs & Spotlights */}
      <MarqueeArch
        isCorrectFlash={isCorrectFlash}
        isStrikeFlash={isStrikeFlash}
      />

      {/* Confetti when game ends */}
      <Confetti active={state.phase === 'GAME_OVER'} />

      {/* Top Studio Header Bar */}
      <header className="relative z-20 flex items-center justify-between gap-3 w-full max-w-7xl mx-auto px-2">
        {/* Right: Ibn Taymiyyah Mosque Emblem */}
        <div className="flex items-center gap-2.5">
          <IbnTaymiyyahLogo className="h-11 w-11 md:h-14 md:w-14" />
          <div className="hidden sm:flex flex-col">
            <span className="font-display font-black text-xs md:text-sm text-amber-300">
              مسجد ابن تيمية
            </span>
            <span className="text-[10px] md:text-xs text-slate-300">
              المنافسات الثقافية
            </span>
          </div>
        </div>

        {/* Center: FAMILY FEUD Logo */}
        <div className="flex-1 flex justify-center">
          <FeudLogo size="medium" />
        </div>

        {/* Left: Round Multiplier & Fullscreen toggle */}
        <div className="flex items-center gap-2">
          {/* Round multiplier badge */}
          <div className="flex items-center gap-1.5 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-r from-blue-950 to-slate-900 px-3 py-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <span className="text-xs md:text-sm font-black text-amber-300 font-display">
              الجولة {state.currentRound}
            </span>
            {state.roundMultiplier > 1 && (
              <span className="rounded-lg bg-amber-400 px-1.5 py-0.5 text-[10px] md:text-xs font-black text-slate-950">
                ×{state.roundMultiplier}
              </span>
            )}
          </div>

          {/* Connection Chip */}
          <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                p2pConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono">{roomId}</span>
          </div>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
              className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl border border-amber-400/50 bg-slate-900/90 text-amber-300 hover:text-white hover:bg-slate-800 transition-colors shadow"
            >
              ⛶
            </button>
          )}

          {/* Return to Host Remote Tab (if opened from host tab) */}
          {showReturnToHost && onOpenControllerTab && (
            <button
              onClick={onOpenControllerTab}
              className="rounded-xl border border-blue-400/60 bg-blue-900/60 px-3 py-1.5 text-xs font-bold text-blue-200 hover:bg-blue-800 transition-colors"
            >
              ← التحكم
            </button>
          )}
        </div>
      </header>

      {/* Main Broadcast Stage (Full 16:9 Landscape Area) */}
      <main className="relative z-10 flex-1 flex items-center justify-between gap-3 md:gap-6 w-full max-w-7xl mx-auto my-auto px-2">
        {/* Team A Podium (Right Side) */}
        <aside className="w-40 sm:w-52 md:w-60 lg:w-68 shrink-0 flex flex-col items-center">
          <div
            className={`w-full rounded-3xl border-3 md:border-4 transition-all duration-300 p-3 sm:p-4 text-center bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 ${
              state.activeTeam === 'A'
                ? 'border-amber-300 shadow-[0_0_35px_rgba(251,191,36,0.65),inset_0_2px_10px_rgba(255,255,255,0.3)] scale-[1.03]'
                : 'border-blue-600/50 shadow-[0_0_20px_rgba(30,58,138,0.4)] opacity-90'
            }`}
          >
            {/* Active turn badge */}
            <div className="mb-1.5 flex justify-center">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-black ${
                  state.activeTeam === 'A'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                    : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                {state.activeTeam === 'A' ? 'الدور الآن ⚡' : 'الفريق الأول'}
              </span>
            </div>

            {/* Team Name */}
            <h2 className="font-display font-black text-base sm:text-xl md:text-2xl text-white truncate drop-shadow">
              {state.teamA.name}
            </h2>

            {/* Giant Score Display */}
            <div className="mt-2.5 rounded-2xl border-2 sm:border-3 border-blue-400/70 bg-gradient-to-b from-blue-800 via-blue-950 to-slate-950 py-2 sm:py-3 px-2 shadow-[inset_0_2px_8px_rgba(255,255,255,0.25)]">
              <span className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                <AnimatedCounter value={state.teamA.score} duration={600} />
              </span>
              <span className="block text-[11px] font-bold text-blue-200 mt-0.5">
                نقطة
              </span>
            </div>
          </div>
        </aside>

        {/* Center Stage: Header Crown Bank + Question + Answers Board + Strikes */}
        <section className="flex-1 min-w-0 flex flex-col items-center justify-center max-w-4xl mx-auto">
          {/* Header Crown Scoreboard (Bank Points in Giant Numbers) */}
          <div className="relative mb-2 sm:mb-3 flex flex-col items-center">
            {/* The Royal Blue Score Box with Thick Gold Beveled Border (matching Family Feud TV Photo) */}
            <div className="relative flex min-w-[170px] sm:min-w-[240px] md:min-w-[300px] items-center justify-center rounded-2xl md:rounded-3xl border-3 md:border-5 border-amber-300 bg-gradient-to-b from-[#124294] via-[#0b296b] to-[#05153b] px-6 sm:px-10 py-1 sm:py-2 shadow-[0_0_40px_rgba(251,191,36,0.55),inset_0_3px_12px_rgba(255,255,255,0.4)]">
              <span className="font-display font-black text-5xl sm:text-7xl md:text-8xl text-white tracking-wider tabular-nums drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
                <AnimatedCounter value={state.roundBank} duration={500} />
              </span>
            </div>

            {/* Strikes Indicator below bank */}
            <div className="mt-2 flex items-center justify-center">
              <StrikesIndicator strikes={state.strikes} />
            </div>

            {/* Steal Banner Alert */}
            {state.phase === 'STEAL' && (
              <div className="mt-2 rounded-xl border-2 border-amber-300 bg-red-950/90 px-4 py-1 text-center shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse">
                <span className="font-display font-black text-xs sm:text-sm md:text-base text-amber-200">
                  ⚡ فرصة سرقة البنك لـ {state.stealTeam === 'A' ? state.teamA.name : state.teamB.name}!
                </span>
              </div>
            )}
          </div>

          {/* Main Answer Board: 2 Balanced Columns with Metallic Gold Border Frame */}
          <div className="w-full rounded-2xl sm:rounded-3xl border-3 sm:border-4 border-amber-400/90 bg-gradient-to-b from-slate-950 via-blue-950/70 to-slate-950 p-2 sm:p-3 shadow-[0_0_35px_rgba(245,158,11,0.35),inset_0_2px_10px_rgba(0,0,0,0.8)]">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
              {/* Column 1 (Right in RTL - Odd Answers: 1, 3, 5, 7) */}
              <div className="flex flex-col gap-2 sm:gap-3">
                {rightColumnAnswers.map(({ answer, originalIndex }) => (
                  <FlipCard
                    key={`${state.currentQuestion?.id ?? 'q'}-${originalIndex}`}
                    index={originalIndex}
                    answerText={answer.text}
                    points={answer.points}
                    isRevealed={Boolean(state.revealedAnswers[originalIndex])}
                  />
                ))}
              </div>

              {/* Column 2 (Left in RTL - Even Answers: 2, 4, 6, 8) */}
              <div className="flex flex-col gap-2 sm:gap-3">
                {leftColumnAnswers.map(({ answer, originalIndex }) => (
                  <FlipCard
                    key={`${state.currentQuestion?.id ?? 'q'}-${originalIndex}`}
                    index={originalIndex}
                    answerText={answer.text}
                    points={answer.points}
                    isRevealed={Boolean(state.revealedAnswers[originalIndex])}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Team B Podium (Left Side) */}
        <aside className="w-40 sm:w-52 md:w-60 lg:w-68 shrink-0 flex flex-col items-center">
          <div
            className={`w-full rounded-3xl border-3 md:border-4 transition-all duration-300 p-3 sm:p-4 text-center bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 ${
              state.activeTeam === 'B'
                ? 'border-amber-300 shadow-[0_0_35px_rgba(251,191,36,0.65),inset_0_2px_10px_rgba(255,255,255,0.3)] scale-[1.03]'
                : 'border-blue-600/50 shadow-[0_0_20px_rgba(30,58,138,0.4)] opacity-90'
            }`}
          >
            {/* Active turn badge */}
            <div className="mb-1.5 flex justify-center">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-black ${
                  state.activeTeam === 'B'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                    : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                {state.activeTeam === 'B' ? 'الدور الآن ⚡' : 'الفريق الثاني'}
              </span>
            </div>

            {/* Team Name */}
            <h2 className="font-display font-black text-base sm:text-xl md:text-2xl text-white truncate drop-shadow">
              {state.teamB.name}
            </h2>

            {/* Giant Score Display */}
            <div className="mt-2.5 rounded-2xl border-2 sm:border-3 border-blue-400/70 bg-gradient-to-b from-blue-800 via-blue-950 to-slate-950 py-2 sm:py-3 px-2 shadow-[inset_0_2px_8px_rgba(255,255,255,0.25)]">
              <span className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                <AnimatedCounter value={state.teamB.score} duration={600} />
              </span>
              <span className="block text-[11px] font-bold text-blue-200 mt-0.5">
                نقطة
              </span>
            </div>
          </div>
        </aside>
      </main>

      {/* Subtle Broadcast Stage Footer */}
      <footer className="relative z-20 flex items-center justify-between text-[11px] md:text-xs text-slate-400 border-t border-amber-500/20 pt-2 px-4 max-w-7xl mx-auto w-full">
        <span>مسجد ابن تيمية · فاميلي فيود</span>
        <span className="text-amber-300 font-bold">
          {state.phase === 'ROUND_OVER'
            ? 'اكتملت الجولة'
            : state.phase === 'STEAL'
            ? 'مرحلة سرقة النقاط'
            : 'مباشر من استوديو المسجد'}
        </span>
      </footer>

      {/* Fullscreen Strike Buzzer Overlay */}
      <StrikeOverlay count={state.strikes} active={strikeOverlayActive} />

      {/* Grand Winner Modal when 4 Rounds complete */}
      {state.phase === 'GAME_OVER' && !dismissed && (
        <GrandWinnerModal
          winner={winner}
          teamA={state.teamA}
          teamB={state.teamB}
          onRestart={() => onRestartGame?.()}
          onClose={() => {
            setDismissed(true);
            onDismissGameOver?.();
          }}
        />
      )}
    </div>
  );
}
