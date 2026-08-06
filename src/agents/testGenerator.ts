import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildTestGeneratorPrompt } from "../prompts/promptBuilder";
import { JsonSanitizer } from "../utils/jsonSanitizer";

// ── Output schema ──────────────────────────────────────────────────────────────

export const testGeneratorOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("SUCCESS"),
    testCode: z.string(),
    savedPath: z.string(),
  }),
  z.object({
    status: z.literal("ERROR"),
    message: z.string(),
  }),
]);

export type TestGeneratorOutput = z.infer<typeof testGeneratorOutputSchema>;

// ── Input ──────────────────────────────────────────────────────────────────────

export interface TestGeneratorInput {
  assembledContext: string;
  codeAnalysis?: string;
  className: string;
  methodName: string;
  workspaceRoot: string;
  model: string;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Agent 3 — Test Generator
 *
 * Receives the fully assembled context from the Context Builder and generates
 * a complete PlayMode NUnit test class with the minimum tests needed for
 * 100% decision coverage.
 *
 * Saves:
 *  - test-generator-prompt.txt    → prompt sent to LLM
 *  - test-generator-output.txt    → raw LLM response
 *  - test-generator-output.cs     → cleaned C# test code
 *  - <workspaceRoot>/Tests/       → final test file saved to Unity project
 */
export async function runTestGenerator(
  input: TestGeneratorInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<TestGeneratorOutput> {
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "test-generator");
  fs.mkdirSync(dumpDir, { recursive: true });

  const prompt = buildTestGeneratorPrompt(
    input.methodName,
    input.className,
    input.assembledContext,
    input.codeAnalysis
  );

  fs.writeFileSync(path.join(dumpDir, "test-generator-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);

  fs.writeFileSync(path.join(dumpDir, "test-generator-output.txt"), raw, "utf8");

  let cleanCode = raw.trim().replace(/^```(csharp|cs)?\s*/i, "").replace(/```$/, "").trim();

  // LLM returned an error JSON instead of code
  if (cleanCode.startsWith("{")) {
    try {
      const json = JSON.parse(JsonSanitizer.sanitize(cleanCode));
      if (json.status === "GENERATION_FAILED" || json.status === "INVALID_INPUT") {
        return {
          status: "ERROR",
          message: json.issues?.join("; ") || "Test generation failed",
        };
      }
    } catch {
      // Not JSON — treat as code
    }
  }

  // ── Save to Tests/ folder ────────────────────────────────────────────────
  const testsDir = path.join(input.workspaceRoot, "Tests");
  if (!fs.existsSync(testsDir)) {
    return {
      status: "ERROR",
      message: "Tests/ folder does not exist in the workspace. Create it with a .asmdef first.",
    };
  }

  const testFileName = `UTIA_${input.model}_${input.className}_${input.methodName}`;

  cleanCode = cleanCode.replace(
    /public\s+class\s+\w+/,
    `public class ${testFileName}`
  );

  const testFilePath = path.join(testsDir, `${testFileName}.cs`);
  fs.writeFileSync(testFilePath, cleanCode, "utf8");

  return {
    status: "SUCCESS",
    testCode: cleanCode,
    savedPath: testFilePath,
  };
}
