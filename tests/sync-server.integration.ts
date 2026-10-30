import assert from 'node:assert/strict';
import { createInitialGameState } from '../src/utils/gameDefaults';
import { toAudienceState } from '../src/utils/audienceState';

const base = process.env.SYNC_TEST_URL || 'http://127.0.0.1:3107';
const roomId = `TEST-${Date.now()}`;
const endpoint = `${base}/api/sync/state?room=${roomId}`;
const initial = toAudienceState({ ...createInitialGameState(), roomId, actionId: 1, lastUpdated: Date.now() });

async function post(state: unknown) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: roomId, state }),
  });
  return { status: response.status, body: await response.json() };
}

assert.equal((await post(initial)).status, 200);
assert.equal((await post(initial)).body.duplicate, true);
assert.equal((await post({ ...initial, actionId: 0 })).body.duplicate, true);
const leaked = { ...initial, currentQuestion: createInitialGameState().currentQuestion };
assert.equal((await post(leaked)).status, 400);

const next = { ...initial, actionId: 2, lastUpdated: initial.lastUpdated + 1, strikes: 1 };
assert.equal((await post(next)).status, 200);
const fetched = await fetch(endpoint).then((response) => response.json());
assert.equal(fetched.state.actionId, 2);
assert.equal(fetched.state.strikes, 1);
assert.equal(fetched.state.currentQuestion.answers[0].text, '');
console.log(`Sync API: persisted room ${roomId}, duplicate/stale/leak protection passed`);
