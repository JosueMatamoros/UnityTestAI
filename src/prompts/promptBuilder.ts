import * as fs from 'fs';
import * as path from 'path';

const PROMPTS_DIR = path.join(__dirname, "..", "prompts");

function loadTemplate(fileName: string): string {
  const filePath = path.join(PROMPTS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePlaceholders(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(escapeRegex(key), "g"), value ?? ""),
    template
  );
}

/**
 * Builds the method-slicer prompt (methodSlicerPrompt.txt).
 * Agent 0: extracts a minimal code slice from the full source file.
 */
export function buildMethodSlicerPrompt(
  methodName: string,
  className: string,
  code: string
): string {
  return replacePlaceholders(loadTemplate("methodSlicerPrompt.txt"), {
    "<method-name>": methodName,
    "<class-name>":  className,
    "{code}":        code,
  });
}

/**
 * Builds the dependency-resolver prompt (dependencyResolverPrompt.txt).
 * Agent 1: receives the code slice and identifies missing external files.
 */
export function buildDependencyResolverPrompt(
  methodName: string,
  className: string,
  codeSlice: string,
  projectTree: string
): string {
  return replacePlaceholders(loadTemplate("dependencyResolverPrompt.txt"), {
    "<method-name>": methodName,
    "<class-name>":  className,
    "{code}":        codeSlice,
    "${projectTree}": projectTree || "(Project structure not available)",
  });
}

/**
 * Builds the context-builder prompt (contextBuilderPrompt.txt).
 * Agent 2: slices each dependency down to only the members the target method uses.
 */
export function buildContextBuilderPrompt(
  methodName: string,
  className: string,
  targetSlice: string,
  dependencyFiles: string
): string {
  return replacePlaceholders(loadTemplate("contextBuilderPrompt.txt"), {
    "<method-name>":    methodName,
    "<class-name>":     className,
    "{targetSlice}":    targetSlice,
    "{dependencyFiles}": dependencyFiles || "(No dependencies)",
  });
}

/**
 * Builds the code-analyzer prompt (codeAnalyzerPrompt.txt).
 * Agent 2.7: produces a decision table and branch analysis from the assembled context.
 */
export function buildCodeAnalyzerPrompt(
  methodName: string,
  className: string,
  assembledContext: string
): string {
  return replacePlaceholders(loadTemplate("codeAnalyzerPrompt.txt"), {
    "<method-name>":      methodName,
    "<class-name>":       className,
    "{assembledContext}": assembledContext,
  });
}

/**
 * Builds the context-validator prompt (contextValidatorPrompt.txt).
 * Agent 2.5: verifies the assembled context has everything needed for test generation.
 */
export function buildContextValidatorPrompt(
  methodName: string,
  className: string,
  assembledContext: string,
  fullContext: boolean = false
): string {
  const fullContextNote = fullContext
    ? `\nCONTEXT FORMAT — IMPORTANT:
The context is organized into sections with \`// ── TARGET: ... ──\` and \`// ── DEPENDENCY: <file> ──\` headers. Each DEPENDENCY section may contain EITHER:
  (a) a minimal slice with only the members referenced by the target method, OR
  (b) the COMPLETE source of the dependency file (full-context mode).
Both forms are VALID. When a section contains a full file, treat the extra members as normal — this is NOT a problem and you must NOT trim, shorten, or "optimize" it. Your job is only to confirm completeness, never to reduce.\n`
    : "";

  return replacePlaceholders(loadTemplate("contextValidatorPrompt.txt"), {
    "<method-name>":      methodName,
    "<class-name>":       className,
    "{assembledContext}": assembledContext,
    "{fullContextNote}":  fullContextNote,
  });
}

/**
 * Builds the test-generator prompt (testGeneratorPrompt.txt).
 * Agent 3: generates PlayMode NUnit tests from the assembled context.
 * Optionally injects a pre-computed code analysis block.
 */
export function buildTestGeneratorPrompt(
  methodName: string,
  className: string,
  assembledContext: string,
  codeAnalysis?: string
): string {
  const analysisBlock = codeAnalysis
    ? `━━ PRE-COMPUTED CODE ANALYSIS (Agent 2.7) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nVerify this analysis against the context. If correct, use it directly for STEP 0 and STEP 1.\n\n${codeAnalysis}\n\n`
    : "";

  return replacePlaceholders(loadTemplate("testGeneratorPrompt.txt"), {
    "<method-name>":      methodName,
    "<class-name>":       className,
    "{assembledContext}": assembledContext,
    "{codeAnalysis}":     analysisBlock,
  });
}

/**
 * Builds the test-validator prompt (testValidatorPrompt.txt).
 * Agent 3.5: verifies the generated C# NUnit test class for structure and coverage.
 */
export function buildTestValidatorPrompt(
  methodName: string,
  className: string,
  assembledContext: string,
  testCode: string
): string {
  return replacePlaceholders(loadTemplate("testValidatorPrompt.txt"), {
    "<method-name>":      methodName,
    "<class-name>":       className,
    "{assembledContext}": assembledContext,
    "{testCode}":         testCode,
  });
}

/**
 * Builds the chat-fixer prompt (chatFixerPrompt.txt).
 * Chat Fixer: fixes errors in generated tests or answers questions, given full test + context.
 */
export function buildChatFixerPrompt(
  methodName: string,
  className: string,
  assembledContext: string,
  testCode: string,
  userMessage: string
): string {
  return replacePlaceholders(loadTemplate("chatFixerPrompt.txt"), {
    "<method-name>":      methodName,
    "<class-name>":       className,
    "{assembledContext}": assembledContext,
    "{testCode}":         testCode,
    "{userMessage}":      userMessage,
  });
}
