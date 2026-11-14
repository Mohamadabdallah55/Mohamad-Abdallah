import type { Question } from '../types/game';
import { INITIAL_QUESTIONS } from './questions';
import { JORDANIAN_QUESTIONS } from './jordanianQuestions';

export const QUESTION_BANK: Question[] = [...INITIAL_QUESTIONS, ...JORDANIAN_QUESTIONS];

