import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildDependencyResolverPrompt } from "../prompts/promptBuilder";
import { JsonSanitizer } from "../utils/jsonSanitizer";

// ── Output schema ──────────────────────────────────────────────────────────────

export const dependencyOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("READY"),
    codeSlice: z.string(),
  }),
  z.object({
    status: z.literal("MISSING_DEPENDENCIES"),
    files: z.array(z.string()),
    codeSlice: z.string(),
  }),
  z.object({
    status: z.literal("ERROR"),
    message: z.string(),
  }),
]);

export type DependencyResolverOutput = z.infer<typeof dependencyOutputSchema>;

// ── Input ──────────────────────────────────────────────────────────────────────

export interface DependencyResolverInput {
  codeSlice: string;
  projectTree: string;
  className: string;
  methodName: string;
  workspaceRoot: string;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Agent 1 — Dependency Resolver
 *
 * Receives the code slice from Agent 0 and the project tree.
 * Identifies external project files needed to understand the target method.
 * Echoes back the codeSlice for traceability.
 */
export async function runDependencyResolver(
  input: DependencyResolverInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<DependencyResolverOutput> {
  const prompt = buildDependencyResolverPrompt(
    input.methodName,
    input.className,
    input.codeSlice,
    input.projectTree
  );

  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "dependency-resolver");
  fs.mkdirSync(dumpDir, { recursive: true });
  fs.writeFileSync(path.join(dumpDir, "dependency-resolver-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);

  fs.writeFileSync(path.join(dumpDir, "dependency-resolver-output.txt"), raw, "utf8");

  const clean = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);

  let parsed: DependencyResolverOutput;
  try {
    if (!jsonMatch) {
      throw new Error("No JSON object found in LLM response");
    }
    const json = JSON.parse(JsonSanitizer.sanitize(jsonMatch[0]));
    parsed = dependencyOutputSchema.parse(json);
  } catch (err: any) {
    parsed = {
      status: "ERROR",
      message: `Failed to parse LLM response as valid JSON: ${err.message}`,
    };
  }

  fs.writeFileSync(
    path.join(dumpDir, "dependency-resolver-output.json"),
    JSON.stringify(parsed, null, 2),
    "utf8"
  );

  return parsed;
}
