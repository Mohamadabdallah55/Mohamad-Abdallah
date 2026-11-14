import type { GameState, Question } from '../types/game';
import { awardRound, calculateRoundBank, completeGame, getTimerRemaining, resolveSteal, ROUND_MULTIPLIERS } from './gameEngine';
import { createInitialGameState } from './gameDefaults';
import { QUESTION_BANK } from '../data/questionBank';

export type TeamId = 'A' | 'B';
export type ShowCue = 'round' | 'start' | 'reveal' | 'strike' | 'third' | 'steal' | 'stealWon' | 'stealLost' | 'award' | 'lead' | 'winner';
export type Command =
  | { type: 'start' | 'award'; team: TeamId }
  | { type: 'reveal'; index: number }
  | { type: 'resolve'; success: boolean }
  | { type: 'question'; id: number }
  | { type: 'addQuestion'; question: Question; select?: boolean }
  | { type: 'multipliers'; values: number[] }
  | { type: 'team'; team: TeamId; name?: string; score?: number }
  | { type: 'sound'; muted: boolean }
  | { type: 'strike' | 'steal' | 'revealAll' | 'next' | 'finish' | 'undo' | 'undoStrike' | 'timer' | 'timerReset' | 'skip' | 'restart' };

export interface RoomMatch {
  state: GameState;
  history: GameState[];
  customQuestions: Question[];
}

const teamValid = (team: unknown): team is TeamId => team === 'A' || team === 'B';
const opposite = (team: TeamId) => team === 'A' ? 'B' : 'A';
const open = (state: GameState) => state.phase === 'GUESSING' && state.activeTeam !== null;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const leader = (state: GameState) => Math.sign(state.teamA.score - state.teamB.score);

function validateQuestion(q: Question): Question | null {
  if (!q || !text(q.questionText, 250) || !text(q.category, 60) || !Array.isArray(q.answers) || !integer(q.answers.length, 2, 8)) return null;
  if (q.answers.some(a => !a || !text(a.text, 100) || !integer(a.points, 0, 100))) return null;
  const answers = q.answers.map(a => ({ text: a.text.trim(), points: a.points }));
  if (new Set(answers.map(a => a.text.normalize('NFKC'))).size !== answers.length || answers.reduce((sum, a) => sum + a.points, 0) !== 100) return null;
  return { id: 0, category: q.category.trim(), questionText: q.questionText.trim(), answers, pointsSource: 'estimated' };
}

function setQuestion(state: GameState, question: Question): GameState {
  return {
    ...state, currentQuestion: question, revealedAnswers: question.answers.map(() => false),
    burntQuestionIds: [...new Set([...state.burntQuestionIds, question.id])],
  };
}

