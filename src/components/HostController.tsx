import { useState } from 'react';
import { GameState, Question } from '../types/game';
import { INITIAL_QUESTIONS } from '../data/questions';
import { getMultiplierForRound, pickNewQuestion } from '../utils/gameDefaults';
import { FeudLogo } from './FeudLogo';
import { IbnTaymiyyahLogo } from './IbnTaymiyyahLogo';
import { AnimatedCounter } from './AnimatedCounter';

interface HostControllerProps {
  state: GameState;
  updateState: (updater: (prev: GameState) => GameState) => void;
  triggerSound: (sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal') => void;
  onOpenConnectModal?: () => void;
  onSwitchToAudience?: () => void;
  p2pConnected?: boolean;
  roomId?: string;
}

export function HostController({
  state,
  updateState,
  triggerSound,
  onOpenConnectModal,
  onSwitchToAudience,
  p2pConnected = false,
  roomId = 'FEUD',
}: HostControllerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showQuestionsDrawer, setShowQuestionsDrawer] = useState<boolean>(false);
  const [showTeamEditModal, setShowTeamEditModal] = useState<boolean>(false);

  const categories = [
    'الكل',
    'مواقف وحياة يومية',
    'العائلة والطفولة والبيت',
    'الطعام والطبخ والمطاعم',
    'تكنولوجيا وشبكات التواصل',
    'السفر، العمل والوظائف',
  ];

