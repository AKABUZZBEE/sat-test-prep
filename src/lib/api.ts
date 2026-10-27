import { supabase } from './supabase';
import { applyLayout, outcomeOf, type Answer, type AttemptRow, type StudyGuide, type Test } from './types';

async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError carries the function's JSON body in `context`.
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

const ATTEMPT = '*, test_sets(questions)';

function toTest({ test_sets, layout, ...row }: AttemptRow): Test {
  return { ...row, questions: applyLayout(test_sets.questions, layout) };
}

/** The student's latest test, or null if they have never started one. */
export async function getLatestTest(): Promise<Test | null> {
  const { data, error } = await supabase
    .from('attempts')
    .select(ATTEMPT)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toTest(data as AttemptRow) : null;
}

export async function getTest(id: string): Promise<Test> {
  const { data, error } = await supabase.from('attempts').select(ATTEMPT).eq('id', id).single();
  if (error) throw error;
  return toTest(data as AttemptRow);
}

/**
 * Returns the student's current attempt. The server only starts a new one when
 * the student has none, or passes `retake` after completing their last one; the
 * new attempt uses a shared question set this student has never taken.
 */
export async function startTest(retake = false): Promise<Test> {
  const { attempt } = await invoke<{ attempt: AttemptRow }>('generate-test', { retake });
  return toTest(attempt);
}

export async function saveProgress(id: string, answers: Record<string, Answer>, currentIndex: number) {
  const { error } = await supabase
    .from('attempts')
    .update({ answers, current_index: currentIndex })
    .eq('id', id);
  if (error) throw error;
}

export async function finishTest(test: Test, answers: Record<string, Answer>): Promise<Test> {
  const score = test.questions.filter((q) => outcomeOf(q, answers[q.id]) === 'correct').length;
  const { data, error } = await supabase
    .from('attempts')
    .update({ answers, status: 'completed', score, completed_at: new Date().toISOString() })
    .eq('id', test.id)
    .select(ATTEMPT)
    .single();
  if (error) throw error;
  return toTest(data as AttemptRow);
}

export async function getStudyGuide(testId: string, topic: string): Promise<StudyGuide> {
  const { guide } = await invoke<{ guide: StudyGuide }>('study-guide', { test_id: testId, topic });
  return guide;
}
