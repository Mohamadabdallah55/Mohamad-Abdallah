import { GameState } from '../types/game';

export const ROUND_MULTIPLIERS = [1, 1, 2, 3] as const;

export function calculateRoundBank(state: Pick<GameState, 'currentQuestion' | 'revealedAnswers' | 'roundMultiplier'>) {
  if (!state.currentQuestion) return 0;
  const base = state.currentQuestion.answers.reduce(
    (sum, answer, index) => sum + (state.revealedAnswers[index] ? answer.points : 0),
    0
  );
  return base * state.roundMultiplier;
}

export function awardRound(state: GameState, team: 'A' | 'B'): GameState {
  if (state.awardedRound === state.currentRound) return state;
  const points = calculateRoundBank(state);
  return {
    ...state,
    roundBank: points,
    teamA: { ...state.teamA, score: state.teamA.score + (team === 'A' ? points : 0) },
    teamB: { ...state.teamB, score: state.teamB.score + (team === 'B' ? points : 0) },
    phase: 'ROUND_OVER',
    awardedRound: state.currentRound,
    timerRunning: false,
    timerEndsAt: null,
  };
}

export function normalizeLoadedState(state: GameState): GameState {
  return {
    ...state,
    timerSeconds: state.timerSeconds ?? 30,
    timerRunning: state.timerRunning ?? false,
    timerEndsAt: state.timerEndsAt ?? null,
    volume: state.volume ?? 0.8,
    muted: state.muted ?? false,
    awardedRound: state.awardedRound ?? null,
    actionId: state.actionId ?? 0,
  };
}
