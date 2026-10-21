import { supabase } from './supabase';
import { outcomeOf, type Answer, type StudyGuide, type Test } from './types';

async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError carries the function's JSON body in `context`.
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

/** The student's latest test, or null if they have never started one. */
export async function getLatestTest(): Promise<Test | null> {
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Test | null;
}

export async function getTest(id: string): Promise<Test> {
  const { data, error } = await supabase.from('tests').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Test;
}

/**
 * Returns the stored test set. The server only generates a new set when the
 * student has none, or passes `retake` after completing their last one.
 */
export async function startTest(retake = false): Promise<Test> {
  const { test } = await invoke<{ test: Test }>('generate-test', { retake });
  return test;
}

export async function saveProgress(id: string, answers: Record<string, Answer>, currentIndex: number) {
  const { error } = await supabase
    .from('tests')
    .update({ answers, current_index: currentIndex })
    .eq('id', id);
  if (error) throw error;
}

export async function finishTest(test: Test, answers: Record<string, Answer>): Promise<Test> {
  const score = test.questions.filter((q) => outcomeOf(q, answers[q.id]) === 'correct').length;
  const { data, error } = await supabase
    .from('tests')
    .update({ answers, status: 'completed', score, completed_at: new Date().toISOString() })
    .eq('id', test.id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Test;
}

export async function getStudyGuide(testId: string, topic: string): Promise<StudyGuide> {
  const { guide } = await invoke<{ guide: StudyGuide }>('study-guide', { test_id: testId, topic });
  return guide;
}
