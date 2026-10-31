import { useEffect, useRef, useState } from 'react';
import { GameState, Question } from '../types/game';
import { QUESTION_BANK } from '../data/questionBank';
import { getMultiplierForRound, pickNewQuestion } from '../utils/gameDefaults';
import { AnimatedCounter } from './AnimatedCounter';
import { awardRound, completeGame, getTimerRemaining, resolveSteal } from '../utils/gameEngine';

interface HostControllerProps {
  state: GameState;
  updateState: (updater: (prev: GameState) => GameState) => void;
  triggerSound: (sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal') => void;
  onOpenConnectModal?: () => void;
  onSwitchToAudience?: () => void;
  p2pConnected?: boolean;
  serverConnected?: boolean;
  roomId?: string;
  onUndo?: () => void;
  onRestartGame?: () => void;
  canUndo?: boolean;
}

export function HostController({
  state,
  updateState,
  triggerSound,
  onOpenConnectModal,
  onSwitchToAudience,
  p2pConnected = false,
  serverConnected = false,
  roomId = 'FEUD',
  onUndo,
  onRestartGame,
  canUndo = false,
}: HostControllerProps) {
  const [questionBank, setQuestionBank] = useState<Question[]>(() => {
    try {
      const saved = localStorage.getItem('family_feud_easy_questions_v2');
      if (saved) {
        const parsed = JSON.parse(saved) as Question[];
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id < 10000) {
          return parsed;
        }
      }
      return QUESTION_BANK;
    } catch { return QUESTION_BANK; }
  });
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [bankMessage, setBankMessage] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const brandFileRef = useRef<HTMLInputElement>(null);
  const revealLock = useRef(new Map<number, number>());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showQuestionsDrawer, setShowQuestionsDrawer] = useState<boolean>(false);
  const [showTeamEditModal, setShowTeamEditModal] = useState<boolean>(false);
  const [showBrandSettings, setShowBrandSettings] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [brandMessage, setBrandMessage] = useState('');
  const [showEventLog, setShowEventLog] = useState(false);
  const [eventLog, setEventLog] = useState<Array<{ id: number; label: string; time: string }>>([]);
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    if (!state.timerRunning) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, [state.timerRunning]);

  const timerRemaining = getTimerRemaining(state, clockNow);
  const timerExpired = state.timerRunning && timerRemaining === 0;

  useEffect(() => {
    const labels: Record<string, string> = {
      FACE_OFF: 'استعداد الجولة', GUESSING: 'بدأ اللعب', STEAL: 'فرصة سرقة', ROUND_OVER: 'اعتماد نتيجة الجولة', GAME_OVER: 'إعلان الفائز',
    };
    const label = state.strikes === 3 && state.phase === 'STEAL' ? 'الخطأ الثالث — فرصة سرقة' : labels[state.phase];
    setEventLog((events) => {
      if (events.some((event) => event.id === state.actionId)) return events;
      return [...events, { id: state.actionId, label, time: new Date(state.lastUpdated).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }].slice(-80);
    });
  }, [state.actionId, state.phase, state.strikes, state.lastUpdated]);

  const categories = ['الكل', ...new Set(questionBank.map((question) => question.category))];

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
    if (!state.currentQuestion || state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER' || state.phase === 'STEAL') return;
    const now = Date.now();
    if (now - (revealLock.current.get(index) ?? 0) < 250) return;
    revealLock.current.set(index, now);
    const answer = state.currentQuestion.answers[index];
    if (!answer) return;
    const shouldReveal = !state.revealedAnswers[index];

    triggerHaptic(shouldReveal ? 60 : 35);

    updateState((prev) => {
      if (!prev.currentQuestion || prev.phase === 'ROUND_OVER' || prev.phase === 'GAME_OVER' || prev.phase === 'STEAL') return prev;
      if (prev.revealedAnswers[index] === shouldReveal) return prev;
      const newRevealed = [...prev.revealedAnswers];
      newRevealed[index] = shouldReveal;
      const newBank = prev.currentQuestion.answers.reduce((sum, item, answerIndex) => sum + (newRevealed[answerIndex] ? item.points : 0), 0);

      return {
        ...prev,
        revealedAnswers: newRevealed,
        roundBank: newBank,
      };
    });

    if (shouldReveal) triggerSound('chime');
  };

  // Trigger strike - Instant state update with zero timeout lag
  const handleStrike = () => {
    if (state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER') return;
    triggerHaptic([100, 50, 100]);

    updateState((prev) => {
      const nextStrikes = Math.min(3, prev.strikes + 1);
      const enterSteal = nextStrikes === 3 && prev.phase !== 'STEAL' && prev.phase !== 'ROUND_OVER';

      return {
        ...prev,
        strikes: nextStrikes,
        strikeOverlayActive: true,
        strikeOverlayCount: (prev.strikeOverlayCount || 0) + 1,
        phase: enterSteal ? 'STEAL' : prev.phase,
        stealTeam: enterSteal ? (prev.activeTeam === 'A' ? 'B' : 'A') : prev.stealTeam,
      };
    });

    triggerSound('strike');
  };

  // Trigger quick visual + audio strike (e.g. during Face-Off without adding to team's 3-strike limit)
  const handleQuickStrikeFlash = () => {
    triggerHaptic([100, 50, 100]);
    updateState((prev) => ({
      ...prev,
      strikeOverlayActive: true,
      strikeOverlayCount: (prev.strikeOverlayCount || 0) + 1,
    }));
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

  const handlePassTurn = () => {
    if (state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER') return;
    updateState((prev) => {
      const nextTeam = prev.activeTeam === 'A' ? 'B' : 'A';
      return {
        ...prev,
        originalTeam: prev.originalTeam || prev.activeTeam,
        activeTeam: nextTeam,
        phase: prev.strikes >= 3 ? 'STEAL' : 'GUESSING',
        stealTeam: prev.strikes >= 3 ? nextTeam : prev.stealTeam,
      };
    });
  };

  // Face off selection
  const handleSetTurn = (team: 'A' | 'B') => {
    if (state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER' || state.phase === 'STEAL') return;
    triggerHaptic(45);
    triggerSound('bell');
    updateState((prev) => ({
      ...prev,
      activeTeam: team,
      phase: 'GUESSING',
      originalTeam: team,
    }));
  };

  // Award round bank to team
  const handleAwardBank = (team: 'A' | 'B') => {
    if (state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER') return;
    triggerHaptic([80, 40, 80, 40, 160]);
    updateState((prev) => awardRound(prev, team));
  };

  // Resolve Steal
  const handleResolveSteal = (success: boolean) => {
    if (state.phase !== 'STEAL') return;
    triggerHaptic(success ? [70, 40, 120] : [120, 60, 120]);
    triggerSound(success ? 'steal' : 'strike');
    updateState((prev) => {
      const resolved = resolveSteal(prev, success);
      if (!success) {
        return {
          ...resolved,
          strikeOverlayActive: true,
          strikeOverlayCount: (prev.strikeOverlayCount || 0) + 1,
        };
      }
      return resolved;
    });
  };

  // Next Round / Next Question
  const handleNextRound = () => {
    if (state.currentRound >= 4 || state.phase !== 'ROUND_OVER') return;
    triggerHaptic([60, 40, 60]);
    updateState((prev) => {
      if (prev.phase !== 'ROUND_OVER' || prev.currentRound >= 4) return prev;
      const nextRound = prev.currentRound < 4 ? prev.currentRound + 1 : prev.currentRound;
      const multiplier = getMultiplierForRound(nextRound);
      const nextQ = pickNewQuestion(questionBank, prev.burntQuestionIds) || questionBank[0];

      return {
        ...prev,
        currentRound: nextRound,
        roundMultiplier: multiplier,
        roundBank: 0,
        strikes: 0,
        activeTeam: null,
        faceOffWinner: null,
        stealTeam: null,
        originalTeam: null,
        phase: 'FACE_OFF',
        awardedRound: null,
        timerSeconds: 30,
        timerRunning: false,
        timerEndsAt: null,
        currentQuestion: nextQ,
        revealedAnswers: new Array(nextQ.answers.length).fill(false),
        burntQuestionIds: [...prev.burntQuestionIds, nextQ.id],
      };
    });
  };

  // Trigger Grand Victory Ceremony
  const handleEndGameAndCrownWinner = () => {
    triggerSound('fanfare');
    updateState(completeGame);
  };

  // Select question from drawer
  const handleSelectQuestion = (q: Question) => {
    if (state.phase !== 'FACE_OFF' || state.roundBank !== 0 || state.revealedAnswers.some(Boolean) || state.awardedRound === state.currentRound) {
      setBankMessage('اختيار السؤال متاح قبل بدء الجولة فقط. أنهِ الجولة الحالية أولًا.');
      return;
    }
    updateState((prev) => ({
      ...prev,
      currentQuestion: q,
      revealedAnswers: new Array(q.answers.length).fill(false),
      roundBank: 0,
      strikes: 0,
      faceOffWinner: null,
      stealTeam: null,
      originalTeam: null,
      phase: 'FACE_OFF',
      awardedRound: null,
      burntQuestionIds: prev.burntQuestionIds.includes(q.id) ? prev.burntQuestionIds : [...prev.burntQuestionIds, q.id],
    }));
    setShowQuestionsDrawer(false);
  };

  const filteredQuestions = questionBank.filter((q) => {
    const matchesCat = selectedCategory === 'الكل' || selectedCategory === 'all' || q.category === selectedCategory;
    const matchesQuery = !searchQuery || q.questionText.includes(searchQuery) || q.answers.some(a => a.text.includes(searchQuery));
    return matchesCat && matchesQuery;
  });

  const persistQuestionBank = (next: Question[]) => {
    setQuestionBank(next);
    try { localStorage.setItem('family_feud_easy_questions_v2', JSON.stringify(next)); } catch { setBankMessage('تعذر حفظ البنك على هذا الجهاز'); }
  };

  const exportQuestionBank = (format: 'json' | 'csv') => {
    const content = format === 'json'
      ? JSON.stringify(questionBank, null, 2)
      : ['id,category,question,answers,source', ...questionBank.map((q) => [q.id, q.category, q.questionText, q.answers.map((a) => `${a.text}:${a.points}`).join('|'), q.pointsSource ?? 'estimated'].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `family-questions.${format}`; link.click(); URL.revokeObjectURL(url);
  };

  const importQuestionBank = async (file: File) => {
    try {
      let parsed: Question[];
      if (file.name.toLowerCase().endsWith('.json')) {
        const raw = JSON.parse(await file.text()); parsed = Array.isArray(raw) ? raw : raw.questions;
      } else {
        const rows = (await file.text()).split(/\r?\n/).slice(1).filter(Boolean);
        parsed = rows.map((row, index) => {
          const cells = row.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.slice(0, -1).map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
          const [id, category, questionText, answersText, source] = cells;
          return { id: Number(id) || Date.now() + index, category, questionText, pointsSource: source === 'survey' ? 'survey' : 'estimated', answers: (answersText ?? '').split('|').map((pair) => { const at = pair.lastIndexOf(':'); return { text: pair.slice(0, at), points: Number(pair.slice(at + 1)) }; }) } as Question;
        });
      }
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('الملف لا يحتوي أسئلة');
      const ids = new Set<number>();
      for (const [index, question] of parsed.entries()) {
        if (!question || typeof question.questionText !== 'string' || !question.questionText.trim()) throw new Error(`السؤال رقم ${index + 1} بلا نص`);
        if (!Array.isArray(question.answers) || question.answers.length < 2) throw new Error(`السؤال رقم ${index + 1} يحتاج إجابتين على الأقل`);
        const texts = question.answers.map((answer) => String(answer.text ?? '').trim().toLocaleLowerCase('ar'));
        if (texts.some((text) => !text) || new Set(texts).size !== texts.length) throw new Error(`إجابات السؤال رقم ${index + 1} فارغة أو مكررة`);
        if (question.answers.some((answer) => !Number.isFinite(Number(answer.points)) || Number(answer.points) < 0) || question.answers.reduce((sum, answer) => sum + Number(answer.points), 0) !== 100) throw new Error(`مجموع نقاط السؤال رقم ${index + 1} يجب أن يساوي 100`);
        const id = Number(question.id);
        if (!Number.isFinite(id) || ids.has(id)) throw new Error(`معرّف السؤال رقم ${index + 1} غير صالح أو مكرر`);
        ids.add(id);
        question.pointsSource = question.pointsSource === 'survey' ? 'survey' : 'estimated';
      }
      persistQuestionBank(parsed); setBankMessage(`تم استيراد ${parsed.length} سؤال صالح`);
    } catch (error) { setBankMessage(error instanceof Error ? error.message : 'تعذر قراءة الملف'); }
  };

  const saveEditedQuestion = (question: Question) => {
    const total = question.answers.reduce((sum, answer) => sum + Number(answer.points || 0), 0);
    const normalized = question.answers.map((answer) => answer.text.trim().toLocaleLowerCase('ar'));
    if (!question.questionText.trim() || question.answers.length < 2) return setBankMessage('أدخل السؤال وإجابتين على الأقل');
    if (new Set(normalized).size !== normalized.length) return setBankMessage('توجد إجابات متكررة نصيًا');
    if (total !== 100) return setBankMessage(`مجموع النقاط ${total}؛ المطلوب 100`);
    const exists = questionBank.some((item) => item.id === question.id);
    persistQuestionBank(exists ? questionBank.map((item) => item.id === question.id ? question : item) : [...questionBank, question]);
    setEditingQuestion(null); setBankMessage('تم الحفظ · النقاط تقديرية');
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
      const answerIndex = Number(event.key) - 1;
      if (answerIndex >= 0 && answerIndex < (state.currentQuestion?.answers.length ?? 0)) handleRevealAnswer(answerIndex);
      if (event.key.toLowerCase() === 'x') handleStrike();
      if (event.key.toLowerCase() === 'z' && onUndo) onUndo();
      if (event.code === 'Space') {
        event.preventDefault();
        updateState((prev) => ({ ...prev, timerRunning: !prev.timerRunning, timerEndsAt: !prev.timerRunning ? Date.now() + prev.timerSeconds * 1000 : null }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`host-console host-station host-phase-${state.phase.toLowerCase().replace('_', '-')} min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 pb-24`} dir="rtl">
      {/* Top Header: Logos & Primary Navigation */}
      <header className="host-header mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-blue-800 to-blue-950 px-4 py-2 font-display text-sm font-black text-amber-200 shadow-[0_0_20px_rgba(251,191,36,.25)]">
            تحدّي العائلة
          </div>
        </div>

        {/* Clear Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowEventLog(true)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-slate-200">سجل المباراة</button>
          <button aria-label="إدارة هوية البرنامج" title="إدارة هوية البرنامج" onClick={() => setShowBrandSettings(true)} className="host-brand-shortcut rounded-xl border border-amber-400/50 bg-blue-950 px-3 py-2 text-xs font-black text-amber-100">✦ <span>الهوية</span></button>
          {onRestartGame && <button onClick={() => setShowRestartConfirm(true)} className="host-restart-shortcut rounded-xl border border-rose-400/50 bg-rose-950/50 px-3 py-2 text-xs font-black text-rose-100">↻ <span>مباراة جديدة</span></button>}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            ↶ تراجع
          </button>
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
            disabled={state.currentRound !== 4 || state.phase !== 'ROUND_OVER'}
            className="flex items-center gap-1 rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            <span>🏆</span>
            <span>تتويج الفائز</span>
          </button>
        </div>
      </header>

      {/* Main Simplified Command Center */}
      <main className="host-main mx-auto max-w-4xl space-y-4">
        {/* Connection status */}
        <div
          className={`host-connection flex items-center justify-between px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-sm ${
            p2pConnected || serverConnected
              ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-amber-950/70 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                p2pConnected || serverConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span>
              {p2pConnected
                ? `🟢 متصل بشاشة التلفزيون مباشرة (الغرفة: ${roomId})`
                : serverConnected
                  ? `🟢 متصل بالخادم المباشر (الغرفة: ${roomId})`
                  : `🟡 جاري البحث عن شاشة العرض... (الغرفة: ${roomId})`}
            </span>
          </div>
          <button type="button" onClick={onOpenConnectModal} className="font-mono text-[11px] bg-black/50 border border-slate-700 px-2 py-1 rounded-lg text-white shrink-0">
            ربط الشاشة ↗
          </button>
        </div>

        {/* 1. Scoreboard Bar with Animated Counters */}
        <div className="host-scoreboard grid grid-cols-3 gap-2 sm:gap-4 text-center">
          {/* Team A */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleSetTurn('A')}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleSetTurn('A'); }}
            className={`host-team-card host-team-a cursor-pointer rounded-2xl border-2 p-3 transition-all ${
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
          <div className="host-bank-card rounded-2xl border-2 border-amber-400/80 bg-amber-950/30 p-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="text-[11px] md:text-xs font-black text-amber-300 uppercase block">
              بنك الجولة {state.currentRound}/4 {state.roundMultiplier > 1 ? `(×${state.roundMultiplier})` : ''}
            </span>
            <div className="font-display font-black text-3xl md:text-5xl text-gold-gradient tabular-nums">
              <AnimatedCounter value={state.roundBank} />
            </div>
          </div>

          {/* Team B */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleSetTurn('B')}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleSetTurn('B'); }}
            className={`host-team-card host-team-b cursor-pointer rounded-2xl border-2 p-3 transition-all ${
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

        <div className="host-timer grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-amber-500/30 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateState((prev) => ({ ...prev, timerRunning: !prev.timerRunning, timerEndsAt: !prev.timerRunning ? Date.now() + prev.timerSeconds * 1000 : null }))}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950"
            >
              {state.timerRunning ? 'إيقاف المؤقت' : 'تشغيل المؤقت'}
            </button>
            <button
              onClick={() => updateState((prev) => ({ ...prev, timerSeconds: 30, timerRunning: false, timerEndsAt: null }))}
              className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white"
            >
              إعادة 30ث
            </button>
          </div>
          <div className="rounded-xl border border-amber-400/50 bg-black/50 px-4 py-1 font-display text-2xl font-black text-amber-300 tabular-nums">
              {timerExpired ? 'انتهى الوقت' : `${timerRemaining}ث`}
          </div>
        </div>

        <section className="host-audio-controls flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/25 bg-slate-900/70 px-3 py-2.5" aria-label="إعدادات الصوت">
          <button type="button" aria-pressed={Boolean(state.muted)} onClick={() => updateState((prev) => ({ ...prev, muted: !prev.muted }))} className="rounded-xl border border-cyan-300/40 bg-cyan-950/70 px-3 py-2 text-xs font-black text-cyan-100">
            {state.muted ? '🔇 الصوت مكتوم' : '🔊 كتم الصوت'}
          </button>
          <label className="flex min-w-[190px] flex-1 items-center gap-3 text-xs font-bold text-slate-200">
            <span>مستوى الصوت</span>
            <input aria-label="مستوى الصوت" type="range" min="0" max="100" step="1" value={Math.round((state.volume ?? 0.8) * 100)} onChange={(event) => updateState((prev) => ({ ...prev, volume: Number(event.target.value) / 100 }))} className="min-w-20 flex-1 accent-cyan-300" />
            <span className="w-9 text-left tabular-nums">{Math.round((state.volume ?? 0.8) * 100)}٪</span>
          </label>
        </section>

        {/* 2. Current Question Box & Hidden Answers List (Mobile Remote Pro) */}
        <div className="host-question rounded-3xl border-2 border-blue-500/40 bg-gradient-to-b from-blue-950 to-slate-950 p-4 md:p-6 shadow-xl">
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
              📚 بنك الأسئلة ({questionBank.length})
            </button>
          </div>

          <h2 className="font-display font-extrabold text-xl md:text-2xl text-white text-center py-1.5 leading-relaxed">
            "{state.currentQuestion?.questionText}"
          </h2>

          {/* Instant Top Strike Bar for Quick Thumb Reach on Phones */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleStrike}
              disabled={state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER'}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-red-500 bg-gradient-to-b from-red-600 to-red-800 py-2.5 px-4 font-display font-black text-base sm:text-lg text-white active:scale-95 transition-all disabled:opacity-40"
            >
              <span className="text-xl leading-none">❌</span>
              <span>تسجيل سترايك ({state.strikes} من 3)</span>
            </button>
            <button
              type="button"
              onClick={handleQuickStrikeFlash}
              className="shrink-0 rounded-2xl border-2 border-red-400/70 bg-red-950/80 py-2.5 px-3.5 font-display font-black text-xs sm:text-sm text-red-200 active:scale-95 transition-all"
              title="إظهار إشارة X وصوت الخطأ على الشاشة دون زيادة عداد الأخطاء الثلاثة"
            >
              ✕ خطأ سريع
            </button>
            {state.strikes > 0 && (
              <button
                type="button"
                onClick={handleResetStrikes}
                className="shrink-0 rounded-2xl border border-slate-700 bg-slate-800 py-2.5 px-3 text-xs font-bold text-slate-300 active:scale-95 transition-all"
              >
                تصفير 0
              </button>
            )}
          </div>

          {/* 3. Answers Cards - Ergonomic Touch-Friendly for Phone Thumb */}
          <div className="host-answer-list mt-4 space-y-3">
            {state.currentQuestion?.answers.map((answer, index) => {
              const isRevealed = Boolean(state.revealedAnswers[index]);
              return (
                <div
                  key={index}
                  onClick={() => handleRevealAnswer(index)}
                  className={`host-answer-row cursor-pointer flex items-center justify-between rounded-2xl border-2 p-3 sm:p-4 min-h-[64px] active:scale-[0.99] transition-all select-none ${
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
                <span>{answer.points} أساسية · {answer.points * state.roundMultiplier} مستحقة</span>
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
        <div className="host-actions rounded-3xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
          <div className="mobile-turn-controls host-turn-row hidden items-center gap-2">
            <button onClick={handlePassTurn} className="flex-1 rounded-xl border border-cyan-400/50 bg-cyan-900/50 px-3 py-2 text-xs font-black text-cyan-100">⇄ نقل الدور</button>
            <button onClick={() => onUndo?.()} disabled={!canUndo} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-black disabled:opacity-40">↶ تراجع</button>
          </div>
          {/* Big Red Strike Button */}
          <div className="host-strike-row flex items-center gap-2">
            <button
              type="button"
              onClick={handleStrike}
              disabled={state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER'}
              className="host-strike-button flex-1 flex items-center justify-center gap-3 rounded-2xl border-3 border-red-500 bg-gradient-to-b from-red-600 to-red-800 min-h-[64px] py-3.5 px-6 font-display font-black text-xl text-white shadow-[0_0_35px_rgba(239,68,68,0.55)] active:scale-95 hover:brightness-110 transition-all disabled:opacity-40"
            >
              <span className="text-3xl leading-none">❌</span>
              <span>تسجيل خطأ ({state.strikes} من 3)</span>
            </button>
            <button
              type="button"
              onClick={handleQuickStrikeFlash}
              className="shrink-0 min-h-[64px] rounded-2xl border-2 border-red-400/70 bg-red-950/80 px-4 font-display font-black text-sm text-red-200 hover:bg-red-900/70 active:scale-95 transition-all"
            >
              ✕ إظهار X
            </button>
            {state.strikes > 0 && (
              <button
                type="button"
                onClick={handleResetStrikes}
                className="shrink-0 min-h-[64px] rounded-2xl border border-slate-700 bg-slate-800 px-5 text-xs font-bold text-slate-300 hover:bg-slate-700 active:scale-95 transition-all"
              >
                تصفير 0
              </button>
            )}
          </div>

          {/* Steal Banner if 3 Strikes */}
          {state.phase === 'STEAL' && (
            <div className="host-steal-panel rounded-2xl border-2 border-red-500 bg-red-950/60 p-3.5 text-center animate-pulse">
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
          <div className="host-award-panel rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <span className="text-xs text-slate-400 font-bold block mb-2 text-center">
              تحويل نقاط بنك الجولة ({state.roundBank} نقطة) إلى:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAwardBank('A')}
                disabled={state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER'}
                className="rounded-xl border border-blue-500 bg-blue-700 py-2.5 px-3 text-xs md:text-sm font-black text-white hover:bg-blue-600 shadow"
              >
                تحويل لـ {state.teamA.name} ➔
              </button>
              <button
                onClick={() => handleAwardBank('B')}
                disabled={state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER'}
                className="rounded-xl border border-indigo-500 bg-indigo-700 py-2.5 px-3 text-xs md:text-sm font-black text-white hover:bg-indigo-600 shadow"
              >
                ➔ تحويل لـ {state.teamB.name}
              </button>
            </div>
          </div>

          {/* 6. Advance to Next Round */}
          <div className="host-round-controls flex items-center gap-2 pt-1">
          <button
            onClick={handleNextRound}
            disabled={state.currentRound >= 4 || state.phase !== 'ROUND_OVER'}
              className="flex-1 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-display font-black text-sm md:text-base text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              {state.currentRound < 4 ? `الانتقال للجولة ${state.currentRound + 1} ⏭` : 'انتهت الجولات الأربع'}
            </button>
            {state.currentRound === 4 && state.phase === 'ROUND_OVER' && <button onClick={handleEndGameAndCrownWinner} className="rounded-2xl border-2 border-emerald-400 bg-emerald-600 px-4 py-3 text-xs font-black text-white">إعلان الفائز 🏆</button>}
            <button
              onClick={() => setShowTeamEditModal(true)}
              className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              تعديل أسماء الفرق ✏️
            </button>
          </div>
        </div>

        {/* 7. Quick Soundboard */}
        <div className="host-soundboard rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="text-xs font-bold text-slate-400 block mb-2">أصوات سريعة:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => triggerSound('chime')}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-slate-700"
            >
              🔔 رنة كشف
            </button>
            <button
              onClick={handleQuickStrikeFlash}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-red-400 hover:bg-slate-700"
            >
              ❌ طنين خطأ (X)
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
                بنك الأسئلة ({questionBank.length} سؤال)
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setEditingQuestion({ id: Date.now(), category: 'الحياة اليومية الأردنية', questionText: '', pointsSource: 'estimated', answers: [{ text: '', points: 50 }, { text: '', points: 50 }] })} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white">+ سؤال</button>
                <button onClick={() => setShowQuestionsDrawer(false)} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300">إغلاق</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
              <button onClick={() => exportQuestionBank('json')} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold">تصدير JSON</button>
              <button onClick={() => exportQuestionBank('csv')} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold">تصدير CSV</button>
              <button onClick={() => importRef.current?.click()} className="rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold">استيراد</button>
              <input ref={importRef} type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importQuestionBank(file); event.currentTarget.value = ''; }} />
              <span className="text-[11px] text-amber-300">النقاط تقديرية ما لم تُرفق بيانات استطلاع</span>
              {bankMessage && <span className="w-full text-xs text-emerald-300" role="status">{bankMessage}</span>}
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
                    <span className="text-[10px] text-amber-400 font-bold">#{q.id} · {q.category} · {q.pointsSource === 'survey' ? 'استطلاع' : 'تقديري'}</span>
                    <h4 className="font-bold text-sm text-white">{q.questionText}</h4>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button onClick={() => handleSelectQuestion(q)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">اختيار ➔</button>
                    <button onClick={() => setEditingQuestion(JSON.parse(JSON.stringify(q)) as Question)} className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-bold">تعديل</button>
                    <button onClick={() => { if (questionBank.length < 2) return setBankMessage('لا يمكن حذف آخر سؤال'); persistQuestionBank(questionBank.filter((item) => item.id !== q.id)); }} className="rounded-lg bg-red-950 px-3 py-1 text-xs font-bold text-red-300">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBrandSettings && <div className="brand-settings-backdrop" role="dialog" aria-modal="true" aria-labelledby="brand-settings-title" dir="rtl">
        <section className="brand-settings-card">
          <header><div><small>إدارة الهوية البصرية</small><h2 id="brand-settings-title">شعار شاشة الجمهور</h2></div><button type="button" onClick={() => setShowBrandSettings(false)} aria-label="إغلاق">×</button></header>
          <img className="brand-settings-preview" src={state.brandLogoDataUrl || '/family-challenge-logo-v2.png'} alt="معاينة الشعار الحالي" />
          <p>ارفع PNG بخلفية شفافة أو SVG متجهيًا آمنًا. سيظهر الشعار على شاشة الجمهور عند المزامنة.</p>
          <input ref={brandFileRef} type="file" accept="image/png,image/svg+xml,.png,.svg" hidden onChange={async (event) => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
            if (!file) return;
            try {
              const dataUrl = await loadBrandLogo(file);
              updateState((prev) => ({ ...prev, brandLogoDataUrl: dataUrl }));
              setBrandMessage('تم تحديث الشعار ومزامنته.');
            } catch (error) { setBrandMessage(error instanceof Error ? error.message : 'تعذر تحميل الشعار.'); }
          }} />
          <footer><button type="button" className="brand-upload" onClick={() => brandFileRef.current?.click()}>اختيار PNG أو SVG</button><button type="button" className="brand-reset" onClick={() => { updateState((prev) => ({ ...prev, brandLogoDataUrl: undefined })); setBrandMessage(''); }}>استعادة الشعار الأصلي</button></footer>
          {brandMessage && <div className="brand-message" role="status">{brandMessage}</div>}
        </section>
      </div>}

      {showRestartConfirm && <div className="brand-settings-backdrop" role="dialog" aria-modal="true" aria-labelledby="restart-title" dir="rtl">
        <section className="brand-settings-card restart-card"><header><div><small>إعادة تجهيز الساحة</small><h2 id="restart-title">بدء مباراة جديدة؟</h2></div></header>
          <p>سيُعاد رصيد الفريقين والجولة إلى البداية لهذه الغرفة. بنك الأسئلة وأسماء الفريقين سيبقيان كما هما.</p>
          <footer><button type="button" className="restart-confirm" onClick={() => { onRestartGame?.(); setShowRestartConfirm(false); }}>ابدأ مباراة جديدة</button><button type="button" className="brand-reset" onClick={() => setShowRestartConfirm(false)}>إلغاء</button></footer>
        </section>
      </div>}

      {editingQuestion && (
        <QuestionEditor
          question={editingQuestion}
          onChange={setEditingQuestion}
          onCancel={() => setEditingQuestion(null)}
          onSave={saveEditedQuestion}
        />
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

      {showEventLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-3xl border border-slate-600 bg-slate-950 p-4 shadow-2xl">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-black text-white">سجل المباراة</h2>
              <button onClick={() => setShowEventLog(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm">إغلاق</button>
            </header>
            <ol className="max-h-[65vh] space-y-2 overflow-auto">
              {[...eventLog].reverse().map((event) => <li key={event.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2"><span className="text-sm font-bold text-slate-100">{event.label}</span><time className="font-mono text-[11px] text-slate-400">{event.time}</time></li>)}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}

async function loadBrandLogo(file: File): Promise<string> {
  if (file.size > 3 * 1024 * 1024) throw new Error('حجم الملف الأقصى 3 ميغابايت.');
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    if (file.size > 120 * 1024) throw new Error('حجم SVG الأقصى 120 كيلوبايت.');
    const source = await file.text();
    const withoutStandardNamespace = source.replace(/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/gi, '');
    if (!/<svg[\s>]/i.test(source) || /<(script|foreignObject|iframe|object|embed|image|use)\b/i.test(source) || /\bon[a-z]+\s*=|javascript:|url\s*\(|@import|https?:\/\/|<!DOCTYPE|<!ENTITY/i.test(withoutStandardNamespace) || /\b(?:href|src)\s*=\s*["'](?!#)/i.test(source)) {
      throw new Error('ملف SVG يجب أن يكون رسماً متجهياً محلياً بلا سكربتات أو روابط خارجية.');
    }
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;
  }
  if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) throw new Error('اختر ملف PNG أو SVG.');
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذر تجهيز الصورة.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height); source.close();
  return canvas.toDataURL('image/webp', .88);
}

function QuestionEditor({ question, onChange, onCancel, onSave }: { question: Question; onChange: (question: Question) => void; onCancel: () => void; onSave: (question: Question) => void }) {
  const updateAnswer = (index: number, field: 'text' | 'points', value: string) => onChange({ ...question, answers: question.answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, [field]: field === 'points' ? Number(value) : value } : answer) });
  const total = question.answers.reduce((sum, answer) => sum + Number(answer.points || 0), 0);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm"><section className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-3xl border border-cyan-500/50 bg-slate-950 p-4 shadow-2xl">
    <header className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-black">محرر السؤال <span className="text-xs text-amber-300">نقاط تقديرية</span></h2><button onClick={onCancel} className="rounded-lg bg-slate-800 px-3 py-2">إغلاق</button></header>
    <label className="mb-2 block text-xs font-bold text-slate-300">السؤال<input value={question.questionText} onChange={(event) => onChange({ ...question, questionText: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white" /></label>
    <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">الفئة<input value={question.category} onChange={(event) => onChange({ ...question, category: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-white" /></label><label className="text-xs text-slate-300">الصعوبة<select value={question.difficulty ?? 'medium'} onChange={(event) => onChange({ ...question, difficulty: event.target.value as Question['difficulty'] })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-white"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select></label></div>
    <div className="space-y-2">{question.answers.map((answer, index) => <div key={index} className="grid grid-cols-[1fr_76px_38px] gap-2"><input aria-label={`الإجابة ${index + 1}`} value={answer.text} onChange={(event) => updateAnswer(index, 'text', event.target.value)} placeholder={`الإجابة ${index + 1}`} className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-2 text-white" /><input aria-label={`نقاط الإجابة ${index + 1}`} type="number" min="0" max="100" value={answer.points} onChange={(event) => updateAnswer(index, 'points', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-center text-white" /><button onClick={() => onChange({ ...question, answers: question.answers.filter((_, answerIndex) => answerIndex !== index) })} className="rounded-lg bg-red-950 text-red-300" aria-label="حذف الإجابة">×</button></div>)}</div>
    <button onClick={() => onChange({ ...question, answers: [...question.answers, { text: '', points: 0 }] })} className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs">+ إضافة إجابة</button>
    <div className={`mt-3 rounded-xl p-3 text-sm font-black ${total === 100 ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>مجموع النقاط: {total} / 100</div>
    <footer className="mt-4 flex gap-2"><button onClick={() => onSave(question)} className="flex-1 rounded-xl bg-cyan-600 py-3 font-black text-slate-950">حفظ السؤال</button><button onClick={onCancel} className="rounded-xl bg-slate-800 px-4">إلغاء</button></footer>
  </section></div>;
}
