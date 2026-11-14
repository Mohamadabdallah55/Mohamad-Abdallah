import { useEffect, useState } from 'react';
import type { GameState, Question } from '../types/game';
import type { Command, TeamId } from '../utils/roomCommands';
import { getTimerRemaining, ROUND_MULTIPLIERS } from '../utils/gameEngine';
import { AnimatedCounter } from './AnimatedCounter';
import { ShowLogo } from './ShowLogo';

interface Props {
  state: GameState; questions: Question[]; canUndo: boolean; pending: boolean; error: string;
  serverOffset: number; send: (command: Command) => Promise<boolean>; onConnect: () => void;
}
const labels = { FACE_OFF: 'يلا نبلّش الجولة!', GUESSING: 'الجولة شغّالة', STEAL: 'فرصة السرقة!', ROUND_OVER: 'تم اعتماد نتيجة الجولة', GAME_OVER: 'انتهت المباراة' };
const starterAnswers = () => [35, 25, 20, 12, 8].map(points => ({ text: '', points }));

export function HostController({ state: s, questions, canUndo, pending, error, send, serverOffset, onConnect }: Props) {
  const [panel, setPanel] = useState<'questions' | 'new' | 'settings' | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [suggestedRound, setSuggestedRound] = useState('');
  const [prompt, setPrompt] = useState('');
  const [newCategory, setNewCategory] = useState('أسئلة خاصة');
  const [answers, setAnswers] = useState(starterAnswers);
  const [now, setNow] = useState(Date.now());
  const playing = s.phase === 'GUESSING';
  const stealing = s.phase === 'STEAL';
  const setup = s.phase === 'FACE_OFF';
  const finishedRound = s.phase === 'ROUND_OVER';
  const finished = s.phase === 'GAME_OVER';
  useEffect(() => {
    if (!s.timerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 150);
    return () => window.clearInterval(id);
  }, [s.timerRunning]);
  const remain = getTimerRemaining(s, Math.max(now, s.lastUpdated - serverOffset) + serverOffset);
  const teams = [['A', s.teamA], ['B', s.teamB]] as const;
  const categories = [...new Set(questions.map(q => q.category))];
  const available = questions.filter(question =>
    (!category || question.category === category) &&
    (!suggestedRound || String(question.suggestedRound) === suggestedRound) &&
    (!search || question.questionText.includes(search) || question.answers.some(answer => answer.text.includes(search)))
  );
  const act = (command: Command) => () => { void send(command); };
  const usableAnswers = answers.filter(a => a.text.trim());
  const total = usableAnswers.reduce((sum, a) => sum + a.points, 0);
  const showError = error && <p className="host-error" role="alert">{error}</p>;

  return <div className="control-room" dir="rtl">
    <header className="remote-head">
      <ShowLogo />
      <div><b>استوديو المقدم</b><small>الجولة {s.currentRound} / 4</small></div>
      <button onClick={onConnect}>ربط الشاشة / الهاتف</button>
    </header>
    {!panel && showError}
    <main className="remote-main">
      <div className="remote-score">
        {teams.map(([id, team]) => <div key={id} className={s.activeTeam === id ? 'on-turn' : ''}>
          <span>{team.name}</span><b><AnimatedCounter value={team.score} /></b>
        </div>)}
        <div className="remote-bank"><span>بنك الجولة <bdi>×{s.roundMultiplier}</bdi></span><b>{s.roundBank * s.roundMultiplier}</b></div>
      </div>
      <fieldset disabled={pending} className="remote-controls">
        <div className="remote-tools">
          <button onClick={() => setPanel('questions')}>بنك الأسئلة</button>
          <button onClick={() => setPanel('settings')}>الفرق والإعدادات</button>
          <button onClick={act({ type: 'sound', muted: !s.muted })} aria-pressed={s.muted}>{s.muted ? 'تشغيل الصوت' : 'كتم الصوت'}</button>
          <button onClick={act({ type: 'skip' })} disabled={!s.showEvent}>تخطّي المشهد</button>
        </div>
        <section className="remote-board">
          <span className="remote-tag">{labels[s.phase]} · {s.currentQuestion?.category}</span>
          <h1>{s.currentQuestion?.questionText}</h1>
          <small>{s.currentQuestion?.pointsSource === 'survey' && s.currentQuestion.sourceNote ? s.currentQuestion.sourceNote : 'أوزان تقديرية للعبة'}</small>
          {setup && <div className="remote-start">
            <span>مين أخذ المواجهة؟</span>
            <div>{teams.map(([team, entry]) => <button className="remote-gold" key={team} onClick={act({ type: 'start', team })}>بلّش مع {entry.name}</button>)}</div>
          </div>}
          {stealing && <div className="remote-steal">
            <b>فرصة واحدة لـ{s.stealTeam === 'A' ? s.teamA.name : s.teamB.name}</b>
            <div><button className="remote-gold" onClick={act({ type: 'resolve', success: true })}>نجحت السرقة</button>
              <button onClick={act({ type: 'resolve', success: false })}>فشلت السرقة</button></div>
          </div>}
          <div className="remote-answers">
            {s.currentQuestion?.answers.map((answer, index) => <button key={index} className={s.revealedAnswers[index] ? 'is-shown' : ''}
              disabled={!playing || s.revealedAnswers[index]} onClick={act({ type: 'reveal', index })}>
              <span className="remote-rank">{index + 1}</span><strong>{answer.text}</strong><b>{answer.points}</b>
              <span className="remote-reveal-label">{s.revealedAnswers[index] ? 'مكشوف' : 'كشف'}</span>
            </button>)}
          </div>
          {playing && <details className="remote-manual">
            <summary>اعتماد بنك الجولة يدويًا</summary>
            <div>{teams.map(([team, entry]) => <button key={team} onClick={act({ type: 'award', team })} disabled={!s.roundBank}>اعتماد لـ{entry.name}</button>)}</div>
          </details>}
          {finishedRound && <div className="remote-next">
            <button disabled={s.revealedAnswers.every(Boolean)} onClick={act({ type: 'revealAll' })}>كشف المتبقي بلا نقاط</button>
            <button className="remote-gold" onClick={act({ type: s.currentRound < 4 ? 'next' : 'finish' })}>{s.currentRound < 4 ? 'الجولة التالية' : 'إعلان النتيجة النهائية'}</button>
          </div>}
          {finished && <div className="remote-next">
            <b>{s.teamA.score === s.teamB.score ? 'تعادل · لا فائز' : `الفائز: ${(s.teamA.score > s.teamB.score ? s.teamA : s.teamB).name}`}</b>
            <button className="remote-gold" onClick={() => { if (window.confirm('تبدأ مباراة جديدة في نفس الغرفة؟')) void send({ type: 'restart' }); }}>مباراة جديدة</button>
            <a href="/">العودة للرئيسية</a>
          </div>}
        </section>
        {(playing || stealing) && <div className="remote-tools remote-timer">
          <b>{s.timerVisible ? `${remain} ث` : 'مؤقت اختياري'}</b>
          <button onClick={act({ type: 'timer' })}>{s.timerRunning ? 'إيقاف' : s.timerVisible && remain ? 'استئناف' : 'تشغيل 30ث'}</button>
          {s.timerVisible && <button onClick={act({ type: 'timerReset' })}>إعادة ضبط</button>}
        </div>}
        <div className="remote-dock">
          {playing && <button className="remote-strike" onClick={act({ type: 'strike' })}><b>✕</b> تسجيل خطأ · {s.strikes}/3</button>}
          {(playing || stealing) && !!s.strikes && <button onClick={act({ type: 'undoStrike' })}>إلغاء X</button>}
          {playing && <button disabled={!s.roundBank} onClick={act({ type: 'steal' })}>ابدأ السرقة</button>}
          <button disabled={!canUndo} onClick={act({ type: 'undo' })}>↶ تراجع</button>
        </div>
      </fieldset>
    </main>
    {panel && <div className="remote-backdrop" onClick={() => setPanel(null)}>
      <section className="remote-sheet" role="dialog" aria-modal="true" aria-label="إعدادات المقدم" onClick={e => e.stopPropagation()}>
        <header><h2>{panel === 'questions' ? 'بنك الأسئلة' : panel === 'new' ? 'إضافة سؤالك' : 'إعدادات المباراة'}</h2>
          <button onClick={() => setPanel(null)} aria-label="إغلاق">✕</button>
        </header>
        {showError}
        <fieldset disabled={pending}>
          {panel === 'questions' && <>
            <div className="remote-tools"><input aria-label="بحث في الأسئلة" placeholder="ابحث عن سؤال…" value={search} onChange={e => setSearch(e.target.value)} />
              <select aria-label="فئة الأسئلة" value={category} onChange={e => setCategory(e.target.value)}><option value="">كل الفئات</option>{categories.map(cat => <option key={cat}>{cat}</option>)}</select>
              <select aria-label="الجولة المقترحة" value={suggestedRound} onChange={e => setSuggestedRound(e.target.value)}>
                <option value="">كل الجولات</option>
                {[1, 2, 3, 4].map(round => <option key={round} value={round}>مقترحة للجولة {round}</option>)}
              </select>
              <button className="remote-gold" onClick={() => setPanel('new')}>إضافة سؤال</button></div>
            {!setup && <p>اختيار السؤال متاح قبل بداية الجولة.</p>}
            <ol className="remote-questions">{available.map(q => <li key={q.id}>
              <span>{q.questionText}<small>{q.category} · {q.answers.length} إجابات{q.suggestedRound && ` · مقترح للجولة ${q.suggestedRound}`}</small></span>
              <button disabled={!setup || s.burntQuestionIds.includes(q.id)} onClick={async () => {
                if (await send({ type: 'question', id: q.id })) setPanel(null);
              }}>{q.id === s.currentQuestion?.id ? 'الحالي' : s.burntQuestionIds.includes(q.id) ? 'استُخدم' : 'اختيار'}</button>
            </li>)}</ol>
          </>}
          {panel === 'new' && <form className="remote-form" onSubmit={async e => {
            e.preventDefault();
            if (await send({ type: 'addQuestion', question: { id: 0, questionText: prompt, category: newCategory, answers: usableAnswers }, select: setup })) {
              setPrompt(''); setAnswers(starterAnswers()); setPanel(setup ? null : 'questions');
            }
          }}>
            <label>السؤال<input required maxLength={250} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
            <label>الفئة<input required maxLength={60} value={newCategory} onChange={e => setNewCategory(e.target.value)} /></label>
            {answers.map((a, index) => <div className="remote-form-row" key={index}>
              <input aria-label={`إجابة ${index + 1}`} placeholder={`إجابة ${index + 1}`} maxLength={100} value={a.text}
                onChange={e => setAnswers(old => old.map((answer, i) => i === index ? { ...answer, text: e.target.value } : answer))} />
              <input aria-label={`نقاط الإجابة ${index + 1}`} type="number" min={0} max={100} value={a.points}
                onChange={e => setAnswers(old => old.map((answer, i) => i === index ? { ...answer, points: Number(e.target.value) } : answer))} />
              <button type="button" disabled={answers.length <= 2} aria-label="حذف خانة" onClick={() => setAnswers(old => old.filter((_, i) => i !== index))}>−</button>
            </div>)}
            <div className="remote-tools"><button type="button" disabled={answers.length >= 8} onClick={() => setAnswers(old => [...old, { text: '', points: 0 }])}>خانة إضافية</button>
              <span>النقاط التقديرية: {total}/100</span><button className="remote-gold" disabled={total !== 100 || usableAnswers.length < 2}>حفظ السؤال</button></div>
          </form>}
          {panel === 'settings' && <div className="remote-form">
            {teams.map(([id, team]) => <TeamSettings key={id} id={id} team={team} disabled={finished} send={send} />)}
            <MultiplierSettings key={(s.multipliers ?? ROUND_MULTIPLIERS).join(',')} values={s.multipliers ?? ROUND_MULTIPLIERS} disabled={s.matchStarted || !setup || s.currentRound !== 1} send={send} />
            <p>عند تساوي المجموع بعد الجولة الرابعة يُعلَن التعادل.</p>
          </div>}
        </fieldset>
      </section>
    </div>}
  </div>;
}

