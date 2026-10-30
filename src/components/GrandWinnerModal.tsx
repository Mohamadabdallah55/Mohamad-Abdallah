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
    <div className="winner-stage" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="winner-title">
      <Confetti active={!isTie} />
      <div className="winner-halo" aria-hidden="true" />
      <section className="winner-card">
        <span className="winner-eyebrow">أُسدل الستار · أربع جولات مكتملة</span>
        <div className="winner-emblem" aria-hidden="true">{isTie ? <img src="/family-challenge-logo-v2.png" alt="" /> : <img src={winner === 'A' ? '/assets/shields/team-cyan-hires.png' : '/assets/shields/team-violet-hires.png'} alt="" />}</div>
        <h2 id="winner-title">{isTie ? 'تعادل الفريقان' : 'الفائز في ساحة المنافسة'}</h2>
        <p className="winner-name">{isTie ? 'نتيجة متساوية' : winningTeam.name}</p>
        <p className="winner-caption">{isTie ? 'المباراة انتهت بالتعادل. يمكن للمقدم حسم النتيجة يدويًا.' : 'أداءٌ جمع المعرفة وسرعة البديهة حتى آخر نقطة.'}</p>
        <div className="winner-scoreboard">
          <ScoreResult team={teamA} winner={winner === 'A'} side="a" />
          <span className="winner-divider">النقاط النهائية</span>
          <ScoreResult team={teamB} winner={winner === 'B'} side="b" />
        </div>
        <div className="winner-actions">
          <button type="button" className="winner-restart" onClick={onRestart}>ابدأ مباراة جديدة <span aria-hidden="true">↺</span></button>
          <button type="button" className="winner-close" onClick={onClose}>إغلاق العرض</button>
        </div>
      </section>
    </div>
  );
}

function ScoreResult({ team, winner, side }: { team: Team; winner: boolean; side: 'a' | 'b' }) {
  return (
    <div className={`winner-team winner-team-${side}${winner ? ' winner-team-first' : ''}`}>
      <span>{team.name}{winner && <i>الفائز</i>}</span>
      <strong>{team.score.toLocaleString('ar-JO')}</strong>
      <small>نقطة</small>
    </div>
  );
}
