import { GameState, Question } from '../types/game';
import { INITIAL_QUESTIONS } from '../data/questions';

export function getMultiplierForRound(round: number): number {
  if (round === 3) return 2;
  if (round >= 4) return 3;
  return 1;
}

export function createInitialGameState(): GameState {
  const firstQuestion = INITIAL_QUESTIONS[0];

  return {
    version: 1,
    teamA: {
      name: 'الفريق (أ)',
      score: 0,
      members: ['لاعب 1', 'لاعب 2', 'لاعب 3', 'لاعب 4'],
    },
    teamB: {
      name: 'الفريق (ب)',
      score: 0,
      members: ['لاعب 1', 'لاعب 2', 'لاعب 3', 'لاعب 4'],
    },
    currentRound: 1,
    roundMultiplier: 1,
    roundBank: 0,
    currentQuestion: firstQuestion,
    revealedAnswers: new Array(firstQuestion.answers.length).fill(false),
    strikes: 0,
    activeTeam: null,
    phase: 'FACE_OFF',
    burntQuestionIds: [firstQuestion.id],
    faceOffWinner: null,
    stealTeam: null,
    strikeOverlayActive: false,
    strikeOverlayCount: 0,
    lastUpdated: Date.now(),
  };
}

export function pickNewQuestion(allQuestions: Question[], burntIds: number[], categoryFilter?: string): Question | null {
  const available = allQuestions.filter(q => {
    const isBurnt = burntIds.includes(q.id);
    const matchesCategory = !categoryFilter || categoryFilter === 'all' || q.category === categoryFilter;
    return !isBurnt && matchesCategory;
  });

  if (available.length === 0) {
    const fallback = allQuestions.filter(q => !categoryFilter || categoryFilter === 'all' || q.category === categoryFilter);
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}
