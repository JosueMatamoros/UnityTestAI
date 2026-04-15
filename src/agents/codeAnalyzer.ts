import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { buildCodeAnalyzerPrompt } from "../prompts/promptBuilder";

// ── Output schema ──────────────────────────────────────────────────────────────

const methodInputSchema = z.object({
  name: z.string(),
  type: z.string(),
});

const dependencySchema = z.object({
  name: z.string(),
  type: z.enum(["class", "struct", "enum", "external"]),
  membersUsed: z.array(z.string()),
});

const decisionRowSchema = z.object({
  conditions: z.array(z.string()),
  branch: z.string(),
  expectedBehavior: z.string(),
});

const loopSchema = z.object({
  type: z.string(),
  condition: z.string(),
});

export const codeAnalyzerOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("READY"),
    methodSummary: z.object({
      name: z.string(),
      inputs: z.array(methodInputSchema),
      output: z.string(),
    }),
    dependencies: z.array(dependencySchema),
    decisionTable: z.array(decisionRowSchema),
    loops: z.array(loopSchema),
    sideEffects: z.array(z.string()),
  }),
  z.object({
    status: z.literal("ERROR"),
    message: z.string(),
  }),
]);

export type CodeAnalyzerOutput = z.infer<typeof codeAnalyzerOutputSchema>;

// ── Input ──────────────────────────────────────────────────────────────────────

export interface CodeAnalyzerInput {
  code: string;
  dependencyCode: string;
  className: string;
  methodName: string;
  workspaceRoot: string;
}

// ── Dependency file reader ─────────────────────────────────────────────────────

export interface DependencyFileResult {
  path: string;
  found: boolean;
}

export interface ReadDependencyResult {
  code: string;
  files: DependencyFileResult[];
}

/**
 * Reads dependency files resolved by Agent 1 and concatenates their contents.
 * Returns both the combined code and the resolution status of each file.
 * Handles both cases: workspaceRoot pointing to the project root (with Assets/
 * as subfolder) or directly to the Assets folder.
 */
export function readDependencyFiles(
  filePaths: string[],
  workspaceRoot: string
): ReadDependencyResult {
  let combined = "";
  const files: DependencyFileResult[] = [];

  for (const file of filePaths) {
    const directPath = path.join(workspaceRoot, file);
    const withoutAssets = file.replace(/^Assets\//, "");
    const strippedPath = path.join(workspaceRoot, withoutAssets);

    let resolvedPath: string | null = null;
    if (fs.existsSync(directPath)) {
      resolvedPath = directPath;
    } else if (fs.existsSync(strippedPath)) {
      resolvedPath = strippedPath;
    }

    if (resolvedPath) {
      const content = fs.readFileSync(resolvedPath, "utf8");
      combined += `\n\n// File: ${file}\n${content}`;
      files.push({ path: file, found: true });
    } else {
      console.warn(`Dependency file not found: ${file} (tried ${directPath} and ${strippedPath})`);
      files.push({ path: file, found: false });
    }
  }

  return { code: combined, files };
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Sends the code-analyzer prompt to the LLM and parses the strict JSON
 * response into a structured representation of the target method.
 *
 * Saves three files per run:
 *  - code-analyzer-prompt.txt    → prompt sent to LLM (debugging)
 *  - code-analyzer-output.txt    → raw LLM response (debugging)
 *  - code-analyzer-output.json   → parsed/validated JSON (for the next agent)
 */
export async function runCodeAnalyzer(
  input: CodeAnalyzerInput,
  llmHandler: (prompt: string) => Promise<string>
): Promise<CodeAnalyzerOutput> {
  const prompt = buildCodeAnalyzerPrompt(
    input.methodName,
    input.className,
    input.code,
    input.dependencyCode
  );

  // ── Save the prompt being sent (debugging) ────────────────────────────────
  const dumpDir = path.join(input.workspaceRoot, "AgentOutputs", "code-analyzer");
  fs.mkdirSync(dumpDir, { recursive: true });
  fs.writeFileSync(path.join(dumpDir, "code-analyzer-prompt.txt"), prompt, "utf8");

  const raw = await llmHandler(prompt);

  // ── Save raw LLM response (txt) ──────────────────────────────────────────
  fs.writeFileSync(path.join(dumpDir, "code-analyzer-output.txt"), raw, "utf8");

  // ── Parse JSON from response ─────────────────────────────────────────────
  const clean = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);

  let parsed: CodeAnalyzerOutput;
  try {
    if (!jsonMatch) {
      throw new Error("No JSON object found in LLM response");
    }
    const json = JSON.parse(jsonMatch[0]);
    parsed = codeAnalyzerOutputSchema.parse(json);
  } catch (err: any) {
    parsed = {
      status: "ERROR",
      message: `Failed to parse LLM response as valid JSON: ${err.message}`,
    };
  }

  // ── Save validated JSON (for the next agent) ─────────────────────────────
  fs.writeFileSync(
    path.join(dumpDir, "code-analyzer-output.json"),
    JSON.stringify(parsed, null, 2),
    "utf8"
  );

  return parsed;
}
