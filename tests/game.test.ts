import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTION_BATCH_01 } from '../src/data/questionBatch01';
import { createInitialGameState } from '../src/utils/gameDefaults';
import { awardRound, completeGame, resolveSteal } from '../src/utils/gameEngine';
import { toAudienceState } from '../src/utils/audienceState';
import type { GameState } from '../src/types/game';

function makeRoundState(round: number, teamA = 0, teamB = 0): GameState {
  const question = QUESTION_BATCH_01[0];
  return {
    ...createInitialGameState(),
    teamA: { ...createInitialGameState().teamA, score: teamA },
    teamB: { ...createInitialGameState().teamB, score: teamB },
    currentQuestion: question,
    currentRound: round,
    roundMultiplier: [1, 1, 2, 3][round - 1],
    roundBank: 0,
    revealedAnswers: question.answers.map(() => true),
    phase: 'GUESSING',
    awardedRound: null,
  };
}

test('the reviewed starter bank has distinct answers and 100 estimated points per question', () => {
  assert.equal(QUESTION_BATCH_01.length, 25);
  assert.equal(new Set(QUESTION_BATCH_01.map((question) => question.id)).size, QUESTION_BATCH_01.length);
  assert.equal(new Set(QUESTION_BATCH_01.map((question) => question.questionText)).size, QUESTION_BATCH_01.length);
  for (const question of QUESTION_BATCH_01) {
    assert.equal(question.pointsSource, 'estimated');
    assert.ok(question.answers.length >= 4 && question.answers.length <= 7);
    assert.equal(question.answers.reduce((sum, answer) => sum + answer.points, 0), 100, question.questionText);
    assert.equal(new Set(question.answers.map((answer) => answer.text.normalize('NFKC').trim().toLocaleLowerCase('ar'))).size, question.answers.length);
  }
});

test('four rounds award the base bank with ×1, ×1, ×2, ×3 exactly once', () => {
  const multipliers = [1, 1, 2, 3];
  let teamA = 0;
  let teamB = 0;

  multipliers.forEach((multiplier, index) => {
    const round = index + 1;
    const beneficiary = round % 2 ? 'A' : 'B';
    const state = makeRoundState(round, teamA, teamB);
    assert.equal(state.roundMultiplier, multiplier);
    const awarded = awardRound(state, beneficiary);
    const points = 100 * multiplier;
    assert.equal(awarded.roundBank, 100);
    assert.equal(awarded.teamA.score, teamA + (beneficiary === 'A' ? points : 0));
    assert.equal(awarded.teamB.score, teamB + (beneficiary === 'B' ? points : 0));
    assert.equal(awardRound(awarded, beneficiary === 'A' ? 'B' : 'A'), awarded);
    teamA = awarded.teamA.score;
    teamB = awarded.teamB.score;
  });

  assert.equal(teamA, 300);
  assert.equal(teamB, 400);
});

test('successful and failed steals award the multiplied bank to exactly one correct team', () => {
  const base = {
    ...makeRoundState(4),
    roundMultiplier: 3,
    phase: 'STEAL' as const,
    originalTeam: 'A' as const,
    activeTeam: 'A' as const,
    stealTeam: 'B' as const,
  };
  const success = resolveSteal(base, true);
  assert.equal(success.teamA.score, 0);
  assert.equal(success.teamB.score, 300);
  assert.equal(success.awardedRound, 4);

  const failure = resolveSteal(base, false);
  assert.equal(failure.teamA.score, 300);
  assert.equal(failure.teamB.score, 0);
  assert.equal(failure.awardedRound, 4);
  assert.equal(resolveSteal(failure, true), failure);
});

test('game completion is only possible after the awarded fourth round', () => {
  const early = { ...makeRoundState(3), phase: 'ROUND_OVER' as const, awardedRound: 3 };
  assert.equal(completeGame(early), early);
  const finalRound = awardRound(makeRoundState(4), 'A');
  assert.equal(completeGame(finalRound).phase, 'GAME_OVER');
});

test('audience state exposes only revealed answer text and points', () => {
  const question = QUESTION_BATCH_01[0];
  const state = { ...makeRoundState(1), currentQuestion: question, revealedAnswers: question.answers.map((_, index) => index === 2) };
  const publicState = toAudienceState(state);
  assert.equal(publicState.currentQuestion?.answers[2].text, question.answers[2].text);
  assert.equal(publicState.currentQuestion?.answers[2].points, question.answers[2].points);
  state.revealedAnswers.forEach((isRevealed, index) => {
    if (isRevealed) return;
    assert.equal(publicState.currentQuestion?.answers[index].text, '');
    assert.equal(publicState.currentQuestion?.answers[index].points, 0);
  });
  assert.equal(state.currentQuestion?.answers[0].text, question.answers[0].text);
});
