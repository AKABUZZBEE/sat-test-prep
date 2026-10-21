export type Section = 'math' | 'reading_writing';

export interface Question {
  id: string;
  section: Section;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  passage: string;
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

export interface Answer {
  choice: number | null;
  skipped: boolean;
}

export interface Test {
  id: string;
  user_id: string;
  status: 'in_progress' | 'completed';
  questions: Question[];
  answers: Record<string, Answer>;
  current_index: number;
  score: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface StudyGuide {
  topic: string;
  summary: string;
  key_concepts: string[];
  strategies: string[];
  worked_example: { problem: string; solution: string };
  common_traps: string[];
  practice_tip: string;
}

export type Outcome = 'correct' | 'wrong' | 'skipped';

export function outcomeOf(q: Question, a: Answer | undefined): Outcome {
  if (!a || a.choice === null) return 'skipped';
  return a.choice === q.correct_index ? 'correct' : 'wrong';
}

export const SECTION_LABEL: Record<Section, string> = {
  math: 'Math',
  reading_writing: 'Reading & Writing',
};
