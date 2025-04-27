import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { debounce } from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

// Decoration type for AI suggestions and loading states
const aiResponseDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorHint.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em',
        textDecoration: 'none; cursor: pointer;'
    }
});

// Interfaces for backend responses and local cache
interface SuggestionResponse {
    suggestion: string;
    explanation: string;
    documentationLink?: string;
    diff?: string;
}

interface AnalysisResponse {
    suggestions: { line: number; message: string; explanation?: string; diff?: string }[];
}

interface QueryResponse {
    id: string;
    response: string;
}

interface CachedIndex {
    files: string[];
    lastIndexed: number;
}

function getBackendUrl(): string {
    const config = vscode.workspace.getConfiguration('aiCodingTutor');
    return config.get('backendUrl', 'http://localhost:8080');
}

function readAugmentIgnore(workspacePath: string): string[] {
    const ignorePath = path.join(workspacePath, '.augmentignore');
    if (fs.existsSync(ignorePath)) {
        const ig = ignore().add(fs.readFileSync(ignorePath, 'utf8'));
        return ig.createFilter() as any; // Simplified for demo; in practice, filter paths
    }
    return [];
}

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Coding Tutor: Extension activated');

    let isActive = true;
    let proficiency = context.globalState.get('ai-coding-tutor.proficiency', 'novice');
    const suggestionCache = new Map<number, SuggestionResponse>();
    const indexCache = new Map<string, CachedIndex>();

    const codeLensEmitter = new vscode.EventEmitter<void>();
    const suggestionProvider = new SuggestionCodeLensProvider(codeLensEmitter);

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, suggestionProvider),
        vscode.window.onDidChangeTextEditorSelection(() => codeLensEmitter.fire())
    );

    const treeDataProvider = new AiTutorTreeDataProvider(() => ({ isActive, proficiency }));
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('aiTutorView', treeDataProvider),
        vscode.commands.registerCommand('ai-coding-tutor.selectLevel', async () => {
            const level = await vscode.window.showQuickPick(['novice', 'medium', 'expert'], {
                placeHolder: 'Select your proficiency level'
            });
            if (level) {
                proficiency = level;
                context.globalState.update('ai-coding-tutor.proficiency', level);
                treeDataProvider.refresh();
                vscode.window.showInformationMessage(`Proficiency set to ${level}`);
                suggestionCache.clear();
            }
        }),
        vscode.commands.registerCommand('ai-coding-tutor.toggleActivation', () => {
            isActive = !isActive;
            treeDataProvider.refresh();
            if (!isActive) {
                suggestionProvider.updateSuggestions([]);
                codeLensEmitter.fire();
            }
            vscode.window.showInformationMessage(`Extension ${isActive ? 'activated' : 'deactivated'}`);
        }),
        vscode.commands.registerCommand('ai-coding-tutor.askQuery', async () => {
            const query = await vscode.window.showInputBox({ prompt: 'Enter your coding question' });
            if (!query) return;

            const level = await vscode.window.showQuickPick(['novice', 'medium', 'expert'], {
                placeHolder: 'Select your proficiency level'
            });
            if (!level) return;

            try {
                const { id, response } = await fetchQueryResponse(query, level);
                const feedbackOptions = ['👍 Helpful', '👎 Not Helpful'];
                const feedback = await vscode.window.showInformationMessage(
                    `AI Response: ${response}`,
                    ...feedbackOptions
                );

                if (feedback) {
                    const isPositive = feedback === '👍 Helpful';
                    await sendFeedbackToBackend(id, isPositive);
                    vscode.window.showInformationMessage(`Feedback recorded: ${feedback}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        vscode.commands.registerCommand('ai-coding-tutor.getSuggestion', async (lineNumber?: number) => {
            if (!isActive || !vscode.window.activeTextEditor) return;
            const editor = vscode.window.activeTextEditor;
            const targetLine = lineNumber ?? editor.selection.active.line;
            const lineText = editor.document.lineAt(targetLine).text.trim();

            if (suggestionCache.has(targetLine)) {
                const cached = suggestionCache.get(targetLine)!;
                editor.setDecorations(aiResponseDecorationType, [createResponseDecoration(targetLine, cached)]);
                return;
            }

            editor.setDecorations(aiResponseDecorationType, [createLoadingDecoration(targetLine)]);
            try {
                const response = await fetchSuggestionFromBackend(lineText, proficiency);
                suggestionCache.set(targetLine, response);
                const decoration = createResponseDecoration(targetLine, response);
                editor.setDecorations(aiResponseDecorationType, [decoration]);
            } catch (error) {
                editor.setDecorations(aiResponseDecorationType, []);
                vscode.window.showErrorMessage(`Failed to get suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        vscode.commands.registerCommand('ai-coding-tutor.analyzeCode', async () => {
            if (!isActive || !vscode.window.activeTextEditor) return;
            const editor = vscode.window.activeTextEditor;
            const document = editor.document;
            const workspacePath = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            if (!workspacePath) return;

            const cached = indexCache.get(workspacePath);
            const now = Date.now();
            if (!cached || now - cached.lastIndexed > 3600000) { // Refresh every hour
                const exclusions = readAugmentIgnore(workspacePath);
                const files = await indexWorkspace(workspacePath, exclusions);
                indexCache.set(workspacePath, { files, lastIndexed: now });
            }

            const fullText = document.getText();
            try {
                const suggestions = await fetchFullCodeSuggestions(fullText, proficiency);
                suggestionProvider.updateSuggestions(suggestions);
                codeLensEmitter.fire();
            } catch (error) {
                vscode.window.showErrorMessage(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        })
    );

    const debouncedAnalysis = debounce(async (document: vscode.TextDocument) => {
        if (!isActive || !vscode.window.activeTextEditor || vscode.window.activeTextEditor.document.uri.toString() !== document.uri.toString()) {
            return;
        }
        const fullText = document.getText();
        try {
            const suggestions = await fetchFullCodeSuggestions(fullText, proficiency);
            suggestionProvider.updateSuggestions(suggestions);
            codeLensEmitter.fire();
        } catch (error) {
            vscode.window.showWarningMessage(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, 5000);

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (isActive) {
                debouncedAnalysis(document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(() => {
            suggestionProvider.updateSuggestions([]);
            suggestionCache.clear();
            codeLensEmitter.fire();
        })
    );
}

async function indexWorkspace(workspacePath: string, exclusions: string[]): Promise<string[]> {
    const files: string[] = [];
    const walker = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(workspacePath, fullPath);
            if (exclusions.some(ex => relPath.startsWith(ex))) continue;
            if (entry.isDirectory()) {
                await walker(fullPath);
            } else {
                files.push(fullPath);
            }
        }
    };
    await walker(workspacePath);
    return files;
}

class AiTutorTreeDataProvider implements vscode.TreeDataProvider<AiTutorTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AiTutorTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private getState: () => { isActive: boolean; proficiency: string };

    constructor(getState: () => { isActive: boolean; proficiency: string }) {
        this.getState = getState;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AiTutorTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AiTutorTreeItem): AiTutorTreeItem[] {
        if (element) return [];
        const { isActive, proficiency } = this.getState();
        return [
            new AiTutorTreeItem(`Status: ${isActive ? 'Active' : 'Inactive'}`, 'ai-coding-tutor.toggleActivation', isActive ? 'check' : 'circle-slash'),
            new AiTutorTreeItem(`Level: ${proficiency}`, 'ai-coding-tutor.selectLevel', 'gear'),
            new AiTutorTreeItem('Analyze Code', 'ai-coding-tutor.analyzeCode', 'refresh')
        ];
    }
}

class AiTutorTreeItem extends vscode.TreeItem {
    constructor(label: string, commandId: string, icon?: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = { command: commandId, title: label };
        if (icon) this.iconPath = new vscode.ThemeIcon(icon);
    }
}

class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
    private suggestions: { line: number; message: string; explanation: string; diff?: string }[] = [];

    constructor(private emitter: vscode.EventEmitter<void>) {
        this.onDidChangeCodeLenses = emitter.event;
    }

    onDidChangeCodeLenses?: vscode.Event<void>;

    updateSuggestions(suggestions: { line: number; message: string; explanation: string; diff?: string }[]) {
        this.suggestions = suggestions;
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== document.uri.toString()) return [];

        return this.suggestions.map(({ line, message }) => {
            const range = document.lineAt(line).range;
            return new vscode.CodeLens(range, {
                title: '$(lightbulb) Suggestion',
                tooltip: message,
                command: 'ai-coding-tutor.getSuggestion',
                arguments: [line]
            });
        });
    }
}

function createLoadingDecoration(lineNumber: number): vscode.DecorationOptions {
    return {
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
        renderOptions: {
            after: { contentText: '$(sync~spin) Analyzing...', color: new vscode.ThemeColor('editorInfo.foreground') }
        }
    };
}

function createResponseDecoration(lineNumber: number, response: SuggestionResponse): vscode.DecorationOptions {
    const diffText = response.diff ? `\n\n**Diff Preview:**\n\`\`\`diff\n${response.diff}\n\`\`\`` : '';
    return {
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
        renderOptions: {
            after: {
                contentText: `$(lightbulb) ${response.suggestion}`
            }
        },
        hoverMessage: new vscode.MarkdownString(
            `${response.suggestion}\n\n**Why?** ${response.explanation}${diffText}\n\n${
                response.documentationLink ? `[Learn More](${response.documentationLink})` : ''
            }\n\nWas this helpful? [Yes](command:ai-coding-tutor.feedback?${encodeURIComponent(
                JSON.stringify({ response: response.suggestion, helpful: true })
            )}) | [No](command:ai-coding-tutor.feedback?${encodeURIComponent(
                JSON.stringify({ response: response.suggestion, helpful: false })
            )})`
        )
    };
}

async function fetchSuggestionFromBackend(code: string, proficiency: string): Promise<SuggestionResponse> {
    const url = `${getBackendUrl()}/api/v1/query`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: code, level: proficiency })
        });
        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }
        const data = await response.json() as QueryResponse;
        return {
            suggestion: data.response,
            explanation: `This suggestion is tailored for ${proficiency} level coding.`,
            diff: `+ ${data.response}\n- ${code}`, // Simplified diff example
            documentationLink: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' // Example link
        };
    } catch (error) {
        console.error(`fetchSuggestionFromBackend error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

async function fetchFullCodeSuggestions(code: string, proficiency: string): Promise<{ line: number; message: string; explanation: string; diff?: string }[]> {
    const url = `${getBackendUrl()}/api/v1/analyze`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, level: proficiency })
        });
        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }
        const data = await response.json() as AnalysisResponse;
        return data.suggestions.map(s => ({
            line: s.line,
            message: s.message,
            explanation: s.explanation || 'No additional explanation provided.',
            diff: s.diff || undefined
        }));
    } catch (error) {
        console.error(`fetchFullCodeSuggestions error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

async function fetchQueryResponse(query: string, level: string): Promise<QueryResponse> {
    const url = `${getBackendUrl()}/api/v1/query`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, level })
        });
        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }
        return response.json() as Promise<QueryResponse>;
    } catch (error) {
        console.error(`fetchQueryResponse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

async function sendFeedbackToBackend(queryId: string, isPositive: boolean): Promise<void> {
    const url = `${getBackendUrl()}/api/v1/feedback`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queryId, feedback: isPositive ? 'positive' : 'negative' })
        });
        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }
    } catch (error) {
        console.error(`sendFeedbackToBackend error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

export function deactivate() {}