// Returns the student's current attempt. A new attempt is started only when the
// student has none yet, or has completed their last one and asks to retake.
// Attempts draw from a shared pool of question sets; a student never gets the
// same set twice, and Claude is only called when the pool runs low for them.
import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, getUserId } from "../_shared/supabase.ts";
import { generateJson } from "../_shared/claude.ts";
import type { Layout, Question, Section } from "../_shared/types.ts";

const QUESTIONS_PER_SECTION = Number(Deno.env.get("QUESTIONS_PER_SECTION") ?? "10");
// Generate a fresh set whenever a student has fewer unseen sets than this, so
// students keep drawing from a varied pool and the pool grows with the heaviest users.
const MIN_UNSEEN_SETS = Number(Deno.env.get("MIN_UNSEEN_SETS") ?? "10");

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

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffles questions within each section (sections keep their order) and each question's choices. */
function makeLayout(questions: Question[]): Layout {
  const order: number[] = [];
  for (const section of ["reading_writing", "math"] as Section[]) {
    const idx = questions.flatMap((q, i) => (q.section === section ? [i] : []));
    order.push(...shuffled(idx.length).map((k) => idx[k]));
  }
  const choices: Record<string, number[]> = {};
  for (const q of questions) choices[q.id] = shuffled(q.choices.length);
  return { order, choices };
}

async function generateSet(): Promise<{ id: string; questions: Question[] }> {
  const [math, rw] = await Promise.all([
    generateSection("math"),
    generateSection("reading_writing"),
  ]);
  const { data, error } = await admin
    .from("test_sets")
    .insert({ questions: [...rw, ...math] })
    .select("id, questions")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

const withQuestions = "*, test_sets(questions)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const { retake = false } = await req.json().catch(() => ({}));

  const { data: latest, error } = await admin
    .from("attempts")
    .select(withQuestions)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);

  // The current attempt wins until the student finishes it and explicitly retakes.
  if (latest && (latest.status === "in_progress" || !retake)) {
    return json({ attempt: latest, created: false });
  }

  try {
    const { data: setId, error: pickError } = await admin.rpc("pick_unseen_set", {
      p_user: userId,
      p_min_unseen: MIN_UNSEEN_SETS,
    });
    if (pickError) throw new Error(pickError.message);

    let set: { id: string; questions: Question[] };
    if (setId) {
      const { data, error: setError } = await admin
        .from("test_sets").select("id, questions").eq("id", setId).single();
      if (setError) throw new Error(setError.message);
      set = data;
    } else {
      set = await generateSet();
    }

    const { data: attempt, error: insertError } = await admin
      .from("attempts")
      .insert({ user_id: userId, set_id: set.id, layout: makeLayout(set.questions) })
      .select(withQuestions)
      .single();
    if (insertError) {
      // Unique index hit: another request started an attempt for this student first.
      if (insertError.code === "23505") {
        const { data: current } = await admin
          .from("attempts").select(withQuestions)
          .eq("user_id", userId).eq("status", "in_progress").single();
        return json({ attempt: current, created: false });
      }
      return json({ error: insertError.message }, 500);
    }
    return json({ attempt, created: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
