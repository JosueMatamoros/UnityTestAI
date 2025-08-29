import * as fs from 'fs';
import * as path from 'path';

export function buildPrompt(methodName: string, className: string, code: string): string {
    const promptPath = path.join(__dirname, "..", "prompts", "basePrompt.txt");
    let prompt = fs.readFileSync(promptPath, "utf8");

    prompt = prompt.replace("<method-name>", methodName);
    prompt = prompt.replace("<class-name>", className);
    prompt = prompt.replace("{code}", code);

  return prompt;
}