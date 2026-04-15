import * as fs from "fs";
import * as path from "path";
import { buildTestGeneratorPrompt } from "../prompts/promptBuilder";
import type { CodeAnalyzerOutput } from "./codeAnalyzer";

// ── Input ──────────────────────────────────────────────────────────────────────

export interface TestGeneratorInput {
  code: string;
  dependencyCode: string;
  analysisResult: CodeAnalyzerOutput;
  className: string;
  methodName: string;
  workspaceRoot: string;
  model: string;
}

// ── Output ─────────────────────────────────────────────────────────────────────

export interface TestGeneratorOutput {
  status: "SUCCESS" | "ERROR";
  testCode?: string;
  savedPath?: string;
  message?: string;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Sends the test-generator prompt to the LLM and saves the resulting C# test
 * file to the Unity project's Tests/ folder.
 *
 * Saves three files per run:
 *  - test-generator-prompt.txt    → prompt sent to LLM (debugging)
 *  - test-generator-output.txt    → raw LLM response (debugging)
 *  - The actual .cs test file     → saved in <workspaceRoot>/Tests/
 */
export async function runTestGenerator(
  input: TestGeneratorInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<TestGeneratorOutput> {
  const analysisJson = JSON.stringify(input.analysisResult, null, 2);

  const prompt = buildTestGeneratorPrompt(
    input.methodName,
    input.className,
    input.code,
    input.dependencyCode,
    analysisJson
  );

  // ── Save the prompt being sent (debugging) ────────────────────────────────
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "test-generator");
  fs.mkdirSync(dumpDir, { recursive: true });
  fs.writeFileSync(path.join(dumpDir, "test-generator-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);

  // ── Save raw LLM response (txt) ──────────────────────────────────────────
  fs.writeFileSync(path.join(dumpDir, "test-generator-output.txt"), raw, "utf8");

  // ── Clean the response ───────────────────────────────────────────────────
  let cleanCode = raw.trim().replace(/^```(csharp|cs)?\s*/i, "").replace(/```$/, "").trim();

  // Check if the LLM returned an error JSON instead of code
  if (cleanCode.startsWith("{")) {
    try {
      const json = JSON.parse(cleanCode);
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

  // ── Save test file to Tests/ folder ──────────────────────────────────────
  const testFileName = `UTIA_${input.model}_${input.className}_${input.methodName}`;
  const testsDir = path.join(input.workspaceRoot, "Tests");

  if (!fs.existsSync(testsDir)) {
    return {
      status: "ERROR",
      message: "Tests/ folder does not exist in the workspace. Create it with a .asmdef first.",
    };
  }

  // Replace the test class name in the generated code
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
