import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGameState } from '../src/utils/gameDefaults';
import { applyRoomCommand, type Command, type RoomMatch } from '../src/utils/roomCommands';
import { toAudienceState } from '../src/utils/audienceState';

test('a complete four-round show preserves the prompt, never awards twice, and declares the actual winner', () => {
  let match: RoomMatch = { state: createInitialGameState(), history: [], customQuestions: [] };
  const act = (command: Command) => (match = applyRoomCommand(match, command)).state;
  const q = match.state.currentQuestion!;
  act({ type: 'multipliers', values: [2, 1, 2, 3] });
  act({ type: 'start', team: 'A' });
  assert.equal(act({ type: 'multipliers', values: [5, 5, 5, 5] }).roundMultiplier, 2);
  for (let index = 0; index < 3; index++) act({ type: 'reveal', index });
  const base = q.answers.slice(0, 3).reduce((sum, a) => sum + a.points, 0);
  const action = match.state.actionId;
  act({ type: 'reveal', index: 2 });
  assert.equal(match.state.actionId, action);
  assert.equal(match.state.roundBank, base);
  for (let count = 0; count < 3; count++) act({ type: 'strike' });
  assert.equal(match.state.phase, 'STEAL');
  assert.equal(match.state.stealTeam, 'B');
  assert.equal(act({ type: 'undoStrike' }).phase, 'GUESSING');
  assert.equal(match.state.strikes, 2);
  act({ type: 'strike' });
  assert.equal(toAudienceState(match.state).currentQuestion!.questionText, q.questionText);
  assert.equal(toAudienceState(match.state).currentQuestion!.answers[3].text, '');
  act({ type: 'resolve', success: true });
  act({ type: 'resolve', success: false });
  act({ type: 'revealAll' });
  assert.equal(match.state.teamB.score, base * 2);
  assert.equal(match.state.teamA.score, 0);
  for (const round of [2, 3, 4]) {
    assert.equal(act({ type: 'next' }).currentRound, round);
    act({ type: 'start', team: round === 2 ? 'A' : 'B' });
    if (round === 2) {
      act({ type: 'reveal', index: 0 });
      for (let count = 0; count < 3; count++) act({ type: 'strike' });
      assert.equal(act({ type: 'resolve', success: false }).teamA.score, match.state.currentQuestion!.answers[0].points);
    } else {
      for (let index = 0; index < match.state.currentQuestion!.answers.length; index++) act({ type: 'reveal', index });
    }
    if (round !== 4) assert.equal(act({ type: 'finish' }).phase, 'ROUND_OVER');
  }
  assert.equal(act({ type: 'next' }).currentRound, 4);
  assert.equal(act({ type: 'finish' }).phase, 'GAME_OVER');
  assert.equal(match.state.teamB.score, base * 2 + 500);
  assert.ok(match.state.teamB.score > match.state.teamA.score);
});

test('timer pause, resume and undo survive serialized state', () => {
  let match: RoomMatch = { state: createInitialGameState(), history: [], customQuestions: [] };
  match = applyRoomCommand(match, { type: 'start', team: 'A' }, 1000);
  match = applyRoomCommand(match, { type: 'timer' }, 1000);
  match = applyRoomCommand(match, { type: 'timer' }, 9000);
  assert.equal(match.state.timerSeconds, 22);
  match = JSON.parse(JSON.stringify(match));
  match = applyRoomCommand(match, { type: 'timer' }, 11000);
  assert.equal(match.state.timerEndsAt, 33000);
  match = applyRoomCommand(match, { type: 'undo' }, 12000);
  assert.equal(match.state.timerRunning, false);
  assert.equal(match.state.timerSeconds, 22);
});
