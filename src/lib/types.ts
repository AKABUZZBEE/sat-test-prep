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

export interface Layout {
  /** Display order, as indexes into the set's questions. */
  order: number[];
  /** Per question: choices[displayed position] = original choice index. */
  choices: Record<string, number[]>;
}

/** A student's attempt at a shared question set, as stored. */
export interface AttemptRow {
  id: string;
  user_id: string;
  set_id: string;
  status: 'in_progress' | 'completed';
  layout: Layout;
  answers: Record<string, Answer>;
  current_index: number;
  score: number | null;
  created_at: string;
  completed_at: string | null;
  test_sets: { questions: Question[] };
}

/** An attempt with its questions in this student's shuffled order. Answers use displayed choice positions. */
export interface Test {
  id: string;
  set_id: string;
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

/** Applies an attempt's shuffle so each student sees their own question and choice order. */
export function applyLayout(questions: Question[], layout: Layout): Question[] {
  return layout.order.map((i) => {
    const q = questions[i];
    const perm = layout.choices[q.id];
    if (!perm) return q;
    return { ...q, choices: perm.map((orig) => q.choices[orig]), correct_index: perm.indexOf(q.correct_index) };
  });
}
