import { useEffect, useMemo, useRef, useState } from 'react';
import { GameState } from '../types/game';
import { StrikeOverlay } from './StrikesIndicator';
import { GrandWinnerModal } from './GrandWinnerModal';
import { AnimatedCounter } from './AnimatedCounter';
import { getTimerRemaining } from '../utils/gameEngine';
import { playRevealAccent } from '../utils/audio';

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

export function AudienceScreen({ state, onRestartGame, onDismissGameOver, onToggleFullscreen, isFullscreen = false, p2pConnected = false, roomId = 'FEUD' }: AudienceScreenProps) {
  const [strikeFlash, setStrikeFlash] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [introActive, setIntroActive] = useState(true);
  const [now, setNow] = useState(Date.now());
  const previousStrikes = useRef(state.strikes);
  const previousRevealCount = useRef(state.revealedAnswers.filter(Boolean).length);

  useEffect(() => {
    if (!state.timerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.timerRunning]);

  useEffect(() => {
    if (state.strikes > previousStrikes.current) {
      setStrikeFlash(true);
      const id = window.setTimeout(() => setStrikeFlash(false), 550);
      previousStrikes.current = state.strikes;
      return () => window.clearTimeout(id);
    }
    previousStrikes.current = state.strikes;
  }, [state.strikes]);

  useEffect(() => {
    const count = state.revealedAnswers.filter(Boolean).length;
    if (count > previousRevealCount.current) playRevealAccent(Math.min(1, state.volume ?? 0.8), Boolean(state.muted));
    previousRevealCount.current = count;
  }, [state.revealedAnswers, state.volume, state.muted]);

  useEffect(() => { if (state.phase !== 'GAME_OVER') setDismissed(false); }, [state.phase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIntroActive(false), 2600);
    return () => window.clearTimeout(timeout);
  }, []);

  const seconds = getTimerRemaining(state, now);
  const winner = useMemo<'A' | 'B' | 'TIE'>(() => state.teamA.score > state.teamB.score ? 'A' : state.teamB.score > state.teamA.score ? 'B' : 'TIE', [state.teamA.score, state.teamB.score]);

  return (
    <div className="studio-stage" dir="rtl">
      <div className="stage-stars" />
      <div className="stage-arch stage-arch-outer" />
      <div className="stage-arch stage-arch-inner" />
      <div className="stage-bulbs" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} />)}</div>
      <StrikeOverlay count={state.strikes || 1} active={strikeFlash} />
      {(state.phase === 'STEAL' || state.phase === 'ROUND_OVER') && <div className={`stage-event-banner ${state.phase === 'STEAL' ? 'steal' : 'round-result'}`} aria-live="polite">
        {state.phase === 'STEAL' ? 'فرصة السرقة — السؤال ما زال على الشاشة' : `انتهت الجولة ${state.currentRound} · البنك الأساسي ${state.roundBank} · المضاعف ×${state.roundMultiplier}`}
      </div>}

      {introActive && state.actionId === 0 && <div className="show-opening" onClick={() => setIntroActive(false)}>
        <div className="opening-light opening-light-one" /><div className="opening-light opening-light-two" />
        <div className="opening-mark"><span>تحدّي</span><strong>العائلة</strong><i>مسابقة حية</i></div>
        <p>اختبروا معرفتكم بالعالم من حولكم</p><button>ابدأ العرض ←</button>
      </div>}

      <header className="studio-topbar">
        <div className="room-chip"><span className={p2pConnected ? 'live-dot connected' : 'live-dot'} />غرفة {roomId}</div>
        <div className="round-title"><small>الجولة {state.currentRound} من 4</small><strong>نقاط ×{state.roundMultiplier}</strong></div>
        <button className="fullscreen-control" onClick={onToggleFullscreen} aria-label="ملء الشاشة">{isFullscreen ? '🗗' : '⛶'}</button>
      </header>

      <main className="studio-layout">
        <TeamPod team={state.teamA} active={state.activeTeam === 'A'} side="a" />
        <section className="show-board">
          <div className="board-crown">
            <div className="timer-dial" data-urgent={seconds <= 5}>{seconds}</div>
            <div><span>رصيد الجولة</span><AnimatedCounter value={state.roundBank} /></div>
            <div className="strike-lights" aria-label={`${state.strikes} أخطاء`}>{[0, 1, 2].map((index) => <b key={index} className={index < state.strikes ? 'on' : ''}>×</b>)}</div>
          </div>
          <div className="question-ribbon"><span>{state.currentQuestion?.questionText || 'بانتظار اختيار السؤال'}</span></div>
          <div className="answer-frame"><div className="answer-grid answer-grid-new">
            {state.currentQuestion?.answers.map((answer, index) => <StageAnswer key={`${state.currentQuestion?.id}-${index}`} index={index} answerText={answer.text} points={answer.points} isRevealed={Boolean(state.revealedAnswers[index])} />)}
          </div></div>
        </section>
        <TeamPod team={state.teamB} active={state.activeTeam === 'B'} side="b" />
      </main>

      <footer className="studio-footer"><span>مسابقة العائلة العربية</span><span>{state.currentQuestion?.pointsSource === 'survey' ? 'نتائج استطلاع موثقة' : 'نقاط تقديرية للترفيه'}</span></footer>
      {state.phase === 'GAME_OVER' && !dismissed && <GrandWinnerModal winner={winner} teamA={state.teamA} teamB={state.teamB} onRestart={() => onRestartGame?.()} onClose={() => { setDismissed(true); onDismissGameOver?.(); }} />}
    </div>
  );
}

function TeamPod({ team, active, side }: { team: GameState['teamA']; active: boolean; side: 'a' | 'b' }) {
  return <aside className={`team-pod team-${side} ${active ? 'active' : ''}`}><span className="team-status">{active ? 'دور الفريق' : 'المجموع'}</span><h2>{team.name}</h2><div className="team-score"><AnimatedCounter value={team.score} /></div></aside>;
}

function StageAnswer({ index, answerText, points, isRevealed }: { index: number; answerText: string; points: number; isRevealed: boolean }) {
  return <article className={`stage-answer ${isRevealed ? 'is-revealed' : ''}`} aria-label={isRevealed ? `الإجابة ${index + 1}: ${answerText}، ${points} نقطة` : `الإجابة ${index + 1} مخفية`}>
    <div className="stage-answer-face">
      <span className="answer-index">{String(index + 1).padStart(2, '0')}</span>
      <span className="answer-hidden-label">إجابة مخفية</span>
      <span className="answer-signal" />
    </div>
    <div className="stage-answer-reveal">
      <span className="answer-copy">{answerText}</span>
      <strong className="answer-points">{points}<small>نقطة</small></strong>
      <span className="answer-sweep" />
    </div>
  </article>;
}
