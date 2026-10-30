import type { Question } from '../types/game';
import { QUESTION_BATCH_01 } from './questionBatch01';
import { QUESTION_BATCH_02 } from './questionBatch02';
import { QUESTION_BATCH_03 } from './questionBatch03';
import { QUESTION_BATCH_04 } from './questionBatch04';
import { QUESTION_BATCH_05 } from './questionBatch05';
import { QUESTION_BATCH_06 } from './questionBatch06';

export const QUESTION_BANK: Question[] = [
  ...QUESTION_BATCH_01,
  ...QUESTION_BATCH_02,
  ...QUESTION_BATCH_03,
  ...QUESTION_BATCH_04,
  ...QUESTION_BATCH_05,
  ...QUESTION_BATCH_06,
];