  // Interactive Haptic Feedback for Mobile Remote Pro
  const triggerHaptic = (pattern: number | number[] = 50) => {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Reveal a specific answer
  const handleRevealAnswer = (index: number) => {
    if (!state.currentQuestion) return;
    const answer = state.currentQuestion.answers[index];
    const isCurrentlyRevealed = state.revealedAnswers[index];

    triggerHaptic(isCurrentlyRevealed ? 35 : 60);

    updateState((prev) => {
      const newRevealed = [...prev.revealedAnswers];
      newRevealed[index] = !isCurrentlyRevealed;

      const pointsDiff = (answer.points * prev.roundMultiplier) * (isCurrentlyRevealed ? -1 : 1);
      const newBank = Math.max(0, prev.roundBank + pointsDiff);

      return {
        ...prev,
        revealedAnswers: newRevealed,
        roundBank: newBank,
      };
    });

    if (!isCurrentlyRevealed) {
      triggerSound('chime');
    }
  };

  // Trigger strike - Instant state update with zero timeout lag
  const handleStrike = () => {
    triggerHaptic([100, 50, 100]);

    updateState((prev) => {
      const nextStrikes = Math.min(3, prev.strikes + 1);
      const enterSteal = nextStrikes === 3 && prev.phase === 'GUESSING';

      return {
        ...prev,
        strikes: nextStrikes,
        phase: enterSteal ? 'STEAL' : prev.phase,
        stealTeam: enterSteal ? (prev.activeTeam === 'A' ? 'B' : 'A') : prev.stealTeam,
      };
    });

    triggerSound('strike');
  };

  // Reset strikes
  const handleResetStrikes = () => {
    triggerHaptic(40);
    updateState((prev) => ({
      ...prev,
      strikes: 0,
      strikeOverlayActive: false,
    }));
  };

  // Face off selection
  const handleSetTurn = (team: 'A' | 'B') => {
    triggerHaptic(45);
    triggerSound('bell');
    updateState((prev) => ({
      ...prev,
      activeTeam: team,
      phase: 'GUESSING',
    }));
  };

  // Award round bank to team
  const handleAwardBank = (team: 'A' | 'B') => {
    triggerHaptic([80, 40, 80, 40, 160]);
    updateState((prev) => {
      const teamAAdd = team === 'A' ? prev.roundBank : 0;
      const teamBAdd = team === 'B' ? prev.roundBank : 0;

      return {
        ...prev,
        teamA: { ...prev.teamA, score: prev.teamA.score + teamAAdd },
        teamB: { ...prev.teamB, score: prev.teamB.score + teamBAdd },
        roundBank: 0,
        phase: 'ROUND_OVER',
      };
    });
  };

  // Resolve Steal
  const handleResolveSteal = (success: boolean) => {
    triggerHaptic(success ? [70, 40, 120] : [120, 60, 120]);
    if (success) {
      updateState((prev) => {
        const beneficiary = prev.stealTeam || (prev.activeTeam === 'A' ? 'B' : 'A');
        const teamAAdd = beneficiary === 'A' ? prev.roundBank : 0;
        const teamBAdd = beneficiary === 'B' ? prev.roundBank : 0;

        return {
          ...prev,
          teamA: { ...prev.teamA, score: prev.teamA.score + teamAAdd },
          teamB: { ...prev.teamB, score: prev.teamB.score + teamBAdd },
          roundBank: 0,
          phase: 'ROUND_OVER',
        };
      });
    } else {
      triggerSound('strike');
      updateState((prev) => {
        const beneficiary = prev.activeTeam || 'A';
        const teamAAdd = beneficiary === 'A' ? prev.roundBank : 0;
        const teamBAdd = beneficiary === 'B' ? prev.roundBank : 0;

        return {
          ...prev,
          teamA: { ...prev.teamA, score: prev.teamA.score + teamAAdd },
          teamB: { ...prev.teamB, score: prev.teamB.score + teamBAdd },
          roundBank: 0,
          phase: 'ROUND_OVER',
        };
      });
    }
  };

  // Next Round / Next Question
  const handleNextRound = () => {
    triggerHaptic([60, 40, 60]);
    updateState((prev) => {
      const nextRound = prev.currentRound < 4 ? prev.currentRound + 1 : prev.currentRound;
      const multiplier = getMultiplierForRound(nextRound);
      const nextQ = pickNewQuestion(INITIAL_QUESTIONS, prev.burntQuestionIds) || INITIAL_QUESTIONS[0];

      return {
        ...prev,
        currentRound: nextRound,
        roundMultiplier: multiplier,
        roundBank: 0,
        strikes: 0,
        activeTeam: null,
        faceOffWinner: null,
        stealTeam: null,
        phase: 'FACE_OFF',
        currentQuestion: nextQ,
        revealedAnswers: new Array(nextQ.answers.length).fill(false),
        burntQuestionIds: [...prev.burntQuestionIds, nextQ.id],
      };
    });
  };

  // Trigger Grand Victory Ceremony
  const handleEndGameAndCrownWinner = () => {
    triggerSound('fanfare');
    updateState((prev) => ({
      ...prev,
      phase: 'GAME_OVER',
    }));
  };

  // Select question from drawer
  const handleSelectQuestion = (q: Question) => {
    updateState((prev) => ({
      ...prev,
      currentQuestion: q,
      revealedAnswers: new Array(q.answers.length).fill(false),
      roundBank: 0,
      strikes: 0,
      faceOffWinner: null,
      stealTeam: null,
      phase: 'FACE_OFF',
      burntQuestionIds: prev.burntQuestionIds.includes(q.id) ? prev.burntQuestionIds : [...prev.burntQuestionIds, q.id],
    }));
    setShowQuestionsDrawer(false);
  };

  const filteredQuestions = INITIAL_QUESTIONS.filter((q) => {
    const matchesCat = selectedCategory === 'الكل' || selectedCategory === 'all' || q.category === selectedCategory;
    const matchesQuery = !searchQuery || q.questionText.includes(searchQuery) || q.answers.some(a => a.text.includes(searchQuery));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 pb-24">
      {/* Top Header: Logos & Primary Navigation */}
      <header className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <FeudLogo size="small" />
          <IbnTaymiyyahLogo className="h-10 w-10 md:h-12 md:w-12 hidden sm:flex" />
        </div>

        {/* Clear Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main button to switch/display Audience Screen */}
          {onSwitchToAudience && (
            <button
              onClick={onSwitchToAudience}
              className="flex items-center gap-1.5 rounded-xl border-2 border-emerald-400 bg-emerald-600 px-3.5 py-2 text-xs md:text-sm font-black text-white hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
            >
              <span>📺</span>
              <span>عرض شاشة التلفزيون</span>
            </button>
          )}

          {/* Dual Device Modal Button */}
          {onOpenConnectModal && (
            <button
              onClick={onOpenConnectModal}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 active:scale-95 transition-all"
            >
              <span>📱</span>
              <span>ربط الجوال (QR)</span>
            </button>
          )}

          {/* Crown Winner Button */}
          <button
            onClick={handleEndGameAndCrownWinner}
            className="flex items-center gap-1 rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            <span>🏆</span>
            <span>تتويج الفائز</span>
          </button>
        </div>
      </header>

      {/* Main Simplified Command Center */}
      <main className="mx-auto max-w-4xl space-y-4">
        {/* P2P Live Connection Status Badge */}
        <div
          className={`flex items-center justify-between px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-sm ${
            p2pConnected
              ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-amber-950/70 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                p2pConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span>
              {p2pConnected
                ? `🟢 متصل بالشاشة مباشرة عبر P2P (الغرفة: ${roomId})`
                : `🟡 جاري الاتصال المباشر بالشاشة... (الغرفة: ${roomId})`}
            </span>
          </div>
          <span className="font-mono text-[11px] bg-black/50 border border-slate-700 px-2 py-0.5 rounded-lg text-white">
            كود الغرفة: {roomId}
          </span>
        </div>

        {/* 1. Scoreboard Bar with Animated Counters */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          {/* Team A */}
          <div
            onClick={() => handleSetTurn('A')}
            className={`cursor-pointer rounded-2xl border-2 p-3 transition-all ${
              state.activeTeam === 'A'
                ? 'border-amber-400 bg-blue-950/80 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-[1.02]'
                : 'border-slate-800 bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-xs text-blue-300 font-bold truncate">
              <span>{state.teamA.name}</span>
              {state.activeTeam === 'A' && <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black">يلعب</span>}
            </div>
            <div className="font-display font-black text-2xl md:text-4xl text-white tabular-nums mt-0.5">
              <AnimatedCounter value={state.teamA.score} />
            </div>
          </div>

          {/* Round Bank */}
          <div className="rounded-2xl border-2 border-amber-400/80 bg-amber-950/30 p-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="text-[11px] md:text-xs font-black text-amber-300 uppercase block">
              بنك الجولة {state.currentRound}/4 {state.roundMultiplier > 1 ? `(×${state.roundMultiplier})` : ''}
            </span>
            <div className="font-display font-black text-3xl md:text-5xl text-gold-gradient tabular-nums">
              <AnimatedCounter value={state.roundBank} />
            </div>
          </div>

          {/* Team B */}
          <div
            onClick={() => handleSetTurn('B')}
            className={`cursor-pointer rounded-2xl border-2 p-3 transition-all ${
              state.activeTeam === 'B'
                ? 'border-amber-400 bg-blue-950/80 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-[1.02]'
                : 'border-slate-800 bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-xs text-indigo-300 font-bold truncate">
              <span>{state.teamB.name}</span>
              {state.activeTeam === 'B' && <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black">يلعب</span>}
            </div>
            <div className="font-display font-black text-2xl md:text-4xl text-white tabular-nums mt-0.5">
              <AnimatedCounter value={state.teamB.score} />
            </div>
          </div>
        </div>

        {/* 2. Current Question Box & Hidden Answers List (Mobile Remote Pro) */}
        <div className="rounded-3xl border-2 border-blue-500/40 bg-gradient-to-b from-blue-950 to-slate-950 p-4 md:p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-blue-500/20 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-300">
                سؤال الجولة {state.currentRound} · {state.currentQuestion?.category}
              </span>
              <span className="text-[11px] text-amber-400/90 font-bold hidden sm:inline">
                (الإجابات ظاهرة لك فقط حتى تكشفها)
              </span>
            </div>
            <button
              onClick={() => setShowQuestionsDrawer(true)}
              className="rounded-xl bg-blue-900/60 border border-blue-400/40 px-3 py-1.5 text-xs font-bold text-blue-200 hover:bg-blue-800 active:scale-95 transition-all"
            >
              📚 تغيير السؤال (بنك 105)
            </button>
          </div>

          <h2 className="font-display font-extrabold text-xl md:text-2xl text-white text-center py-1.5 leading-relaxed">
            "{state.currentQuestion?.questionText}"
          </h2>

          {/* 3. Answers Cards - Ergonomic Touch-Friendly for Phone Thumb */}
          <div className="mt-4 space-y-3">
            {state.currentQuestion?.answers.map((answer, index) => {
              const isRevealed = Boolean(state.revealedAnswers[index]);
              return (
                <div
                  key={index}
                  onClick={() => handleRevealAnswer(index)}
                  className={`cursor-pointer flex items-center justify-between rounded-2xl border-2 p-3 sm:p-4 min-h-[64px] active:scale-[0.99] transition-all select-none ${
                    isRevealed
                      ? 'border-emerald-400/90 bg-emerald-950/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                      : 'border-slate-700/80 bg-slate-900/95 hover:border-amber-400/60 hover:bg-slate-800/90 shadow-md'
                  }`}
                >
                  {/* Left: Slot Number & Answer text & Point value */}
                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden pr-1">
                    <span
                      className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl font-display font-black text-base sm:text-xl shadow ${
                        isRevealed
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      {index + 1}
                    </span>

                    <div className="flex flex-col min-w-0">
                      <span className="font-display font-black text-base sm:text-xl text-white block break-words leading-tight">
                        {answer.text}
                      </span>
                      <span className="text-xs sm:text-sm text-amber-300 font-extrabold flex items-center gap-1 mt-0.5">
                        <span>{answer.points} نقطة</span>
                        {isRevealed && (
                          <span className="text-[10px] text-emerald-300 font-bold bg-emerald-900/60 px-1.5 py-0.2 rounded">
                            مكشوف
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Right: Big Touch Button for Thumb */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRevealAnswer(index);
                    }}
                    className={`shrink-0 rounded-xl px-3.5 sm:px-5 py-2.5 sm:py-3 font-display font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 ${
                      isRevealed
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:brightness-110 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                    }`}
                  >
                    {isRevealed ? '✓ مكشوف على الشاشة' : 'اكشف الجواب 🔔'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Giant Strike Button & Steal Actions (Touch-Friendly) */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
          {/* Big Red Strike Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStrike}
              className="flex-1 flex items-center justify-center gap-3 rounded-2xl border-3 border-red-500 bg-gradient-to-b from-red-600 to-red-800 min-h-[64px] py-3.5 px-6 font-display font-black text-xl text-white shadow-[0_0_35px_rgba(239,68,68,0.55)] active:scale-95 hover:brightness-110 transition-all"
            >
              <span className="text-3xl leading-none">❌</span>
              <span>تسجيل خطأ ({state.strikes} من 3)</span>
            </button>
            {state.strikes > 0 && (
              <button
                onClick={handleResetStrikes}
                className="shrink-0 min-h-[64px] rounded-2xl border border-slate-700 bg-slate-800 px-5 text-xs font-bold text-slate-300 hover:bg-slate-700 active:scale-95 transition-all"
              >
                تصفير 0
              </button>
            )}
          </div>

          {/* Steal Banner if 3 Strikes */}
          {state.phase === 'STEAL' && (
            <div className="rounded-2xl border-2 border-red-500 bg-red-950/60 p-3.5 text-center animate-pulse">
              <span className="font-display font-bold text-sm md:text-base text-red-200 block mb-2">
                ⚡ فرصة سرقة النقاط (الفريق المتشاور: {state.stealTeam === 'A' ? state.teamA.name : state.teamB.name})
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleResolveSteal(true)}
                  className="rounded-xl bg-emerald-600 py-2.5 text-xs md:text-sm font-black text-white hover:bg-emerald-500 shadow"
                >
                  ✅ نجحت السرقة
                </button>
                <button
                  onClick={() => handleResolveSteal(false)}
                  className="rounded-xl bg-slate-700 py-2.5 text-xs md:text-sm font-black text-white hover:bg-slate-600"
                >
                  ❌ فشلت السرقة
                </button>
              </div>
            </div>
          )}

          {/* 5. Awarding Points to Team A or B */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <span className="text-xs text-slate-400 font-bold block mb-2 text-center">
              تحويل نقاط بنك الجولة ({state.roundBank} نقطة) إلى:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAwardBank('A')}
                className="rounded-xl border border-blue-500 bg-blue-700 py-2.5 px-3 text-xs md:text-sm font-black text-white hover:bg-blue-600 shadow"
              >
                تحويل لـ {state.teamA.name} ➔
              </button>
              <button
                onClick={() => handleAwardBank('B')}
                className="rounded-xl border border-indigo-500 bg-indigo-700 py-2.5 px-3 text-xs md:text-sm font-black text-white hover:bg-indigo-600 shadow"
              >
                ➔ تحويل لـ {state.teamB.name}
              </button>
            </div>
          </div>

          {/* 6. Advance to Next Round */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleNextRound}
              className="flex-1 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-display font-black text-sm md:text-base text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              {state.currentRound < 4 ? `الانتقال للجولة ${state.currentRound + 1} ⏭` : 'سؤال جديد ⏭'}
            </button>
            <button
              onClick={() => setShowTeamEditModal(true)}
              className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              تعديل أسماء الفرق ✏️
            </button>
          </div>
        </div>

        {/* 7. Quick Soundboard */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="text-xs font-bold text-slate-400 block mb-2">أصوات سريعة:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => triggerSound('chime')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-slate-700"
            >
              🔔 رنة كشف
            </button>
            <button
              onClick={() => triggerSound('strike')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-red-400 hover:bg-slate-700"
            >
              ❌ طنين خطأ
            </button>
            <button
              onClick={() => triggerSound('bell')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-blue-300 hover:bg-slate-700"
            >
              🛎 جرس
            </button>
            <button
              onClick={() => triggerSound('applause')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-slate-700"
            >
              👏 تصفيق
            </button>
            <button
              onClick={() => triggerSound('fanfare')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-yellow-300 hover:bg-slate-700"
            >
              🎺 تزمير الفوز
            </button>
          </div>
        </div>
      </main>

      {/* QUESTION BROWSER DRAWER */}
      {showQuestionsDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex h-[88vh] w-full max-w-3xl flex-col rounded-3xl border-2 border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <h3 className="font-display font-extrabold text-lg text-white">
                بنك الأسئلة (105 أسئلة)
              </h3>
              <button
                onClick={() => setShowQuestionsDrawer(false)}
                className="rounded-xl bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                ✕ إغلاق
              </button>
            </div>

            <div className="p-3 border-b border-slate-800 space-y-2">
              <input
                type="text"
                placeholder="ابحث في الأسئلة أو الأجوبة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-lg px-2 py-0.5 text-xs font-bold transition-colors ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] text-amber-400 font-bold">#{q.id} · {q.category}</span>
                    <h4 className="font-bold text-sm text-white">{q.questionText}</h4>
                  </div>
                  <button
                    onClick={() => handleSelectQuestion(q)}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 shadow"
                  >
                    اختيار ➔
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TEAM EDIT MODAL */}
      {showTeamEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="font-display font-bold text-lg text-white mb-3">
              تعديل أسماء ونقاط الفرق
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">اسم الفريق (أ):</label>
                <input
                  type="text"
                  value={state.teamA.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateState((prev) => ({ ...prev, teamA: { ...prev.teamA, name } }));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">اسم الفريق (ب):</label>
                <input
                  type="text"
                  value={state.teamB.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateState((prev) => ({ ...prev, teamB: { ...prev.teamB, name } }));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowTeamEditModal(false)}
                className="rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                تم الحفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
