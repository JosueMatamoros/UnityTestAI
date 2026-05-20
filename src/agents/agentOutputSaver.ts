import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export function saveAgentOutput(
  agentName: string,
  output: unknown
): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) return null;

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const outputDir = path.join(workspaceRoot, "AgentOutputs", agentName);

  fs.mkdirSync(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `${agentName}-output.json`);
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), "utf8");

  return filePath;
}
