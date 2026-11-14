import type { GameState, Question } from '../types/game';
import type { Command } from './roomCommands';

export interface PrivateView {
  state: GameState;
  canUndo: boolean;
  questions?: Question[];
  serverNow: number;
}

export class RoomError extends Error {
  constructor(message: string, readonly status: number, readonly view?: PrivateView) { super(message); }
}

async function call<T>(route: string, room?: string, token?: string, body?: object, signal?: AbortSignal): Promise<T> {
  const query = room ? `?room=${encodeURIComponent(room)}` : '';
  let response: Response;
  try {
    response = await fetch(`/api/sync/${route}${query}`, {
      method: body ? 'POST' : 'GET', headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal,
    });
  } catch { throw new RoomError('انقطع الاتصال بالخادم. تحقق من الشبكة وحاول من جديد.', 0); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new RoomError(data?.error ?? 'شغّل اللعبة من خادم Family Feud أولًا.', response.status, data?.state ? data : undefined);
  return data as T;
}

export const createRoom = () => call<PrivateView & { roomId: string; token: string }>('rooms', undefined, undefined, {});
export const getHostState = (room: string, token: string, signal?: AbortSignal) => call<PrivateView>('host', room, token, undefined, signal);
export const getAudienceState = (room: string, signal?: AbortSignal) => call<Omit<PrivateView, 'canUndo'>>('state', room, undefined, undefined, signal);
export const sendCommand = (room: string, token: string, expectedActionId: number, command: Command) =>
  call<PrivateView>('command', room, token, { expectedActionId, command });
