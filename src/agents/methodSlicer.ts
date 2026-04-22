import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildMethodSlicerPrompt } from "../prompts/promptBuilder";

// ── Output schema ──────────────────────────────────────────────────────────────

export const methodSlicerOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("READY"),
    codeSlice: z.array(z.string()),
  }),
  z.object({
    status: z.literal("ERROR"),
    message: z.string(),
  }),
]);

export type MethodSlicerOutput = z.infer<typeof methodSlicerOutputSchema>;

// ── Input ──────────────────────────────────────────────────────────────────────

export interface MethodSlicerInput {
  code: string;
  className: string;
  methodName: string;
  workspaceRoot: string;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Agent 0 — Method Slicer
 *
 * Receives the full source file and extracts a minimal code slice
 * containing only the target method and its directly referenced members.
 *
 * Saves:
 *  - method-slicer-prompt.txt    → prompt sent to LLM
 *  - method-slicer-output.txt    → raw LLM response
 *  - method-slicer-output.json   → parsed/validated JSON
 */
export async function runMethodSlicer(
  input: MethodSlicerInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<MethodSlicerOutput> {
  const prompt = buildMethodSlicerPrompt(
    input.methodName,
    input.className,
    input.code
  );

  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "method-slicer");
  fs.mkdirSync(dumpDir, { recursive: true });
  fs.writeFileSync(path.join(dumpDir, "method-slicer-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);

  fs.writeFileSync(path.join(dumpDir, "method-slicer-output.txt"), raw, "utf8");

  const clean = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);

  let parsed: MethodSlicerOutput;
  try {
    if (!jsonMatch) {
      throw new Error("No JSON object found in LLM response");
    }
    const json = JSON.parse(jsonMatch[0]);
    parsed = methodSlicerOutputSchema.parse(json);
  } catch (err: any) {
    parsed = {
      status: "ERROR",
      message: `Failed to parse LLM response as valid JSON: ${err.message}`,
    };
  }

  fs.writeFileSync(
    path.join(dumpDir, "method-slicer-output.json"),
    JSON.stringify(parsed, null, 2),
    "utf8"
  );

  return parsed;
}