function TeamSettings({ id, team, disabled, send }: { id: TeamId; team: GameState['teamA']; disabled: boolean; send: Props['send'] }) {
  return <form className="remote-form-row" onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    void send({ type: 'team', team: id, name: String(data.get('name')), score: Number(data.get('score')) });
  }}>
    <label>اسم الفريق {id}<input name="name" required maxLength={40} key={team.name} defaultValue={team.name} disabled={disabled} /></label>
    <label>النقاط<input name="score" required type="number" min={0} max={999999} key={team.score} defaultValue={team.score} disabled={disabled} /></label>
    <button disabled={disabled}>حفظ</button>
  </form>;
}

function MultiplierSettings({ values, disabled, send }: { values: readonly number[]; disabled: boolean; send: Props['send'] }) {
  return <form className="remote-form" onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    void send({ type: 'multipliers', values: values.map((_, i) => Number(data.get(`round${i}`))) });
  }}>
    <p>مضاعفات الجولات · تُضبط قبل بدء المباراة</p>
    <div className="remote-multipliers">{values.map((value, index) => <label key={index}>جولة {index + 1}
      <input type="number" name={`round${index}`} min={1} max={5} required defaultValue={value} disabled={disabled} />
    </label>)}</div>
    <button disabled={disabled}>اعتماد المضاعفات</button>
  </form>;
}
