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

function replacePlaceholders(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(key, value ?? ""),
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
 * Builds the dependency-resolver prompt (dependencyResolverPrompt.txt).
 * Lightweight prompt focused only on identifying missing class definitions.
 */
export function buildDependencyResolverPrompt(
  methodName: string,
  className: string,
  code: string,
  projectTree: string
): string {
  return replacePlaceholders(loadTemplate("dependencyResolverPrompt.txt"), {
    "<method-name>": methodName,
    "<class-name>":  className,
    "{code}":        code,
    "${projectTree}": projectTree || "(Project structure not available)",
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
 * Generates the final C# test class from structured analysis + source code.
 */
export function buildTestGeneratorPrompt(
  methodName: string,
  className: string,
  code: string,
  dependencyCode: string,
  analysisJson: string
): string {
  return replacePlaceholders(loadTemplate("testGeneratorPrompt.txt"), {
    "<method-name>":    methodName,
    "<class-name>":     className,
    "{code}":           code,
    "{dependencyCode}": dependencyCode || "(No dependencies required)",
    "{analysisJson}":   analysisJson,
  });
}

