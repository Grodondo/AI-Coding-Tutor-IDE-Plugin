import * as vscode from 'vscode';
import fetch from 'node-fetch';

const aiResponseDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('descriptionForeground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em',
        textDecoration: 'none; cursor: pointer;'
    }
});

function getBackendUrl(): string {
    const config = vscode.workspace.getConfiguration('aiCodingTutor');
    return config.get('backendUrl', 'http://localhost:8080');
}

export function activate(context: vscode.ExtensionContext) {
    console.log('---- ACTIVATION STARTED ----');

    let isActive = true;
    let proficiency = context.globalState.get('ai-coding-tutor.proficiency', 'easy');
    let analysisInterval: NodeJS.Timeout | undefined;

    const codeLensEmitter = new vscode.EventEmitter<void>();
    const suggestionProvider = new SuggestionCodeLensProvider(codeLensEmitter);

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, suggestionProvider)
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => codeLensEmitter.fire())
    );

    const treeDataProvider = new AiTutorTreeDataProvider(() => ({ isActive, proficiency }));
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('aiTutorView', treeDataProvider),
        vscode.commands.registerCommand('ai-coding-tutor.selectLevel', async () => {
            const level = await vscode.window.showQuickPick(['easy', 'medium', 'expert'], {
                placeHolder: 'Select your proficiency level'
            });
            if (level) {
                proficiency = level;
                context.globalState.update('ai-coding-tutor.proficiency', level);
                treeDataProvider.refresh();
                vscode.window.showInformationMessage(`Proficiency set to ${level}`);
            }
        }),
        vscode.commands.registerCommand('ai-coding-tutor.toggleActivation', () => {
            isActive = !isActive;
            treeDataProvider.refresh();
            if (isActive) startPeriodicAnalysis();
            else stopPeriodicAnalysis();
            vscode.window.showInformationMessage(`Extension ${isActive ? 'activated' : 'deactivated'}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-coding-tutor.getSuggestion', async (lineNumber?: number) => {
            if (!isActive) return;
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const targetLine = lineNumber ?? editor.selection.active.line;
            const lineText = editor.document.lineAt(targetLine).text.trim();

            editor.setDecorations(aiResponseDecorationType, [createLoadingDecoration(targetLine)]);
            try {
                const aiResponse = await fetchSuggestionFromBackend(lineText, proficiency);
                const decoration = createResponseDecoration(targetLine, aiResponse);
                decoration.hoverMessage = new vscode.MarkdownString(
                    `${aiResponse}\n\nWas this helpful? [Yes](command:ai-coding-tutor.feedback?${encodeURIComponent(JSON.stringify({ response: aiResponse, helpful: true }))}) | [No](command:ai-coding-tutor.feedback?${encodeURIComponent(JSON.stringify({ response: aiResponse, helpful: false }))})`
                );
                editor.setDecorations(aiResponseDecorationType, [decoration]);
            } catch (error) {
                editor.setDecorations(aiResponseDecorationType, []);
                vscode.window.showErrorMessage(`Failed to get suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-coding-tutor.feedback', async (args: { response: string; helpful: boolean }) => {
            await sendFeedbackToBackend(args.response, args.helpful);
            vscode.window.showInformationMessage(`Thanks for your feedback!`);
        })
    );

    function startPeriodicAnalysis() {
        if (analysisInterval) return;
        analysisInterval = setInterval(async () => {
            if (!isActive || !vscode.window.activeTextEditor) return;
            const editor = vscode.window.activeTextEditor;
            const document = editor.document;
            const fullText = document.getText();
            const suggestions = await fetchFullCodeSuggestions(fullText, proficiency);
            suggestionProvider.updateSuggestions(suggestions);
            codeLensEmitter.fire();
        }, 15000);
    }

    function stopPeriodicAnalysis() {
        if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = undefined;
            suggestionProvider.updateSuggestions([]);
            codeLensEmitter.fire();
        }
    }

    if (isActive) startPeriodicAnalysis();

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
        suggestionProvider.updateSuggestions([]);
        codeLensEmitter.fire();
    }));
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
            new AiTutorTreeItem(`Status: ${isActive ? 'Active' : 'Inactive'}`, 'ai-coding-tutor.toggleActivation'),
            new AiTutorTreeItem(`Level: ${proficiency}`, 'ai-coding-tutor.selectLevel')
        ];
    }
}

class AiTutorTreeItem extends vscode.TreeItem {
    constructor(label: string, commandId: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = { command: commandId, title: label };
    }
}

class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
    private suggestions: { line: number; message: string }[] = [];

    constructor(private emitter: vscode.EventEmitter<void>) {
        this.onDidChangeCodeLenses = emitter.event;
    }

    onDidChangeCodeLenses?: vscode.Event<void>;

    updateSuggestions(suggestions: { line: number; message: string }[]) {
        this.suggestions = suggestions;
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== document.uri.toString()) return [];

        return this.suggestions.map(({ line, message }) => {
            const range = document.lineAt(line).range;
            return new vscode.CodeLens(range, {
                title: '$(lightbulb) Get Suggestion',
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
            after: { contentText: ' $(sync~spin) Analyzing...', color: new vscode.ThemeColor('descriptionForeground') }
        }
    };
}

function createResponseDecoration(lineNumber: number, response: string): vscode.DecorationOptions {
    return {
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
        renderOptions: {
            after: { contentText: ` $(lightbulb) ${response}` }
        }
    };
}

async function fetchSuggestionFromBackend(code: string, proficiency: string): Promise<string> {
    const backendUrl = `${getBackendUrl()}/api/v1/query`;
    const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, proficiency })
    });
    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    const data = await response.json();
    return data.suggestion;
}

async function fetchFullCodeSuggestions(code: string, proficiency: string): Promise<{ line: number; message: string }[]> {
    const backendUrl = `${getBackendUrl()}/api/v1/analyze`;
    const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, proficiency })
    });
    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    const data = await response.json();
    return data.suggestions;
}

async function sendFeedbackToBackend(response: string, helpful: boolean): Promise<void> {
    const backendUrl = `${getBackendUrl()}api/v1/feedback`;
    await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, helpful, timestamp: new Date().toISOString() })
    });
}

export function deactivate() {}