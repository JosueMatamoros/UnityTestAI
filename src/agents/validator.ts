import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildContextValidatorPrompt, buildTestValidatorPrompt } from "../prompts/promptBuilder";

// ── Output schema ──────────────────────────────────────────────────────────────

export const validatorOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("VALID"),   output: z.string() }),
  z.object({ status: z.literal("FIXED"),   output: z.string(), issues: z.array(z.string()) }),
  z.object({ status: z.literal("ERROR"),   message: z.string() }),
]);

export type ValidatorOutput = z.infer<typeof validatorOutputSchema>;

// ── Shared JSON parser ─────────────────────────────────────────────────────────

// LLMs sometimes prepend a spurious '{' + newline before the actual code/context string.
// Strip it so the output is clean and starts directly with `using`, `//`, or `[`.
function stripSpuriousLeadingBrace(s: string): string {
  return s.replace(/^\{\s*\n/, "");
}

function parseValidatorResponse(
  raw: string,
  originalOutput: string,
  fixedKey: "correctedContext" | "correctedCode"
): ValidatorOutput {
  const clean = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return { status: "ERROR", message: "No JSON object found in validator response" };
  }

  try {
    const json = JSON.parse(jsonMatch[0]);

    const llmSchema = z.discriminatedUnion("status", [
      z.object({ status: z.literal("VALID") }),
      z.object({
        status: z.literal("INVALID"),
        issues: z.array(z.string()),
        [fixedKey]: z.string(),
      }),
    ]);

    const parsed = llmSchema.parse(json);

    if (parsed.status === "VALID") {
      return { status: "VALID", output: originalOutput };
    }

    const fixedOutput = stripSpuriousLeadingBrace(
      (parsed as Record<string, any>)[fixedKey] as string
    );
    return { status: "FIXED", output: fixedOutput, issues: (parsed as any).issues };
  } catch (err: any) {
    return { status: "ERROR", message: `Failed to parse validator response: ${err.message}` };
  }
}

// ── Context Validator ──────────────────────────────────────────────────────────

export interface ContextValidatorInput {
  assembledContext: string;
  className: string;
  methodName: string;
  workspaceRoot: string;
  fullContext?: boolean;
}

/**
 * Agent 2.5 — Context Validator
 *
 * Verifies that the assembled context produced by the Context Builder contains
 * everything needed to generate NUnit tests. If the LLM finds structural gaps
 * it returns a corrected context in the same call (one implicit retry).
 *
 * Saves:
 *  - validator-context-prompt.txt   → prompt sent to LLM
 *  - validator-context-output.txt   → raw LLM response
 *  - validator-context-output.json  → parsed/validated JSON
 */
export async function runContextValidator(
  input: ContextValidatorInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<ValidatorOutput> {
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "validator-context");
  fs.mkdirSync(dumpDir, { recursive: true });

  const prompt = buildContextValidatorPrompt(
    input.methodName,
    input.className,
    input.assembledContext,
    input.fullContext ?? false
  );
  fs.writeFileSync(path.join(dumpDir, "validator-context-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);
  fs.writeFileSync(path.join(dumpDir, "validator-context-output.txt"), raw, "utf8");

  const result = parseValidatorResponse(raw, input.assembledContext, "correctedContext");

  fs.writeFileSync(
    path.join(dumpDir, "validator-context-output.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );

  return result;
}

// ── Test Validator ─────────────────────────────────────────────────────────────

export interface TestValidatorInput {
  testCode: string;
  assembledContext: string;
  className: string;
  methodName: string;
  workspaceRoot: string;
}

/**
 * Agent 3.5 — Test Validator
 *
 * Verifies the generated C# NUnit test class for structural correctness and
 * branch coverage. If the LLM finds issues it returns corrected code in the
 * same call (one implicit retry).
 *
 * Saves:
 *  - validator-test-prompt.txt   → prompt sent to LLM
 *  - validator-test-output.txt   → raw LLM response
 *  - validator-test-output.json  → parsed/validated JSON
 */
export async function runTestValidator(
  input: TestValidatorInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<ValidatorOutput> {
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "validator-test");
  fs.mkdirSync(dumpDir, { recursive: true });

  const prompt = buildTestValidatorPrompt(
    input.methodName,
    input.className,
    input.assembledContext,
    input.testCode
  );
  fs.writeFileSync(path.join(dumpDir, "validator-test-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);
  fs.writeFileSync(path.join(dumpDir, "validator-test-output.txt"), raw, "utf8");

  const result = parseValidatorResponse(raw, input.testCode, "correctedCode");

  fs.writeFileSync(
    path.join(dumpDir, "validator-test-output.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );

  return result;
}
