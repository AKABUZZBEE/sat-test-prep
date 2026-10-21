// Builds (once) and returns a one-page study guide for each topic the student
// missed or skipped on a completed test. Guides are cached per test and topic.
import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, getUserId } from "../_shared/supabase.ts";
import { generateJson } from "../_shared/claude.ts";
import type { Answer, Question } from "../_shared/types.ts";

const SYSTEM = `You are an SAT tutor writing a one-page study guide for a single skill.
Keep it tight enough to fit on one printed page. Write for a high-school student,
use plain text (no markdown symbols), and ground the advice in the specific
mistakes listed.`;

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

function missedByTopic(questions: Question[], answers: Record<string, Answer>) {
  const byTopic = new Map<string, { q: Question; a?: Answer }[]>();
  for (const q of questions) {
    const a = answers[q.id];
    if (a?.choice === q.correct_index) continue;
    const list = byTopic.get(q.topic) ?? [];
    list.push({ q, a });
    byTopic.set(q.topic, list);
  }
  return byTopic;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const { test_id, topic } = await req.json().catch(() => ({}));
  if (!test_id || !topic) return json({ error: "test_id and topic are required" }, 400);

  const { data: cached } = await admin
    .from("study_guides").select("*")
    .eq("user_id", userId).eq("test_id", test_id).eq("topic", topic)
    .maybeSingle();
  if (cached) return json({ guide: cached.guide });

  const { data: test, error } = await admin
    .from("tests").select("*").eq("id", test_id).eq("user_id", userId).single();
  if (error || !test) return json({ error: "Test not found" }, 404);
  if (test.status !== "completed") return json({ error: "Finish the test first" }, 409);

  const missed = missedByTopic(test.questions, test.answers ?? {}).get(topic);
  if (!missed) return json({ error: "No missed questions for that topic" }, 404);

  const mistakes = missed.map(({ q, a }, i) => {
    const given = a?.choice == null ? "skipped" : `chose "${q.choices[a.choice]}"`;
    return `${i + 1}. ${q.passage ? `Passage: ${q.passage}\n` : ""}Question: ${q.prompt}
Correct answer: "${q.choices[q.correct_index]}". Student ${given}.`;
  }).join("\n\n");

  try {
    const guide = await generateJson({
      system: SYSTEM,
      prompt: `Skill: ${topic}\n\nQuestions the student missed or skipped:\n\n${mistakes}`,
      schema: SCHEMA,
      maxTokens: 16000,
    });
    await admin.from("study_guides").upsert(
      { user_id: userId, test_id, topic, guide },
      { onConflict: "test_id,topic" },
    );
    return json({ guide });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
