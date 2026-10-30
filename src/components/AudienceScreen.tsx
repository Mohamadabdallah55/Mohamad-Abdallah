import { useEffect, useMemo, useRef, useState } from 'react';
import { GameState } from '../types/game';
import { AnimatedCounter } from './AnimatedCounter';
import { GrandWinnerModal } from './GrandWinnerModal';
import { getTimerRemaining } from '../utils/gameEngine';
import { playRevealAccent } from '../utils/audio';
import { StrikeOverlay } from './StrikesIndicator';

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
  roomId = 'FEUD',
}: AudienceScreenProps) {
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [strikeEvent, setStrikeEvent] = useState(0);
  const [introVisible, setIntroVisible] = useState(false);
  const introStarted = useRef(false);
  const previousStrikes = useRef(state.strikes);
  const [strikeTeam, setStrikeTeam] = useState<'A' | 'B' | null>(null);
  const previousPhase = useRef(state.phase);
  const [stealEvent, setStealEvent] = useState(false);
  const previousScores = useRef({ A: state.teamA.score, B: state.teamB.score });
  const [scorePulse, setScorePulse] = useState<'A' | 'B' | null>(null);
  const previousRevealCount = useRef(state.revealedAnswers.filter(Boolean).length);

  useEffect(() => {
    if (!state.timerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.timerRunning]);

  useEffect(() => {
    if (state.strikes > previousStrikes.current) {
      setStrikeTeam(state.activeTeam);
      setStrikeEvent((value) => value + 1);
      const id = window.setTimeout(() => setStrikeEvent(0), 1500);
      previousStrikes.current = state.strikes;
      return () => window.clearTimeout(id);
    }
    previousStrikes.current = state.strikes;
  }, [state.strikes]);

  useEffect(() => {
    const freshOpening = state.currentRound === 1 && state.phase === 'FACE_OFF' && state.teamA.score === 0 && state.teamB.score === 0;
    const key = `family_challenge_intro_${state.roomId || roomId}`;
    if (!freshOpening || introStarted.current || sessionStorage.getItem(key)) return;
    introStarted.current = true;
    setIntroVisible(true);
    const timer = window.setTimeout(() => { setIntroVisible(false); sessionStorage.setItem(key, 'seen'); }, 6400);
    return () => window.clearTimeout(timer);
  }, [state.actionId, state.currentRound, state.phase, state.roomId, state.teamA.score, state.teamB.score, roomId]);

  useEffect(() => {
    const awarded = previousPhase.current === 'STEAL' && state.phase === 'ROUND_OVER';
    if (awarded) { setStealEvent(true); window.setTimeout(() => setStealEvent(false), 1500); }
    previousPhase.current = state.phase;
  }, [state.phase, state.awardedRound]);

  useEffect(() => {
    const previous = previousScores.current;
    const team = state.teamA.score > previous.A ? 'A' : state.teamB.score > previous.B ? 'B' : null;
    if (team) { setScorePulse(team); window.setTimeout(() => setScorePulse(null), 900); }
    previousScores.current = { A: state.teamA.score, B: state.teamB.score };
  }, [state.teamA.score, state.teamB.score]);

  useEffect(() => {
    const count = state.revealedAnswers.filter(Boolean).length;
    if (count > previousRevealCount.current) playRevealAccent(Math.min(1, state.volume ?? 0.8), Boolean(state.muted));
    previousRevealCount.current = count;
  }, [state.revealedAnswers, state.volume, state.muted]);

  useEffect(() => { if (state.phase !== 'GAME_OVER') setDismissed(false); }, [state.phase]);

  const seconds = getTimerRemaining(state, now);
  const winner = useMemo<'A' | 'B' | 'TIE'>(() => state.teamA.score > state.teamB.score ? 'A' : state.teamB.score > state.teamA.score ? 'B' : 'TIE', [state.teamA.score, state.teamB.score]);
  const revealed = state.revealedAnswers.filter(Boolean).length;

  return (
    <div className={`live-arena${state.phase === 'STEAL' ? ' is-steal' : ''}`} dir="rtl">
      <div className="arena-atmosphere" aria-hidden="true">
        <span className="atmosphere-orbit orbit-a" /><span className="atmosphere-orbit orbit-b" />
        <span className="atmosphere-beam beam-a" /><span className="atmosphere-beam beam-b" />
        <span className="arena-grain" />
      </div>

      <header className="arena-header">
        <TeamPod team={state.teamA} active={state.activeTeam === 'A'} struck={strikeEvent > 0 && strikeTeam === 'A'} pulsing={scorePulse === 'A'} side="a" />

        <div className="arena-brand" aria-label="العلامة البصرية للمسابقة">
          <img className="arena-logo" src={state.brandLogoDataUrl || '/family-challenge-logo.svg'} alt="FAMILY CHALLENGE" />
          <span className="brand-copy"><small>FAMILY CHALLENGE</small><strong>تحدّي العائلة</strong></span>
        </div>

        <div className="round-plaque" aria-label={`الجولة ${state.currentRound} من أربع، مضاعف النقاط ${state.roundMultiplier}`}>
          <span className="round-plaque-label">الجولة</span>
          <b>{String(state.currentRound).padStart(2, '0')}<small> / 04</small></b>
          <span className="round-multiplier">×{state.roundMultiplier}</span>
        </div>

        <TeamPod team={state.teamB} active={state.activeTeam === 'B'} struck={strikeEvent > 0 && strikeTeam === 'B'} pulsing={scorePulse === 'B'} side="b" />
      </header>

      <main className="arena-main">
        <section className="arena-question" aria-live="polite" aria-label="السؤال الحالي">
          <div className="question-kicker"><span /> سؤال الجولة <span className="question-kicker-line" /></div>
          <h1>{state.currentQuestion?.questionText || 'بانتظار اختيار السؤال'}</h1>
          <div className="question-baseline" />
        </section>

        <section className="arena-scoreline" aria-label="حالة الجولة">
          <div className="scoreline-bank">
            <span>بنك الجولة</span>
            <strong><AnimatedCounter value={state.roundBank} duration={700} /></strong>
            <small>نقطة أساسية</small>
          </div>

          <div className="scoreline-progress" aria-label={`${revealed} إجابات مكشوفة من ${state.currentQuestion?.answers.length ?? 0}`}>
            <div className="progress-copy"><span>لوحة الإجابات</span><b>{revealed}<small> / {state.currentQuestion?.answers.length ?? 0}</small></b></div>
            <div className="progress-rail"><i style={{ width: `${state.currentQuestion?.answers.length ? (revealed / state.currentQuestion.answers.length) * 100 : 0}%` }} /></div>
          </div>

          <div className="scoreline-strikes" aria-label={`${state.strikes} أخطاء من ثلاثة`}>
            <span>الأخطاء</span>
            <div>{[0, 1, 2].map((index) => <b key={index} className={index < state.strikes ? 'strike-lit' : ''} aria-label={index < state.strikes ? 'خطأ مسجل' : 'خطأ متاح'}><i /></b>)}</div>
            {state.phase === 'STEAL' && <strong className="steal-cue">فرصة سرقة</strong>}
          </div>

          <div className={`scoreline-timer${seconds <= 5 ? ' timer-urgent' : ''}`} aria-label={`المؤقت ${seconds} ثانية`}>
            <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="timer-track" cx="32" cy="32" r="27" /><circle className="timer-progress" cx="32" cy="32" r="27" style={{ strokeDashoffset: 170 - Math.min(seconds, 30) / 30 * 170 }} /></svg>
            <b>{seconds}</b><small>ث</small>
          </div>

          <div className="connection-status" title={`رمز الغرفة ${roomId}`}>
            <i className={p2pConnected ? 'connection-live' : ''} />
            <span>{p2pConnected ? 'مباشر' : 'بانتظار الربط'}</span>
          </div>

          <button className="arena-fullscreen" type="button" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'} title="ملء الشاشة">
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </section>

        <section className="answer-wall" aria-label="الإجابات">
          <div className={`wall-topline${state.phase === 'STEAL' ? ' wall-topline-steal' : state.phase === 'ROUND_OVER' ? ' wall-topline-complete' : ''}`} role="status">
            <span>{state.phase === 'STEAL' ? 'فرصة أخيرة لسرقة البنك' : state.phase === 'ROUND_OVER' ? `قيمة الجولة ${state.roundBank} × ${state.roundMultiplier} = ${state.roundBank * state.roundMultiplier} نقطة` : 'اكتشفوا إجابات الجمهور'}</span>
            <span className="wall-room">{state.phase === 'STEAL' ? 'البنك لفريق واحد فقط' : roomId}</span>
          </div>
          <div className="answer-grid">
            {state.currentQuestion?.answers.map((answer, index) => (
              <StageAnswer key={`${state.currentQuestion?.id}-${index}`} index={index} answerText={answer.text} points={answer.points} isRevealed={Boolean(state.revealedAnswers[index])} />
            ))}
          </div>
          <span className="wall-light wall-light-a" aria-hidden="true" /><span className="wall-light wall-light-b" aria-hidden="true" />
        </section>
      </main>

      <footer className="arena-footer">
        <div className="footer-teams"><i className="team-color-a" /><span>{state.teamA.name}</span><b>{state.teamA.score}</b><em>—</em><b>{state.teamB.score}</b><span>{state.teamB.name}</span><i className="team-color-b" /></div>
        <div className="footer-data"><span className={`data-badge${state.currentQuestion?.pointsSource === 'survey' ? ' is-survey' : ''}`} />{state.currentQuestion?.pointsSource === 'survey' ? 'نتائج استطلاع فعلي' : 'نقاط تقديرية للّعب'}</div>
      </footer>

      {state.phase === 'GAME_OVER' && !dismissed && <GrandWinnerModal winner={winner} teamA={state.teamA} teamB={state.teamB} onRestart={() => onRestartGame?.()} onClose={() => { setDismissed(true); onDismissGameOver?.(); }} />}
      <StrikeOverlay key={strikeEvent} count={state.strikes} active={strikeEvent > 0} />
      {stealEvent && <div className="steal-energy" aria-hidden="true"><i /></div>}
      {introVisible && <ShowIntro teamA={state.teamA.name} teamB={state.teamB.name} onSkip={() => { setIntroVisible(false); sessionStorage.setItem(`family_challenge_intro_${state.roomId || roomId}`, 'seen'); }} />}
    </div>
  );
}

function TeamPod({ team, active, struck, pulsing, side }: { team: GameState['teamA']; active: boolean; struck: boolean; pulsing: boolean; side: 'a' | 'b' }) {
  return (
    <section className={`arena-team team-${side}${active ? ' team-active' : ''}${struck ? ' team-struck' : ''}${pulsing ? ' team-score-pulse' : ''}`} aria-label={`الفريق ${team.name}: ${team.score} نقطة`}>
      <img className="team-shield" src={side === 'a' ? '/assets/shield-cyan.svg' : '/assets/shield-violet.svg'} alt="" aria-hidden="true" />
      <div className="team-identity"><small>{active ? 'الدور الآن' : 'الفريق'}</small><strong>{team.name}</strong></div>
      <div className="team-total"><AnimatedCounter value={team.score} duration={850} /><small>نقطة</small></div>
    </section>
  );
}

function ShowIntro({ teamA, teamB, onSkip }: { teamA: string; teamB: string; onSkip: () => void }) {
  return <div className="show-intro" role="dialog" aria-label="مقدمة FAMILY CHALLENGE">
    <div className="intro-light intro-light-a" /><div className="intro-light intro-light-b" />
    <img src="/family-challenge-logo.svg" alt="FAMILY CHALLENGE" className="intro-logo" />
    <div className="intro-teams" dir="rtl">
      <div><img src="/assets/shield-cyan.svg" alt="" /><b>{teamA}</b></div>
      <span>ضد</span>
      <div><img src="/assets/shield-violet.svg" alt="" /><b>{teamB}</b></div>
    </div>
    <p>استعدّوا للمواجهة</p><div className="intro-progress"><i /></div>
    <button type="button" onClick={onSkip}>تخطي المقدمة</button>
  </div>;
}

function StageAnswer({ index, answerText, points, isRevealed }: { index: number; answerText: string; points: number; isRevealed: boolean }) {
  return (
    <article className={`answer-tile${isRevealed ? ' answer-open' : ''}`} aria-label={isRevealed ? `الإجابة ${index + 1}: ${answerText}، ${points} نقطة` : `الإجابة ${index + 1} مخفية`}>
      <div className="tile-face"><b>{String(index + 1).padStart(2, '0')}</b><span>الإجابة مخفية</span><i /></div>
      <div className="tile-answer"><span className="tile-index">{String(index + 1).padStart(2, '0')}</span><strong>{answerText}</strong><b className="tile-points">{points}<small>نقطة</small></b><i className="tile-glint" /></div>
    </article>
  );
}
