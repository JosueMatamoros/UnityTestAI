import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { collectClassAndMethod } from "../collectInputs";
import { ChatSession } from "../llm/sessionManager";
import { generateWithChatGPT, generateWithOllama, generateWithClaude } from "../llm";
import { checkSymbols } from "../utils/codeValidation";
import { saveUnityTest } from "../utils/testSaver";
import { getFilteredAssetsTree } from "../utils/getFilteredAssetsTree";
import { runMethodSlicer } from "../agents/methodSlicer";
import { runDependencyResolver } from "../agents/dependencyResolver";
import { runContextBuilder } from "../agents/contextBuilder";
import { runContextValidator, runTestValidator } from "../agents/validator";
import { runTestGenerator } from "../agents/testGenerator";
import { runCodeAnalyzer, readDependencyFiles, type DependencyFileResult, type CodeAnalyzerOutput } from "../agents/codeAnalyzer";
import { runChatFixer } from "../agents/chatFixer";
import { saveAgentOutput } from "../agents/agentOutputSaver";

// ── Per-panel state ────────────────────────────────────────────────────────────

const sessionsByPanel = new WeakMap<vscode.WebviewPanel, ChatSession>();

const generationMetaByPanel = new WeakMap<
  vscode.WebviewPanel,
  { className: string; methodName: string; model: string; subModel: string | null }
>();

type TestContext = {
  testCode: string;
  assembledContext: string;
  savedPath: string | null;
};
const testContextByPanel = new WeakMap<vscode.WebviewPanel, TestContext>();

// Acumulador de tokens por panel — suma el uso de todos los agentes de una sesión
const tokenTotalsByPanel = new WeakMap<
  vscode.WebviewPanel,
  { inputTokens: number; outputTokens: number }
>();

function addTokenUsage(
  panel: vscode.WebviewPanel,
  usage: { inputTokens: number; outputTokens: number }
) {
  const totals = tokenTotalsByPanel.get(panel) ?? { inputTokens: 0, outputTokens: 0 };
  totals.inputTokens += usage.inputTokens;
  totals.outputTokens += usage.outputTokens;
  tokenTotalsByPanel.set(panel, totals);
}

// ── Model handlers ─────────────────────────────────────────────────────────────

const modelHandlers: Record<
  string,
  (prompt: string, panel: vscode.WebviewPanel, subModel?: string) => Promise<string>
