import { useState, useEffect, useRef } from 'react';
import { GameState } from '../types/game';
import { FlipCard } from './FlipCard';
import { StrikesIndicator, StrikeOverlay } from './StrikesIndicator';
import { MarqueeArch } from './MarqueeArch';
import { Confetti } from './Confetti';
import { FeudLogo } from './FeudLogo';
import { IbnTaymiyyahLogo } from './IbnTaymiyyahLogo';
import { GrandWinnerModal } from './GrandWinnerModal';
import { AnimatedCounter } from './AnimatedCounter';

interface AudienceScreenProps {
  state: GameState;
  onOpenControllerTab?: () => void;
  onRestartGame?: () => void;
  onDismissGameOver?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  p2pConnected?: boolean;
  p2pPeerCount?: number;
  roomId?: string;
}

export function AudienceScreen({
  state,
  onRestartGame,
  onDismissGameOver,
  onToggleFullscreen,
  isFullscreen = false,
  p2pConnected = false,
  p2pPeerCount = 0,
  roomId = 'FEUD',
}: AudienceScreenProps) {
  const isGameOver = state.phase === 'GAME_OVER';
  const [isModalDismissed, setIsModalDismissed] = useState(false);

  // Interactive Lighting & Strike Flash Hooks
  const [showStrikeFlash, setShowStrikeFlash] = useState(false);
  const [showCorrectFlash, setShowCorrectFlash] = useState(false);
  const prevStrikesRef = useRef(state.strikes);
  const prevRevealedCountRef = useRef(
    state.revealedAnswers ? state.revealedAnswers.filter(Boolean).length : 0
  );

  // Detect new strikes to trigger dramatic screen shake & studio red strobe
  useEffect(() => {
    if (state.strikes > prevStrikesRef.current && state.strikes > 0) {
      setShowStrikeFlash(true);
      const timer = setTimeout(() => setShowStrikeFlash(false), 1100);
      return () => clearTimeout(timer);
    }
    prevStrikesRef.current = state.strikes;
  }, [state.strikes]);

  // Detect newly revealed answers to trigger interactive golden stage pulse
  useEffect(() => {
    const revealedCount = state.revealedAnswers
      ? state.revealedAnswers.filter(Boolean).length
      : 0;
    if (revealedCount > prevRevealedCountRef.current) {
      setShowCorrectFlash(true);
      const timer = setTimeout(() => setShowCorrectFlash(false), 850);
      return () => clearTimeout(timer);
    }
    prevRevealedCountRef.current = revealedCount;
  }, [state.revealedAnswers]);

  // Reset modal dismissed state if phase changes
  useEffect(() => {
    if (state.phase !== 'GAME_OVER') {
      setIsModalDismissed(false);
    }
  }, [state.phase]);

  const roundMultiplierBadge = () => {
    if (state.roundMultiplier === 2) return 'الجولة 3 (نقاط مضاعفة ×2)';
    if (state.roundMultiplier === 3) return 'الجولة 4 (نقاط ثلاثية ×3)';
    return `الجولة ${state.currentRound} من 4 (نقاط عادية ×1)`;
  };

  const getWinner = (): 'A' | 'B' | 'TIE' => {
    if (state.teamA.score > state.teamB.score) return 'A';
    if (state.teamB.score > state.teamA.score) return 'B';
    return 'TIE';
  };

  return (
    <div
      className={`relative min-h-screen w-full feud-stage-bg flex flex-col justify-between overflow-x-hidden p-3 md:p-6 select-none transition-all ${
        showStrikeFlash ? 'animate-screen-shake' : ''
      }`}
    >
      {/* Interactive Stage Lighting Architecture */}
      <MarqueeArch isCorrectFlash={showCorrectFlash} isStrikeFlash={showStrikeFlash} />

      {/* Dramatic Instantaneous Red Studio Strobe on Strike */}
      {showStrikeFlash && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-red-600/40 animate-red-strobe" />
      )}

      {/* Giant Screen Strike Overlay */}
      <StrikeOverlay
        count={state.strikes || state.strikeOverlayCount || 1}
        active={showStrikeFlash || state.strikeOverlayActive}
      />

      <Confetti active={isGameOver} />

      {/* Top Header: Feud Logo in center/right + Mosque Logo on the left */}
      <header className="relative z-10 mx-auto w-full max-w-7xl flex items-center justify-between pb-3 md:pb-5 border-b border-amber-500/20">
        {/* Right side in RTL: Family Feud Logo (English Only) */}
        <div className="flex items-center gap-3">
          <FeudLogo size="medium" />
        </div>

        {/* Center: Round Badge & Fullscreen Button */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 rounded-2xl border-2 border-amber-400/80 bg-slate-950/90 px-4 py-2 shadow-[0_0_25px_rgba(251,191,36,0.35)]">
            <span
              className={`font-display font-black text-xs md:text-sm px-2.5 py-0.5 rounded-md ${
                state.roundMultiplier > 1
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'text-amber-300'
              }`}
            >
              {roundMultiplierBadge()}
            </span>
          </div>

          {p2pConnected && (
            <div
              title={`ريموت الهاتف متصل (${p2pPeerCount}) كود الغرفة: ${roomId}`}
              className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-emerald-500/50 bg-emerald-950/80 px-3 py-1.5 text-xs font-bold text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>📱 ريموت متصل</span>
            </div>
          )}

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={
                isFullscreen
                  ? 'الخروج من ملء الشاشة'
                  : 'تكبير الشاشة بالكامل (إخفاء سيرش جوجل وأشرطة المتصفح)'
              }
              className="flex items-center gap-1.5 rounded-2xl border-2 border-amber-400/80 bg-slate-950/90 hover:bg-slate-900 px-3.5 py-2 text-xs font-bold text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.3)] active:scale-95 transition-all"
            >
              <span>{isFullscreen ? '🗗' : '⛶'}</span>
              <span className="hidden md:inline">{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>
          )}
        </div>

        {/* Left side in RTL: Ibn Taymiyyah Mosque Logo */}
        <div className="flex items-center gap-3">
          <IbnTaymiyyahLogo className="h-16 w-16 md:h-20 md:w-20" />
        </div>
      </header>

      {/* Main Center Stage: Left Team | Center Board & Bank | Right Team */}
      <main className="relative z-10 mx-auto my-auto w-full max-w-7xl py-3 flex flex-col items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-center gap-4 lg:gap-6">
          {/* Team A Podium (Right side in RTL) */}
          <div className="lg:col-span-3 flex flex-col items-center">
            <div
              className={`w-full rounded-3xl border-3 p-4 md:p-6 transition-all duration-300 ${
                state.activeTeam === 'A'
                  ? 'border-amber-400 bg-gradient-to-b from-blue-900 to-blue-950 shadow-[0_0_40px_rgba(251,191,36,0.6)] ring-4 ring-amber-400/30 scale-[1.02]'
                  : 'border-blue-700/50 bg-slate-950/90'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 truncate">
                  <span className="flex h-4 w-4 rounded-full bg-blue-400 shadow-[0_0_12px_#60a5fa]" />
                  <span className="font-display font-black text-xl md:text-2xl text-white truncate">
                    {state.teamA.name}
                  </span>
                </div>
                {state.activeTeam === 'A' && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-display text-xs font-black text-slate-950 animate-pulse">
                    دور اللعب
                  </span>
                )}
              </div>

              {/* Score Number Display with Animated Counter */}
              <div className="flex h-20 md:h-26 items-center justify-center rounded-2xl border-2 border-amber-400/80 bg-slate-950 shadow-[inset_0_3px_12px_rgba(0,0,0,0.9)]">
                <AnimatedCounter
                  value={state.teamA.score}
                  className="font-display font-black text-5xl md:text-7xl text-gold-gradient"
                />
              </div>
            </div>
          </div>

          {/* Central Main Stage: Giant Bank Score + The Central Answers Box */}
          <div className="lg:col-span-6 flex flex-col items-center gap-3 sm:gap-4">
            {/* Giant Glowing "بنك نقاط الجولة" directly on top of the board */}
            <div className="relative rounded-3xl border-4 border-amber-400 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800 p-1 shadow-[0_0_55px_rgba(245,158,11,0.7)]">
              <div className="rounded-[22px] bg-slate-950 px-8 py-3.5 md:px-14 md:py-4 text-center">
                <span className="block text-xs md:text-sm font-black text-amber-300 uppercase tracking-widest">
                  بنك نقاط الجولة
                </span>
                <div className="flex items-center justify-center">
                  <AnimatedCounter
                    value={state.roundBank}
                    className="font-display font-black text-6xl md:text-8xl text-gold-gradient"
                  />
                </div>
                {state.roundMultiplier > 1 && (
                  <span className="mt-1 inline-block rounded-md bg-amber-400/20 px-3 py-0.5 text-xs font-black text-amber-300 border border-amber-400/40 animate-pulse">
                    مضاعف ×{state.roundMultiplier}
                  </span>
                )}
              </div>
            </div>

            {/* Strikes indicator */}
            <StrikesIndicator strikes={state.strikes} />

            {/* Steal alert stinger if active */}
            {state.phase === 'STEAL' && (
              <div className="w-full rounded-2xl border-2 border-red-500 bg-gradient-to-r from-red-950 via-amber-950 to-red-950 p-2.5 text-center shadow-[0_0_25px_rgba(239,68,68,0.7)] animate-pulse">
                <span className="font-display font-black text-sm md:text-base text-amber-200">
                  ⚡ فرصة سرقة النقاط (The Steal)!
                </span>
              </div>
            )}

            {/* The Big Center Box with 3D Slat Flip cards */}
            <div className="w-full rounded-3xl border-4 border-amber-400/90 bg-gradient-to-b from-blue-950 via-slate-950 to-blue-950 p-3 sm:p-5 shadow-[0_0_65px_rgba(30,58,138,0.9)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {state.currentQuestion?.answers.map((answer, index) => (
                  <FlipCard
                    key={index}
                    index={index}
                    answerText={answer.text}
                    points={answer.points}
                    isRevealed={Boolean(state.revealedAnswers[index])}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Team B Podium (Left side in RTL) */}
          <div className="lg:col-span-3 flex flex-col items-center">
            <div
              className={`w-full rounded-3xl border-3 p-4 md:p-6 transition-all duration-300 ${
                state.activeTeam === 'B'
                  ? 'border-amber-400 bg-gradient-to-b from-blue-900 to-blue-950 shadow-[0_0_40px_rgba(251,191,36,0.6)] ring-4 ring-amber-400/30 scale-[1.02]'
                  : 'border-blue-700/50 bg-slate-950/90'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 truncate">
                  <span className="flex h-4 w-4 rounded-full bg-indigo-400 shadow-[0_0_12px_#818cf8]" />
                  <span className="font-display font-black text-xl md:text-2xl text-white truncate">
                    {state.teamB.name}
                  </span>
                </div>
                {state.activeTeam === 'B' && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-display text-xs font-black text-slate-950 animate-pulse">
                    دور اللعب
                  </span>
                )}
              </div>

              {/* Score Number Display with Animated Counter */}
              <div className="flex h-20 md:h-26 items-center justify-center rounded-2xl border-2 border-amber-400/80 bg-slate-950 shadow-[inset_0_3px_12px_rgba(0,0,0,0.9)]">
                <AnimatedCounter
                  value={state.teamB.score}
                  className="font-display font-black text-5xl md:text-7xl text-gold-gradient"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stage Bottom Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-7xl pt-2 border-t border-amber-500/20 text-center text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-200/80">مسجد ابن تيمية · فاميلي فيود</span>
          <span className="text-[11px] text-amber-300/80 font-mono">
            الجولة {state.currentRound} من 4
          </span>
        </div>
      </footer>

      {/* Enthusiastic Grand Winner Modal */}
      {isGameOver && !isModalDismissed && (
        <GrandWinnerModal
          winner={getWinner()}
          teamA={state.teamA}
          teamB={state.teamB}
          onRestart={() => {
            setIsModalDismissed(false);
            if (onRestartGame) onRestartGame();
          }}
          onClose={() => {
            setIsModalDismissed(true);
            if (onDismissGameOver) onDismissGameOver();
          }}
        />
      )}
    </div>
  );
}
