import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildPrompt } from "../prompts/promptBuilder";

// ── Output schema ──────────────────────────────────────────────────────────────

export const dependencyOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("READY") }),
  z.object({
    status: z.literal("MISSING_DEPENDENCIES"),
    files: z.array(z.string()),
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

// ── Trigger phrase (must match basePrompt.txt exactly) ─────────────────────────

const DEPENDENCY_TRIGGER =
  "To generate the tests successfully, I need the following class definitions:";

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Sends the base prompt to the selected LLM and determines whether external
 * class definitions are required before test generation can proceed.
 *
 * @param input       - Code, project tree, class/method names, workspace root.
 * @param llmHandler  - The selected model's call function (same as in webviewManager).
 */
export async function runDependencyResolver(
  input: DependencyResolverInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<DependencyResolverOutput> {
  const prompt = buildPrompt(
    input.methodName,
    input.className,
    input.code,
    input.projectTree
  );

  const raw = await llmHandler(prompt);

  // Save raw response — same base name as the JSON output, overwrites each run
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "dependency-resolver");
  fs.mkdirSync(dumpDir, { recursive: true });
  fs.writeFileSync(path.join(dumpDir, "dependency-resolver-output.txt"), raw, "utf8");

  // Strip markdown fences if present
  const clean = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();

  // If the LLM didn't ask for more files → everything is available
  if (!clean.includes(DEPENDENCY_TRIGGER)) {
    return { status: "READY" };
  }

  // Extract .cs file paths from the response
  const files: string[] = [];
  for (const match of clean.matchAll(/(?:Assets\/)?[^\s,]+\.cs/g)) {
    const raw = match[0];
    const normalized = raw.startsWith("Assets/") ? raw : `Assets/${raw}`;
    if (!files.includes(normalized)) {
      files.push(normalized);
    }
  }

  return { status: "MISSING_DEPENDENCIES", files };
}
