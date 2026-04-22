import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildContextBuilderPrompt } from "../prompts/promptBuilder";
import { readDependencyFiles } from "./codeAnalyzer";

// ── Output schema ──────────────────────────────────────────────────────────────

const dependencySliceSchema = z.object({
  filePath: z.string(),
  relevantSlice: z.string(),
});

export const contextBuilderOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("READY"),
    targetSlice: z.string(),
    dependencySlices: z.array(dependencySliceSchema),
    assembledContext: z.string(),
  }),
  z.object({
    status: z.literal("ERROR"),
    message: z.string(),
  }),
]);

export type ContextBuilderOutput = z.infer<typeof contextBuilderOutputSchema>;

// ── Input ──────────────────────────────────────────────────────────────────────

export interface ContextBuilderInput {
  codeSlice: string;
  dependencyFiles: string[];
  className: string;
  methodName: string;
  workspaceRoot: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function assembleFinalContext(
  className: string,
  methodName: string,
  targetSlice: string,
  dependencySlices: Array<{ filePath: string; relevantSlice: string }>
): string {
  const header = `// ── TARGET: ${className}.${methodName} ──────────────────────────────────────`;
  const parts = [header, targetSlice];

  for (const dep of dependencySlices) {
    parts.push(
      `// ── DEPENDENCY: ${dep.filePath} ──────────────────────────────────────`,
      dep.relevantSlice
    );
  }

  return parts.join("\n\n");
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Agent 2 — Context Builder
 *
 * Reads each dependency file identified by Agent 1, then asks the LLM to
 * slice each one down to only the members referenced by the target method.
 * Assembles the final minimal context (target slice + sliced dependencies)
 * ready for the next agent.
 *
 * Saves:
 *  - context-builder-prompt.txt   → prompt sent to LLM
 *  - context-builder-output.txt   → raw LLM response
 *  - context-builder-output.json  → parsed/validated JSON
 */
export async function runContextBuilder(
  input: ContextBuilderInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<ContextBuilderOutput> {
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "context-builder");
  fs.mkdirSync(dumpDir, { recursive: true });

  // Short-circuit when there are no dependencies
  if (input.dependencyFiles.length === 0) {
    const result: ContextBuilderOutput = {
      status: "READY",
      targetSlice: input.codeSlice,
      dependencySlices: [],
      assembledContext: input.codeSlice,
    };
    fs.writeFileSync(
      path.join(dumpDir, "context-builder-output.json"),
      JSON.stringify(result, null, 2),
      "utf8"
    );
    return result;
  }

  const { code: rawDependencyCode } = readDependencyFiles(
    input.dependencyFiles,
    input.workspaceRoot
  );

  const prompt = buildContextBuilderPrompt(
    input.methodName,
    input.className,
    input.codeSlice,
    rawDependencyCode
  );

  fs.writeFileSync(path.join(dumpDir, "context-builder-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);

  fs.writeFileSync(path.join(dumpDir, "context-builder-output.txt"), raw, "utf8");

  const clean = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);

  let parsed: ContextBuilderOutput;
  try {
    if (!jsonMatch) {
      throw new Error("No JSON object found in LLM response");
    }

    const json = JSON.parse(jsonMatch[0]);

    const llmSchema = z.object({
      status: z.literal("READY"),
      dependencySlices: z.array(dependencySliceSchema),
    });

    const { dependencySlices } = llmSchema.parse(json);

    parsed = {
      status: "READY",
      targetSlice: input.codeSlice,
      dependencySlices,
      assembledContext: assembleFinalContext(
        input.className,
        input.methodName,
        input.codeSlice,
        dependencySlices
      ),
    };
  } catch (err: any) {
    parsed = {
      status: "ERROR",
      message: `Failed to parse LLM response: ${err.message}`,
    };
  }

  fs.writeFileSync(
    path.join(dumpDir, "context-builder-output.json"),
    JSON.stringify(parsed, null, 2),
    "utf8"
  );

  return parsed;
}
