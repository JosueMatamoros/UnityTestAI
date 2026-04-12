import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildDependencyResolverPrompt } from "../prompts/promptBuilder";

// ── Output schema ──────────────────────────────────────────────────────────────

export const dependencyOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("READY") }),
  z.object({
    status: z.literal("MISSING_DEPENDENCIES"),
    files: z.array(z.string()),
  }),
  z.object({
    status: z.literal("ERROR"),
    message: z.string(),
  }),
]);

export type DependencyResolverOutput = z.infer<typeof dependencyOutputSchema>;

// ── Input ──────────────────────────────────────────────────────────────────────

export interface DependencyResolverInput {
  code: string;
  projectTree: string;
  className: string;
  methodName: string;
  workspaceRoot: string;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Sends the dependency-resolver prompt to the LLM and parses the strict JSON
 * response to determine whether external class definitions are needed.
 *
 * Saves two files per run:
 *  - dependency-resolver-output.txt  → raw LLM response (for debugging)
 *  - dependency-resolver-output.json → parsed/validated JSON (for the next agent)
 */
export async function runDependencyResolver(
  input: DependencyResolverInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<DependencyResolverOutput> {
  const prompt = buildDependencyResolverPrompt(
    input.methodName,
    input.className,
    input.code,
    input.projectTree
  );

  // ── Save the prompt being sent (for debugging) ─────────────────────────────
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "dependency-resolver");
  fs.mkdirSync(dumpDir, { recursive: true });
  fs.writeFileSync(path.join(dumpDir, "dependency-resolver-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);

  // ── Save raw LLM response (txt) ────────────────────────────────────────────
  fs.writeFileSync(path.join(dumpDir, "dependency-resolver-output.txt"), raw, "utf8");

  // ── Parse JSON from response ───────────────────────────────────────────────
  // Strip markdown fences if the LLM wrapped the JSON in ```json ... ```
  const clean = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();

  let parsed: DependencyResolverOutput;
  try {
    const json = JSON.parse(clean);
    parsed = dependencyOutputSchema.parse(json);
  } catch (err: any) {
    parsed = {
      status: "ERROR",
      message: `Failed to parse LLM response as valid JSON: ${err.message}`,
    };
  }

  // ── Save validated JSON (for the next agent) ──────────────────────────────
  fs.writeFileSync(
    path.join(dumpDir, "dependency-resolver-output.json"),
    JSON.stringify(parsed, null, 2),
    "utf8"
  );

  return parsed;
}
