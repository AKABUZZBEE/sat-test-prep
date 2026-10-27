export type Section = "math" | "reading_writing";

export interface Question {
  id: string;
  section: Section;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
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
