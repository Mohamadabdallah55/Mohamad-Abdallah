import type { GameState } from '../types/game';

/** A room's action number never goes backwards, including after Undo or restart. */
export function nextStateVersion(previous: GameState): Pick<GameState, 'actionId' | 'lastUpdated'> {
  return {
    actionId: (previous.actionId ?? 0) + 1,
    lastUpdated: Math.max(Date.now(), (previous.lastUpdated ?? 0) + 1),
  };
}

export function isNewerState(incoming: GameState, current: GameState): boolean {
  if ((incoming.actionId ?? 0) !== (current.actionId ?? 0)) {
    return (incoming.actionId ?? 0) > (current.actionId ?? 0);
  }
  return (incoming.lastUpdated ?? 0) > (current.lastUpdated ?? 0);
}
