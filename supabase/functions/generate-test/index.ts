// Returns the student's current test set. A new set is generated only when
// the student has none yet, or has completed their last one and asks to retake.
import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, getUserId } from "../_shared/supabase.ts";
import { generateJson } from "../_shared/claude.ts";
import type { Question, Section } from "../_shared/types.ts";

const QUESTIONS_PER_SECTION = Number(Deno.env.get("QUESTIONS_PER_SECTION") ?? "10");

const SYSTEM = `You write original practice questions for the digital SAT.
Match the style, difficulty spread and content domains of the real exam.
Every question has exactly four answer choices and exactly one correct answer.
Double-check each math answer by solving it before writing it down.
Explanations are 2-4 sentences, aimed at a high-school student, and say why the
correct choice is right and what trap the most tempting wrong choice sets.`;

const SECTION_BRIEF: Record<Section, string> = {
  math: `Math section. Spread questions across these topics: Algebra (linear equations,
systems, inequalities), Advanced Math (quadratics, exponentials, polynomials,
nonlinear functions), Problem-Solving and Data Analysis (ratios, percentages,
statistics, probability), Geometry and Trigonometry. Leave "passage" empty
unless a table or short scenario is needed. Write math in plain text (x^2, sqrt(3)).`,
  reading_writing: `Reading and Writing section. Spread questions across these topics:
Craft and Structure (words in context, text structure and purpose),
Information and Ideas (central ideas, command of evidence, inferences),
Standard English Conventions (boundaries, form, structure and sense),
Expression of Ideas (transitions, rhetorical synthesis). Each question has a
short passage (25-150 words) in "passage".`,
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "difficulty", "passage", "prompt", "choices", "correct_index", "explanation"],
        properties: {
          topic: { type: "string", description: "Short skill name, e.g. 'Linear equations'" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          passage: { type: "string" },
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer", description: "0-based index into choices" },
          explanation: { type: "string" },
        },
      },
    },
  },
};

type Generated = Omit<Question, "id" | "section">;

async function generateSection(section: Section): Promise<Question[]> {
  const { questions } = await generateJson<{ questions: Generated[] }>({
    system: SYSTEM,
    prompt: `${SECTION_BRIEF[section]}\n\nWrite ${QUESTIONS_PER_SECTION} questions, ordered easy to hard.`,
    schema: SCHEMA,
  });
  return questions
    .filter((q) => q.choices.length === 4 && q.correct_index >= 0 && q.correct_index < 4)
    .map((q) => ({ ...q, id: crypto.randomUUID(), section }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const { retake = false } = await req.json().catch(() => ({}));

  const { data: latest, error } = await admin
    .from("tests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);

  // Stored set wins until the student finishes it and explicitly retakes.
  if (latest && (latest.status === "in_progress" || !retake)) {
    return json({ test: latest, created: false });
  }

  try {
    const [math, rw] = await Promise.all([
      generateSection("math"),
      generateSection("reading_writing"),
    ]);
    const { data: test, error: insertError } = await admin
      .from("tests")
      .insert({ user_id: userId, questions: [...rw, ...math] })
      .select("*")
      .single();
    if (insertError) {
      // Unique index hit: another request created the in-progress test first.
      if (insertError.code === "23505") {
        const { data: current } = await admin
          .from("tests").select("*").eq("user_id", userId).eq("status", "in_progress").single();
        return json({ test: current, created: false });
      }
      return json({ error: insertError.message }, 500);
    }
    return json({ test, created: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
