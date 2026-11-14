import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTION_BANK } from '../src/data/questionBank';
import { createInitialGameState } from '../src/utils/gameDefaults';
import { awardRound, completeGame, resolveSteal } from '../src/utils/gameEngine';
import { toAudienceState } from '../src/utils/audienceState';
import { isNewerState, nextStateVersion } from '../src/utils/stateVersion';
import type { GameState } from '../src/types/game';

function makeRoundState(round: number, teamA = 0, teamB = 0): GameState {
  const question = QUESTION_BANK[0];
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

test('the bank retains 105 existing questions and adds 40 weighted questions per round', () => {
  assert.equal(QUESTION_BANK.length, 265);
  assert.equal(new Set(QUESTION_BANK.map((question) => question.id)).size, QUESTION_BANK.length);
  assert.equal(new Set(QUESTION_BANK.map((question) => question.questionText)).size, QUESTION_BANK.length);
  const roundCounts = [0, 0, 0, 0];
  let existingCount = 0;
  for (const question of QUESTION_BANK) {
    if (question.suggestedRound) {
      roundCounts[question.suggestedRound - 1]++;
      assert.equal(question.answers.length, 6);
      assert.equal(question.pointsSource, 'estimated');
    } else {
      existingCount++;
      assert.ok(question.answers.length >= 3 && question.answers.length <= 8);
    }
    assert.equal(question.answers.reduce((sum, answer) => sum + answer.points, 0), 100, question.questionText);
    assert.equal(new Set(question.answers.map((answer) => answer.text.normalize('NFKC').trim().toLocaleLowerCase('ar'))).size, question.answers.length);
  }
  assert.equal(existingCount, 105);
  assert.deepEqual(roundCounts, [40, 40, 40, 40]);
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
  const question = QUESTION_BANK[0];
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

test('restart and Undo keep a strictly increasing room version', () => {
  const current = { ...makeRoundState(2), actionId: 9, lastUpdated: Date.now() + 1000 };
  const reset = { ...createInitialGameState(), ...nextStateVersion(current) };
  assert.equal(reset.actionId, 10);
  assert.ok(reset.lastUpdated > current.lastUpdated);
  assert.equal(isNewerState(reset, current), true);
  assert.equal(isNewerState(current, reset), false);
  assert.equal(isNewerState(reset, reset), false);
});
