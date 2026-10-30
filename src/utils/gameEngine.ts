import { GameState } from '../types/game';

export const ROUND_MULTIPLIERS = [1, 1, 2, 3] as const;

export function calculateRoundBank(state: Pick<GameState, 'currentQuestion' | 'revealedAnswers' | 'roundMultiplier'>) {
  if (!state.currentQuestion) return 0;
  return state.currentQuestion.answers.reduce(
    (sum, answer, index) => sum + (state.revealedAnswers[index] ? answer.points : 0),
    0
  );
}

export function calculateAwardPoints(state: Pick<GameState, 'currentQuestion' | 'revealedAnswers' | 'roundMultiplier'>) {
  return calculateRoundBank(state) * state.roundMultiplier;
}

export function awardRound(state: GameState, team: 'A' | 'B'): GameState {
  if (state.awardedRound === state.currentRound) return state;
  const points = calculateAwardPoints(state);
  return {
    ...state,
    roundBank: calculateRoundBank(state),
    teamA: { ...state.teamA, score: state.teamA.score + (team === 'A' ? points : 0) },
    teamB: { ...state.teamB, score: state.teamB.score + (team === 'B' ? points : 0) },
    phase: 'ROUND_OVER',
    awardedRound: state.currentRound,
    timerRunning: false,
    timerEndsAt: null,
  };
}

export function resolveSteal(state: GameState, success: boolean): GameState {
  if (state.phase !== 'STEAL' || state.awardedRound === state.currentRound) return state;
  const beneficiary = success
    ? state.stealTeam || (state.activeTeam === 'A' ? 'B' : 'A')
    : state.originalTeam || state.activeTeam || 'A';
  return awardRound(state, beneficiary);
}

export function completeGame(state: GameState): GameState {
  if (state.currentRound !== 4 || state.phase !== 'ROUND_OVER' || state.awardedRound !== 4) return state;
  return { ...state, phase: 'GAME_OVER', timerRunning: false, timerEndsAt: null };
}

export function getTimerRemaining(state: Pick<GameState, 'timerRunning' | 'timerEndsAt' | 'timerSeconds'>, now = Date.now()) {
  if (!state.timerRunning || !state.timerEndsAt) return state.timerSeconds;
  return Math.max(0, Math.ceil((state.timerEndsAt - now) / 1000));
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
