import Anthropic from "npm:@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

export const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5";

/**
 * Calls Claude with a JSON-schema constrained response and returns the parsed
 * object. Uses the server-side refusal fallback so a declined request is
 * retried on another model inside the same call.
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: opts.schema },
    },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    // `fallbacks` is newer than some SDK type definitions.
  } as Parameters<typeof client.beta.messages.stream>[0]);
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("The model declined to generate this content.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The model response was cut off; try again.");
  }
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  return JSON.parse(text) as T;
}
