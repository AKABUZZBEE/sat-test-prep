// Builds (once) and returns a one-page study guide for a topic on a question set.
// Guides are shared: every student who misses that topic on that set reads the same one.
import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, getUserId } from "../_shared/supabase.ts";
import { generateJson } from "../_shared/claude.ts";
import type { Question } from "../_shared/types.ts";

const SYSTEM = `You are an SAT tutor writing a one-page study guide for a single skill.
Keep it tight enough to fit on one printed page. Write for a high-school student,
use plain text (no markdown symbols), and ground the advice in the questions
listed, which come from the test the student just took.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "summary", "key_concepts", "strategies", "worked_example", "common_traps", "practice_tip"],
  properties: {
    topic: { type: "string" },
    summary: { type: "string", description: "2-3 sentences on what this skill tests" },
    key_concepts: { type: "array", items: { type: "string" }, description: "3-6 rules or formulas" },
    strategies: { type: "array", items: { type: "string" }, description: "3-5 step-by-step tactics" },
    worked_example: {
      type: "object",
      additionalProperties: false,
      required: ["problem", "solution"],
      properties: { problem: { type: "string" }, solution: { type: "string" } },
    },
    common_traps: { type: "array", items: { type: "string" }, description: "2-4 traps" },
    practice_tip: { type: "string" },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const { test_id, topic } = await req.json().catch(() => ({}));
  if (!test_id || !topic) return json({ error: "test_id and topic are required" }, 400);

  const { data: attempt, error } = await admin
    .from("attempts").select("set_id, status, test_sets(questions)")
    .eq("id", test_id).eq("user_id", userId).single();
  if (error || !attempt) return json({ error: "Test not found" }, 404);
  if (attempt.status !== "completed") return json({ error: "Finish the test first" }, 409);

  const { data: cached } = await admin
    .from("set_study_guides").select("guide")
    .eq("set_id", attempt.set_id).eq("topic", topic)
    .maybeSingle();
  if (cached) return json({ guide: cached.guide });

  const questions = (attempt.test_sets as unknown as { questions: Question[] }).questions
    .filter((q) => q.topic === topic);
  if (questions.length === 0) return json({ error: "That topic is not on this test" }, 404);

  const examples = questions.map((q, i) =>
    `${i + 1}. ${q.passage ? `Passage: ${q.passage}\n` : ""}Question: ${q.prompt}
Correct answer: "${q.choices[q.correct_index]}". Why: ${q.explanation}`
  ).join("\n\n");

  try {
    const guide = await generateJson({
      system: SYSTEM,
      prompt: `Skill: ${topic}\n\nQuestions on this skill from the test:\n\n${examples}`,
      schema: SCHEMA,
      maxTokens: 16000,
    });
    await admin.from("set_study_guides").upsert(
      { set_id: attempt.set_id, topic, guide },
      { onConflict: "set_id,topic", ignoreDuplicates: true },
    );
    return json({ guide });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
