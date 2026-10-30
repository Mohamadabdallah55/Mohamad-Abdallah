import type { GameState } from '../types/game';

/** Audience-safe projection: hidden answer text and scores are blanked before broadcast. */
export function toAudienceState(state: GameState): GameState {
  if (!state.currentQuestion) return state;
  return {
    ...state,
    currentQuestion: {
      ...state.currentQuestion,
      answers: state.currentQuestion.answers.map((answer, index) =>
        state.revealedAnswers[index] ? answer : { text: '', points: 0 }
      ),
    },
  };
}
