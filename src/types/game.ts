export interface AnswerItem {
  text: string;
  points: number;
}

export interface Question {
  id: number;
  category: string;
  questionText: string;
  answers: AnswerItem[];
}

export interface Team {
  name: string;
  score: number;
  members: string[];
}

export type RoundPhase = 
  | 'FACE_OFF'
  | 'GUESSING'
  | 'STEAL'
  | 'ROUND_OVER'
  | 'GAME_OVER';

export interface GameState {
  version: number;
  teamA: Team;
  teamB: Team;
  currentRound: number; // 1, 2, 3, 4
  roundMultiplier: number; // 1, 1, 2, 3
  roundBank: number;
  currentQuestion: Question | null;
  revealedAnswers: boolean[];
  strikes: number; // 0, 1, 2, 3
  activeTeam: 'A' | 'B' | null;
  phase: RoundPhase;
  burntQuestionIds: number[];
  faceOffWinner: 'A' | 'B' | null;
  stealTeam: 'A' | 'B' | null;
  strikeOverlayActive: boolean;
  strikeOverlayCount: number;
  roomId?: string;
  lastUpdated: number;
}

export type GameSyncMessage = 
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'TRIGGER_SOUND'; sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal' }
  | { type: 'REQUEST_STATE' };
