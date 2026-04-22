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
 * Builds the full test-generation prompt (basePrompt.txt).
 */
export function buildPrompt(
  methodName: string,
  className: string,
  code: string,
  projectTree: string
): string {
  return replacePlaceholders(loadTemplate("basePrompt.txt"), {
    "<method-name>": methodName,
    "<class-name>":  className,
    "{code}":        code,
    "${projectTree}": projectTree || "(Project structure not available)",
  });
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
 * Transforms raw code + resolved dependencies into a structured representation.
 */
export function buildCodeAnalyzerPrompt(
  methodName: string,
  className: string,
  code: string,
  dependencyCode: string
): string {
  return replacePlaceholders(loadTemplate("codeAnalyzerPrompt.txt"), {
    "<method-name>":   methodName,
    "<class-name>":    className,
    "{code}":          code,
    "{dependencyCode}": dependencyCode || "(No dependencies required)",
  });
}

/**
 * Builds the test-generator prompt (testGeneratorPrompt.txt).
 * Agent 3: generates PlayMode NUnit tests from the fully assembled context.
 */
export function buildTestGeneratorPrompt(
  methodName: string,
  className: string,
  assembledContext: string
): string {
  return replacePlaceholders(loadTemplate("testGeneratorPrompt.txt"), {
    "<method-name>":      methodName,
    "<class-name>":       className,
    "{assembledContext}": assembledContext,
  });
}