export function applyRoomCommand(match: RoomMatch, value: unknown, now = Date.now()): RoomMatch {
  if (!value || typeof value !== 'object') return match;
  const cmd = value as Command;
  const { state: s } = match;
  const bank = [...match.customQuestions, ...QUESTION_BANK];
  let next = s;
  let cue: ShowCue | undefined;
  let index: number | undefined;
  let beneficiary: TeamId | undefined;
  let history = match.history;
  let customQuestions = match.customQuestions;
  let undoable = true;

  switch (cmd.type) {
    case 'start':
      if (s.phase !== 'FACE_OFF' || !s.currentQuestion || !teamValid(cmd.team)) break;
      next = { ...s, phase: 'GUESSING', activeTeam: cmd.team, originalTeam: cmd.team, faceOffWinner: cmd.team, matchStarted: true };
      cue = 'start';
      break;
    case 'reveal':
      if (!open(s) || !s.currentQuestion || !integer(cmd.index, 0, s.currentQuestion.answers.length - 1) || s.revealedAnswers[cmd.index]) break;
      index = cmd.index;
      next = { ...s, revealedAnswers: s.revealedAnswers.map((shown, i) => shown || i === index) };
      next.roundBank = calculateRoundBank(next);
      cue = 'reveal';
      if (next.revealedAnswers.every(Boolean)) next = awardRound(next, s.activeTeam!);
      break;
    case 'strike':
    case 'steal': {
      if (!open(s) || s.strikes >= 3 || (cmd.type === 'steal' && s.roundBank === 0)) break;
      const strikes = cmd.type === 'strike' ? s.strikes + 1 : s.strikes;
      const stealing = strikes === 3 || cmd.type === 'steal';
      next = stealing
        ? { ...s, strikes, phase: 'STEAL', originalTeam: s.activeTeam, stealTeam: opposite(s.activeTeam!), timerRunning: false, timerEndsAt: null, timerSeconds: 30, timerVisible: false }
        : { ...s, strikes };
      cue = cmd.type === 'steal' ? 'steal' : stealing ? 'third' : 'strike';
      break;
    }
    case 'award':
      if (!open(s) || !teamValid(cmd.team) || s.roundBank === 0) break;
      next = awardRound(s, cmd.team);
      cue = 'award';
      beneficiary = cmd.team;
      break;
    case 'resolve':
      if (s.phase !== 'STEAL' || typeof cmd.success !== 'boolean') break;
      next = resolveSteal(s, cmd.success);
      cue = cmd.success ? 'stealWon' : 'stealLost';
      beneficiary = (cmd.success ? s.stealTeam : s.originalTeam) ?? undefined;
      break;
    case 'revealAll':
      if (s.phase !== 'ROUND_OVER' || !s.revealedAnswers.some(shown => !shown)) break;
      next = { ...s, revealedAnswers: s.revealedAnswers.map(() => true) };
      break;
    case 'next': {
      if (s.phase !== 'ROUND_OVER' || s.awardedRound !== s.currentRound || s.currentRound >= 4) break;
      const q = bank.find(q => !s.burntQuestionIds.includes(q.id)) ?? bank[0];
      next = setQuestion({
        ...s, currentRound: s.currentRound + 1, roundMultiplier: (s.multipliers ?? ROUND_MULTIPLIERS)[s.currentRound],
        phase: 'FACE_OFF', roundBank: 0, strikes: 0, activeTeam: null, faceOffWinner: null,
        stealTeam: null, originalTeam: null, awardedRound: null, timerSeconds: 30, timerRunning: false,
        timerEndsAt: null, timerVisible: false,
      }, q);
      cue = 'round';
      break;
    }
    case 'finish':
      next = completeGame(s);
      cue = 'winner';
      break;
    case 'question': {
      if (s.phase !== 'FACE_OFF' || !integer(cmd.id, 1, Number.MAX_SAFE_INTEGER)) break;
      const question = bank.find(q => q.id === cmd.id);
      if (question && question.id !== s.currentQuestion?.id && !s.burntQuestionIds.includes(question.id)) {
        next = setQuestion({ ...s, burntQuestionIds: s.burntQuestionIds.filter(id => id !== s.currentQuestion?.id) }, question);
      }
      break;
    }
    case 'addQuestion': {
      const q = validateQuestion(cmd.question);
      if (!q || customQuestions.length >= 250) break;
      q.id = Math.max(now, (customQuestions[0]?.id ?? 0) + 1);
      customQuestions = [q, ...customQuestions];
      next = cmd.select && s.phase === 'FACE_OFF'
        ? setQuestion({ ...s, burntQuestionIds: s.burntQuestionIds.filter(id => id !== s.currentQuestion?.id) }, q)
        : { ...s };
      undoable = Boolean(cmd.select && s.phase === 'FACE_OFF');
      break;
    }
    case 'multipliers':
      if (s.matchStarted || s.currentRound !== 1 || s.phase !== 'FACE_OFF' || !Array.isArray(cmd.values) || cmd.values.length !== 4 || !cmd.values.every(v => integer(v, 1, 5))) break;
      next = { ...s, multipliers: cmd.values, roundMultiplier: cmd.values[0] };
      break;
    case 'team': {
      if (!teamValid(cmd.team) || s.phase === 'GAME_OVER') break;
      if (cmd.name !== undefined && !text(cmd.name, 40)) break;
      if (cmd.score !== undefined && !integer(cmd.score, 0, 999999)) break;
      const key = cmd.team === 'A' ? 'teamA' : 'teamB';
      next = { ...s, [key]: { ...s[key], name: cmd.name?.trim() ?? s[key].name, score: cmd.score ?? s[key].score } };
      break;
    }
    case 'sound':
      if (typeof cmd.muted !== 'boolean' || cmd.muted === s.muted) break;
      next = { ...s, muted: cmd.muted };
      undoable = false;
      break;
    case 'timer': {
      if (!open(s) && s.phase !== 'STEAL') break;
      const remaining = getTimerRemaining(s, now);
      next = s.timerRunning
        ? { ...s, timerRunning: false, timerEndsAt: null, timerSeconds: remaining }
        : { ...s, timerVisible: true, timerRunning: true, timerEndsAt: now + (remaining || 30) * 1000 };
      break;
    }
    case 'timerReset':
      if (open(s) || s.phase === 'STEAL') next = { ...s, timerSeconds: 30, timerRunning: false, timerEndsAt: null, timerVisible: false };
      break;
    case 'skip':
      if (s.showEvent) next = { ...s, showEvent: undefined };
      undoable = false;
      break;
    case 'undo':
    case 'undoStrike': {
      const previous = history.at(-1);
      if (!previous) break;
      if (cmd.type === 'undoStrike') {
        if (!s.strikes || (s.phase !== 'GUESSING' && s.phase !== 'STEAL')) break;
        const cancelSteal = s.phase === 'STEAL' && s.strikes === 3;
        next = { ...s, strikes: s.strikes - 1, ...(cancelSteal ? { phase: 'GUESSING', stealTeam: null } : {}) };
      } else {
        next = { ...previous, matchStarted: s.matchStarted || previous.matchStarted, muted: s.muted };
        history = history.slice(0, -1);
        undoable = false;
      }
      break;
    }
    case 'restart':
      if (s.phase !== 'GAME_OVER') break;
      next = { ...createInitialGameState(), roomId: s.roomId, muted: s.muted, teamA: { ...s.teamA, score: 0 }, teamB: { ...s.teamB, score: 0 } };
      history = [];
      undoable = false;
      cue = 'round';
      break;
  }
  if (next === s) return match;
  const id = s.actionId + 1;
  const leadChanged = leader(next) !== 0 && leader(next) !== leader(s);
  if (undoable) history = [...history.slice(-29), s];
  return {
    customQuestions, history,
    state: { ...next, actionId: id, lastUpdated: now, showEvent: cue || leadChanged ? { id, at: now, cue: cue ?? 'lead', index, beneficiary, leadChanged } : undefined },
  };
}