> = {
  chatgpt: async (prompt, panel, subModel) => {
    let session = sessionsByPanel.get(panel);
    if (!session) { session = new ChatSession(); sessionsByPanel.set(panel, session); }
    session.addUserMessage(prompt);
    const { text, usage } = await generateWithChatGPT(session.getMessages(), subModel || "gpt-4o-mini");
    session.addAssistantMessage(text);
    addTokenUsage(panel, usage);
    return text;
  },
  llamaLocal: async (prompt, panel) => {
    let session = sessionsByPanel.get(panel);
    if (!session) { session = new ChatSession(); sessionsByPanel.set(panel, session); }
    session.addUserMessage(prompt);
    const { text, usage } = await generateWithOllama(session.getMessages());
    session.addAssistantMessage(text);
    addTokenUsage(panel, usage);
    return text;
  },
  claude: async (prompt, panel, subModel) => {
    let session = sessionsByPanel.get(panel);
    if (!session) { session = new ChatSession(); sessionsByPanel.set(panel, session); }
    session.addUserMessage(prompt);
    const { text, usage } = await generateWithClaude(session.getMessages(), subModel || "claude-opus-4-8");
    session.addAssistantMessage(text);
    addTokenUsage(panel, usage);
    return text;
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function notifyAgent(
  panel: vscode.WebviewPanel,
  agent: string,
  status: "running" | "done" | "error",
  detail?: string
) {
  panel.webview.postMessage({ command: "agentStatus", agent, status, detail });
}

function formatCodeAnalysis(analysis: CodeAnalyzerOutput): string {
  if (analysis.status !== "READY") return "";

  const { methodSummary, decisionTable, loops, sideEffects, dependencies, privateMembers, startAwakeFields, requiredUsings, untestableBranches, preFlightChecklist } = analysis;
  const lines: string[] = [];

  const params = methodSummary.inputs.map(i => `${i.type} ${i.name}`).join(", ");
  lines.push(`Method: ${methodSummary.name}(${params}) → ${methodSummary.output}`);

  if (decisionTable.length > 0) {
    lines.push("\nDecision Table:");
    for (const row of decisionTable) {
      lines.push(`  [${row.branch.toUpperCase()}] ${row.conditions.join(" && ")} → ${row.expectedBehavior}`);
    }
  }

  if (loops.length > 0) {
    lines.push("\nLoops:");
    for (const loop of loops) {
      lines.push(`  ${loop.type}(${loop.condition})`);
    }
  }

  if (sideEffects.length > 0) {
    lines.push("\nSide Effects: " + sideEffects.join("; "));
  }

  if (dependencies.length > 0) {
    lines.push("\nDependencies:");
    for (const dep of dependencies) {
      lines.push(`  ${dep.type} ${dep.name}: [${dep.membersUsed.join(", ")}]`);
    }
  }

  if (privateMembers && privateMembers.length > 0) {
    lines.push("\nPrivate Members (require Reflection):");
    for (const m of privateMembers) {
      if (m.kind === "nestedType" && m.nestedValues && m.nestedValues.length > 0) {
        lines.push(`  [${m.kind}] ${m.type} ${m.name} — values: ${m.nestedValues.join(", ")}`);
      } else {
        lines.push(`  [${m.kind}] ${m.type} ${m.name}`);
      }
    }
  }

  if (startAwakeFields && startAwakeFields.length > 0) {
    lines.push("\nFields initialized in Start/Awake (must init via Reflection in SetUp):");
    for (const f of startAwakeFields) {
      const note = f.notes ? ` — ${f.notes}` : "";
      lines.push(`  ${f.type} ${f.name} [${f.initIn}]${note}`);
    }
  }

  if (requiredUsings && requiredUsings.length > 0) {
    lines.push("\nRequired project namespace usings (add to test file):");
    for (const ns of requiredUsings) {
      lines.push(`  using ${ns};`);
    }
  }

  if (untestableBranches && untestableBranches.length > 0) {
    lines.push("\nUNTESTABLE BRANCHES — OMIT these entirely, do NOT write Assert.Pass() placeholders:");
    for (const b of untestableBranches) {
      lines.push(`  SKIP: ${b.condition} — ${b.reason}`);
    }
  }

  if (preFlightChecklist) {
    lines.push("\n━━ PRE-FLIGHT CHECKLIST — use as ground truth, do NOT re-derive ━━");

    if (preFlightChecklist.typeInstantiations.length > 0) {
      lines.push("\nType Instantiations:");
      for (const t of preFlightChecklist.typeInstantiations) {
        if (t.pattern === "AddComponent") {
          lines.push(`  ${t.typeName} → go.SetActive(false); go.AddComponent<${t.typeName}>()  [${t.reason}]`);
        } else if (t.parameterless) {
          lines.push(`  ${t.typeName} → new ${t.typeName}()  [${t.reason}]`);
        } else {
          const note = t.constructorNotes ? `  NOTE: ${t.constructorNotes}` : "";
          lines.push(`  ${t.typeName} → new ${t.constructorSignature}  [${t.reason}]${note}`);
        }
      }
    }

    if (preFlightChecklist.computedProperties.length > 0) {
      lines.push("\nComputed Properties (GetField returns null — set underlying data instead):");
      for (const p of preFlightChecklist.computedProperties) {
        lines.push(`  ${p.propertyName}: ${p.getterSummary}`);
        lines.push(`    → Control via: ${p.controlVia}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

async function handleGenerate(
  className: string,
  methodName: string,
  model: string,
  subModel: string | null,
  code: string,
  panel: vscode.WebviewPanel,
  _context: vscode.ExtensionContext
) {
  generationMetaByPanel.set(panel, { className, methodName, model, subModel });

  // Inicia el contador desde antes de enviar el prompt del primer agente
  const generationStart = Date.now();
  // Resetea el acumulador de tokens para esta sesión de generación
  tokenTotalsByPanel.set(panel, { inputTokens: 0, outputTokens: 0 });

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage("No hay un workspace abierto.");
    return;
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  try {
    const projectTree = getFilteredAssetsTree();
    panel.webview.postMessage({ command: "clearPipeline" });

    const handler = modelHandlers[model];
    if (!handler) throw new Error(`Modelo no válido: ${model}`);

    // ── Step 0: Method Slicer ──────────────────────────────────────────────
    const slicerAgent = "Method Slicer";
    notifyAgent(panel, slicerAgent, "running");
    const slicerResult = await runMethodSlicer(
      { code, className, methodName, workspaceRoot },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    saveAgentOutput("method-slicer", slicerResult);

    if (slicerResult.status === "ERROR") {
      notifyAgent(panel, slicerAgent, "error", slicerResult.message);
      throw new Error(`Method Slicer failed: ${slicerResult.message}`);
    }
    notifyAgent(panel, slicerAgent, "done");

    const codeSlice = slicerResult.codeSlice.join("\n");

    // ── Step 1: Dependency Resolver ──────────────────────────────────────────
    const depAgent = "Dependency Resolver";
    notifyAgent(panel, depAgent, "running");
    const depResult = await runDependencyResolver(
      { codeSlice, projectTree, className, methodName, workspaceRoot },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    saveAgentOutput("dependency-resolver", depResult);

    if (depResult.status === "ERROR") {
      notifyAgent(panel, depAgent, "error", depResult.message);
      throw new Error(`Dependency Resolver failed: ${depResult.message}`);
    }
    notifyAgent(panel, depAgent, "done");

    // ── Read dependency files ───────────────────────────────────────────────
    const depFilePaths: string[] =
      depResult.status === "MISSING_DEPENDENCIES" ? depResult.files : [];

    let resolvedFiles: DependencyFileResult[] = [];
    let resolvedDependencyCode: string | undefined;

    if (depFilePaths.length > 0) {
      const depRead = readDependencyFiles(depFilePaths, workspaceRoot);
      resolvedFiles = depRead.files;
      resolvedDependencyCode = depRead.code;
    }

    if (resolvedFiles.length > 0) {
      panel.webview.postMessage({ command: "dependencyFiles", files: resolvedFiles });
    }

    // ── Step 2: Context Builder ───────────────────────────────────────────────
    const ctxAgent = "Context Builder";
    notifyAgent(panel, ctxAgent, "running");
    const ctxResult = await runContextBuilder(
      {
        codeSlice,
        dependencyFiles: depFilePaths,
        resolvedDependencyCode,
        className,
        methodName,
        workspaceRoot,
      },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    saveAgentOutput("context-builder", ctxResult);

    if (ctxResult.status === "ERROR") {
      notifyAgent(panel, ctxAgent, "error", ctxResult.message);
      throw new Error(`Context Builder failed: ${ctxResult.message}`);
    }
    notifyAgent(panel, ctxAgent, "done");

    if (ctxResult.dependencySlices.length > 0) {
      panel.webview.postMessage({
        command: "contextBuilderSlices",
        slices: ctxResult.dependencySlices.map((s) => ({ filePath: s.filePath })),
      });
    }

    // ── Step 2.5: Context Validator ───────────────────────────────────────────
    const ctxValAgent = "Context Validator";
    notifyAgent(panel, ctxValAgent, "running");
    const ctxValResult = await runContextValidator(
      { assembledContext: ctxResult.assembledContext, className, methodName, workspaceRoot },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    saveAgentOutput("validator-context", ctxValResult);

    if (ctxValResult.status === "ERROR") {
      notifyAgent(panel, ctxValAgent, "error", ctxValResult.message);
      throw new Error(`Context Validator failed: ${ctxValResult.message}`);
    }
    notifyAgent(
      panel, ctxValAgent, "done",
      ctxValResult.status === "FIXED" ? `Corregidos ${ctxValResult.issues.length} problema(s)` : undefined
    );

    const assembledContext = ctxValResult.output;

    // ── Step 2.7: Code Analyzer ───────────────────────────────────────────────
    const codeAnalyzerAgent = "Code Analyzer";
    notifyAgent(panel, codeAnalyzerAgent, "running");
    const codeAnalyzerResult = await runCodeAnalyzer(
      { assembledContext, className, methodName, workspaceRoot },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    saveAgentOutput("code-analyzer", codeAnalyzerResult);

    // Soft failure: log and continue without the pre-computed analysis
    const codeAnalysis =
      codeAnalyzerResult.status === "READY"
        ? formatCodeAnalysis(codeAnalyzerResult)
        : undefined;

    notifyAgent(
      panel, codeAnalyzerAgent,
      codeAnalyzerResult.status === "READY" ? "done" : "error",
      codeAnalyzerResult.status === "ERROR" ? codeAnalyzerResult.message : undefined
    );

    // ── Step 3: Test Generator ────────────────────────────────────────────────
    const testAgent = "Test Generator";
    notifyAgent(panel, testAgent, "running");
    const testResult = await runTestGenerator(
      { assembledContext, codeAnalysis, className, methodName, workspaceRoot, model },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    saveAgentOutput("test-generator", testResult);

    if (testResult.status === "ERROR") {
      notifyAgent(panel, testAgent, "error", testResult.message);
      throw new Error(`Test Generator failed: ${testResult.message}`);
    }
    notifyAgent(panel, testAgent, "done");

    // ── Step 3.5: Test Validator ──────────────────────────────────────────────
    const testValAgent = "Test Validator";
    notifyAgent(panel, testValAgent, "running");
    const testValResult = await runTestValidator(
      { testCode: testResult.testCode, assembledContext, className, methodName, workspaceRoot },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    saveAgentOutput("validator-test", testValResult);

    let finalTestCode = testResult.testCode;

    if (testValResult.status === "ERROR") {
      // Soft failure: surface the error but keep the original generated code
      notifyAgent(panel, testValAgent, "error", testValResult.message);
    } else {
      if (testValResult.status === "FIXED" && testResult.savedPath) {
        const testFileName = `UTIA_${model}_${className}_${methodName}`;
        finalTestCode = testValResult.output.replace(
          /public\s+class\s+\w+/,
          `public class ${testFileName}`
        );
        fs.writeFileSync(testResult.savedPath, finalTestCode, "utf8");
        notifyAgent(panel, testValAgent, "done", `Corregidos ${testValResult.issues.length} problema(s)`);
      } else {
        notifyAgent(panel, testValAgent, "done");
      }
    }

    // Store test context for ChatFixer
    testContextByPanel.set(panel, {
      testCode: finalTestCode,
      assembledContext,
      savedPath: testResult.savedPath,
    });

    const elapsedMs = Date.now() - generationStart;
    const tokens = tokenTotalsByPanel.get(panel) ?? { inputTokens: 0, outputTokens: 0 };
    const totalTokens = tokens.inputTokens + tokens.outputTokens;
    panel.webview.postMessage({ command: "showResult", result: finalTestCode, elapsedMs, totalTokens });

  } catch (err: any) {
    panel.webview.postMessage({ command: "agentError", message: err.message });
    vscode.window.showErrorMessage("Error al generar: " + err.message);
  }
}

// ── Webview panel ──────────────────────────────────────────────────────────────

export async function createWebviewPanel(context: vscode.ExtensionContext, code: string) {
  const panel = vscode.window.createWebviewPanel(
    "unityTestIAView",
    "Unity Test IA",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, "ui")),
        vscode.Uri.file(path.join(context.extensionPath, "assets")),
        vscode.Uri.file(path.join(context.extensionPath, "dist")),
      ],
    }
  );

  const models: { id: string; name: string; type?: string }[] = [];
  if (process.env.OPENAI_API_KEY)
    models.push({ id: "chatgpt", name: "ChatGPT", type: "direct" });
  if (process.env.ANTHROPIC_API_KEY)
    models.push({ id: "claude", name: "Claude", type: "direct" });
  models.push({ id: "llamaLocal", name: "Llama Local", type: "direct" });

  const uiPath = path.join(context.extensionPath, "ui", "index.html");
  const cssUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "dist", "bundle.css"))
  );
  const logoUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "assets", "logo.png"))
  );
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "dist", "bundle.js"))
  );

  let html = fs.readFileSync(uiPath, "utf8");
  html = html.replace("${code}", code.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  html = html.replace("${logoUri}", logoUri.toString());
  html = html.replace("@@styleUri", cssUri.toString());
  html = html.replace("@@scriptUri", scriptUri.toString());
  panel.webview.html = html;

  panel.webview.postMessage({ command: "setModels", models });
  sessionsByPanel.set(panel, new ChatSession());

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "validateInputs": {
        const { className, methodName } = await collectClassAndMethod(panel);
        const { classOk, methodOk } = checkSymbols(code, className, methodName);
        if (!classOk || !methodOk) {
          const msg = !classOk && !methodOk
            ? `La clase "${className}" y el método "${methodName}" no existen en el documento.`
            : !classOk
            ? `La clase "${className}" no existe en el documento.`
            : `El método "${methodName}" no existe en la clase.`;
          vscode.window.showErrorMessage(msg);
          panel.webview.postMessage({ command: "resetInputs" });
          return;
        }
        panel.webview.postMessage({ command: "goToStep2", className, methodName });
        break;
      }

      case "webviewReady": {
        panel.webview.postMessage({ command: "setModels", models });
        break;
      }

      case "generateFromConfig": {
        const { className, methodName, model, subModel } = message;
        const { classOk, methodOk } = checkSymbols(code, className, methodName);
        if (!classOk || !methodOk) {
          const what = !classOk
            ? `Class "${className}" not found`
            : `Method "${methodName}" not found in "${className}"`;
          vscode.window.showErrorMessage(`generateFromConfig: ${what} in the active file.`);
          panel.webview.postMessage({ command: "generationError", message: what });
          return;
        }
        await handleGenerate(className, methodName, model, subModel, code, panel, context);
        break;
      }

      case "generateTest": {
        const { className, methodName } = await collectClassAndMethod(panel);
        await handleGenerate(className, methodName, message.model, message.subModel, code, panel, context);
        break;
      }

      case "chatMessage": {
        const text = String(message.text || "").trim();
        if (!text) return;

        const meta = generationMetaByPanel.get(panel);
        if (!meta) { vscode.window.showErrorMessage("No hay configuración de modelo cargada."); return; }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;
        const handler = modelHandlers[meta.model];
        const testCtx = testContextByPanel.get(panel);

        if (testCtx && workspaceRoot) {
          // Route through ChatFixer: the agent has full context of the test + source
          notifyAgent(panel, "Chat Fixer", "running");
          const fixResult = await runChatFixer(
            {
              testCode: testCtx.testCode,
              assembledContext: testCtx.assembledContext,
              userMessage: text,
              className: meta.className,
              methodName: meta.methodName,
              workspaceRoot,
            },
            (prompt) => handler(prompt, panel, meta.subModel ?? undefined)
          );
          saveAgentOutput("chat-fixer", fixResult);

          if (fixResult.status === "FIXED") {
            testContextByPanel.set(panel, { ...testCtx, testCode: fixResult.correctedCode });
            if (testCtx.savedPath) {
              fs.writeFileSync(testCtx.savedPath, fixResult.correctedCode, "utf8");
            }
            const summary = fixResult.summary ?? "Correcciones aplicadas";
            notifyAgent(panel, "Chat Fixer", "done", summary);
            panel.webview.postMessage({ command: "chatResponse", text: `✓ ${summary}` });
            // updateResult: updates the code panel without clearing the agent pipeline
            panel.webview.postMessage({ command: "updateResult", result: fixResult.correctedCode });
          } else if (fixResult.status === "INFO") {
            notifyAgent(panel, "Chat Fixer", "done");
            panel.webview.postMessage({ command: "chatResponse", text: fixResult.answer });
          } else {
            // ERROR from ChatFixer — fall back to plain chat
            notifyAgent(panel, "Chat Fixer", "error", fixResult.message);
            const session = sessionsByPanel.get(panel);
            if (!session) return;
            session.addUserMessage(text);
            const reply = await handler(text, panel, meta.subModel ?? undefined);
            session.addAssistantMessage(reply);
            panel.webview.postMessage({ command: "chatResponse", text: reply });
          }
          return;
        }

        // No generated test yet — plain chat
        const session = sessionsByPanel.get(panel);
        if (!session) { vscode.window.showErrorMessage("No hay sesión de chat activa."); return; }
        session.addUserMessage(text);
        const reply = await handler(text, panel, meta.subModel ?? undefined);
        session.addAssistantMessage(reply);
        panel.webview.postMessage({ command: "chatResponse", text: reply });
        break;
      }
    }
  });
}
