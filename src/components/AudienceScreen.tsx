import { useEffect, useRef, useState } from 'react';
import { useReducedMotion, motion } from 'motion/react';
import type { GameState } from '../types/game';
import { getTimerRemaining } from '../utils/gameEngine';
import { unlockAudio, playShowCue, setAudioControls } from '../utils/audio';
import { AnimatedCounter } from './AnimatedCounter';
import { Confetti } from './Confetti';
import { ShowLogo } from './ShowLogo';

interface Props { state: GameState; connected: boolean; serverOffset: number }
const status = { FACE_OFF: 'معقول تكون على اللوحة؟', GUESSING: 'مين رح يفتح الجواب الجاي؟', STEAL: 'فرصتكم تقلبوا الطاولة!', ROUND_OVER: 'هاي الجولة نار!', GAME_OVER: 'النتيجة النهائية' };

export function AudienceScreen({ state: s, connected, serverOffset }: Props) {
  const reduced = useReducedMotion();
  const [audio, setAudio] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [event, setEvent] = useState<GameState['showEvent']>();
  const lastEvent = useRef(s.actionId);
  const boardRef = useRef<HTMLDivElement>(null);
  const bankRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!s.timerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 150);
    return () => window.clearInterval(id);
  }, [s.timerRunning]);
  useEffect(() => setAudioControls(s.volume, s.muted), [s.volume, s.muted]);
  useEffect(() => {
    const cue = s.showEvent;
    if (!cue) { setEvent(undefined); return; }
    if (cue.id <= lastEvent.current) return;
    lastEvent.current = cue.id;
    if (Date.now() + serverOffset - cue.at > 2800) return;
    setEvent(cue);
    if (audio && !s.muted) playShowCue(cue.cue, s.volume);
  }, [s.showEvent, s.muted, s.volume, audio, serverOffset]);
  useEffect(() => {
    if (!event) return;
    const id = window.setTimeout(() => setEvent(undefined), event.cue === 'winner' ? 4200 : event.cue === 'reveal' ? 650 : 1350);
    return () => window.clearTimeout(id);
  }, [event]);

  const strike = event?.cue === 'strike' || event?.cue === 'third';
  const stealName = s.stealTeam === 'A' ? s.teamA.name : s.teamB.name;
  const winner = s.teamA.score === s.teamB.score ? null : s.teamA.score > s.teamB.score ? s.teamA : s.teamB;
  const final = s.phase === 'GAME_OVER';
  const matchStatus = event?.cue === 'stealWon' ? 'ولك قلبوا النتيجة!' : event?.cue === 'stealLost' ? 'البنك ظل مع الفريق الأول!' :
    event?.cue === 'third' ? 'هاي ثالث غلطة!' : event?.cue === 'strike' ? 'أوووف… مش موجودة!' :
    event?.cue === 'round' || event?.cue === 'start' ? 'يلا نبلّش الجولة!' :
    event?.leadChanged ? 'الصدارة تغيّرت!' : event?.cue === 'reveal' ? 'يا سلام! إجابة قوية!' : status[s.phase];
  const question = s.currentQuestion?.questionText ?? '';
  const textScale = question.length > 150 ? 'long' : question.length > 82 ? 'medium' : '';
  const remaining = getTimerRemaining(s, Math.max(now, s.lastUpdated - serverOffset) + serverOffset);
  const pointToken = event?.cue === 'reveal' && event.index !== undefined && !reduced
    ? boardRef.current?.querySelector(`[data-rank="${event.index}"] .slat-points`)?.getBoundingClientRect()
    : undefined;
  const target = pointToken ? bankRef.current?.getBoundingClientRect() : undefined;

  return <main className="tv-stage show-space" dir="rtl" data-phase={s.phase}>
    <div className="stage-rays" aria-hidden="true" />
    <header className="tv-header">
      <div className="tv-live"><span className={connected ? 'live-dot' : 'live-dot offline'} />{connected ? 'من المسرح' : 'جاري الربط'}</div>
      <ShowLogo />
      <div className="tv-options">
        {!audio && <button onClick={async () => setAudio(await unlockAudio())}>فعّل الصوت</button>}
        <button aria-label="ملء الشاشة" title="ملء الشاشة" onClick={() => {
          void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch(() => {});
        }}>⛶</button>
      </div>
    </header>
    <section className="tv-question" aria-label="سؤال الجولة">
      <div className="tv-round"><span>الجولة {s.currentRound} من 4</span><i /><span>{s.currentQuestion?.category}</span></div>
      <h1 className={textScale}>{question}</h1>
    </section>
    <div className="tv-floor">
      <Podium team={s.teamA} id="A" active={!final && (s.phase === 'STEAL' ? s.stealTeam : s.activeTeam) === 'A'} strikes={s.activeTeam === 'A' ? s.strikes : 0} reduced={reduced} />
      <section className="tv-center">
        <div className="tv-board-top">
          <div className="tv-bank" ref={bankRef}>
            <span>بنك الجولة <em dir="ltr">×{s.roundMultiplier}</em></span><b><AnimatedCounter value={s.roundBank * s.roundMultiplier} duration={reduced ? 0 : 450} /></b>
          </div>
          {s.timerVisible && <div className={`tv-clock ${remaining <= 5 ? 'urgent' : ''}`} aria-label="المؤقت">{remaining}<small>ث</small></div>}
        </div>
        <div className="tv-board-frame" ref={boardRef}>
          <div className="tv-board" aria-label="لوحة الإجابات">
            {s.currentQuestion?.answers.map((answer, index) => {
              const shown = s.revealedAnswers[index];
              const fresh = event?.cue === 'reveal' && event.index === index;
              return <div key={`${s.currentRound}-${s.currentQuestion?.id}-${index}`} data-rank={index}
                className={`tv-slat ${shown ? 'open' : ''} ${fresh ? 'fresh' : ''}`} aria-label={shown ? `${answer.text} · ${answer.points}` : `الإجابة ${index + 1} مخفية`}>
                <span className="slat-rank">{String(index + 1).padStart(2, '0')}</span>
                <span className={answer.text.length > 34 ? 'slat-answer compact' : 'slat-answer'}>{shown ? answer.text : '••••'}</span>
                <span className="slat-points">{shown ? answer.points : '—'}</span>
              </div>;
            })}
          </div>
          {strike && <div className="tv-strike" key={event?.id} aria-label="إجابة خاطئة">
            <svg viewBox="0 0 140 140" aria-hidden="true"><path d="m32 32 76 76m0-76-76 76" fill="none" stroke="#520a30" strokeWidth="42" strokeLinecap="square"/><path d="m32 32 76 76m0-76-76 76" fill="none" stroke="#ff405a" strokeWidth="30"/><path d="m32 32 76 76m0-76-76 76" fill="none" stroke="#ffd2d8" strokeWidth="5" /></svg>
          </div>}
        </div>
        {pointToken && target && event?.index !== undefined && <motion.span className="flying-score" aria-hidden="true"
          style={{ left: pointToken.left + pointToken.width / 2, top: pointToken.top + pointToken.height / 2 }}
          animate={{ x: target.left + target.width / 2 - pointToken.left - pointToken.width / 2, y: target.top + target.height / 2 - pointToken.top - pointToken.height / 2, opacity: [0, 1, 1, 0], scale: [.65, 1.15, 1] }}
          transition={{ duration: .5, ease: 'easeOut' }}>+{(s.currentQuestion?.answers[event.index]?.points ?? 0) * s.roundMultiplier}</motion.span>}
        <div className={`tv-caption ${s.phase === 'STEAL' ? 'stealing' : ''}`} role="status">
          {s.phase === 'STEAL' ? <><strong>فرصة السرقة! · {stealName}</strong><span>{matchStatus}</span>{event?.cue === 'third' && <span>فرصتكم تقلبوا الطاولة!</span>}</>
            : <><strong>{s.phase === 'FACE_OFF' ? 'المواجهة' : s.phase === 'ROUND_OVER' ? 'تم اعتماد الجولة' : ''}</strong><span>{matchStatus}</span></>}
        </div>
        {s.phase === 'FACE_OFF' && <div className={`vs-strip ${event?.cue === 'round' ? 'incoming' : ''}`}><b>{s.teamA.name}</b><i>VS</i><b>{s.teamB.name}</b></div>}
      </section>
      <Podium team={s.teamB} id="B" active={!final && (s.phase === 'STEAL' ? s.stealTeam : s.activeTeam) === 'B'} strikes={s.activeTeam === 'B' ? s.strikes : 0} reduced={reduced} />
    </div>
    <footer className="tv-footer"><span>مكتبة ألعاب مسجد ابن تيمية</span><span>{s.currentQuestion?.pointsSource === 'survey' && s.currentQuestion.sourceNote ? s.currentQuestion.sourceNote : 'أوزان الإجابات تقديرية'}</span></footer>
    {final && <div className="final-scene" aria-label="النتيجة النهائية">
      {!reduced && event?.cue === 'winner' && winner && <Confetti />}
      <div className="final-plaque">
        <ShowLogo /><span className="show-kicker">{winner ? 'THE WINNER' : 'MATCH TIED'}</span>
        <h2>{winner ? winner.name : 'تعادل!'}</h2>
        <div className="final-scores">{[s.teamA, s.teamB].map((team, i) => <div key={i}><span>{team.name}</span><b>{team.score}</b></div>)}</div>
        <p>{winner ? 'يعطيكم العافية يا أبطال!' : 'المجموع متساوي بعد أربع جولات · لا فائز'}</p>
        <a href="/">العودة للرئيسية</a>
      </div>
    </div>}
  </main>;
}

function Podium({ team, id, active, strikes, reduced }: { team: GameState['teamA']; id: string; active: boolean; strikes: number; reduced: boolean | null }) {
  return <aside className={`tv-podium team-${id} ${active ? 'on-turn' : ''}`}>
    <span className="podium-label">{active ? 'الدور الآن' : id === 'A' ? 'الفريق الأول' : 'الفريق الثاني'}</span>
    <h2>{team.name}</h2>
    <b className="podium-score"><AnimatedCounter value={team.score} duration={reduced ? 0 : 550} /></b>
    <div className="podium-strikes" aria-label={`${strikes} أخطاء من 3`}>{[1, 2, 3].map(n => <span key={n} className={n <= strikes ? 'lit' : ''}>×</span>)}</div>
  </aside>;
}
