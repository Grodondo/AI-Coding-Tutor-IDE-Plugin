import * as vscode from 'vscode';

// Decoration type for inline AI response
const aiResponseDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('descriptionForeground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em'
    }
});

export function activate(context: vscode.ExtensionContext) {
    //console.log('Extension "ai-coding-tutor" is now active!');
    console.log('---- ACTIVATION STARTED ----');
    console.log('Extension context:', context);

    let disposable = vscode.commands.registerCommand('ai-coding-tutor.hello', () => {
        vscode.window.showInformationMessage('AI Suggestion command executed');
      });
    
    context.subscriptions.push(disposable);

    // Create an event emitter for our CodeLens provider to refresh on selection changes.
    const codeLensEmitter = new vscode.EventEmitter<void>();

    // Register our CodeLens provider so a button appears on the active line.
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, new SuggestionCodeLensProvider(codeLensEmitter))
    );

    // Refresh CodeLens whenever the active selection changes.
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => codeLensEmitter.fire())
    );

    // Register the command that will be triggered when the CodeLens button is clicked.
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-coding-tutor.getSuggestion', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const cursorLine = editor.selection.active.line;
            const lineText = editor.document.lineAt(cursorLine).text;

            // Show a loading decoration.
            editor.setDecorations(aiResponseDecorationType, [createLoadingDecoration(cursorLine)]);

            try {
                // Send the current line to the backend.
                const aiResponse = await handleBackendRequest(lineText);
                // Update decoration with the response.
                editor.setDecorations(aiResponseDecorationType, [createResponseDecoration(cursorLine, aiResponse)]);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        })
    );
}

// CodeLens provider that places a clickable button on the active line.
class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
    private emitter: vscode.EventEmitter<void>;
    onDidChangeCodeLenses?: vscode.Event<void>;

    constructor(emitter: vscode.EventEmitter<void>) {
        this.emitter = emitter;
        this.onDidChangeCodeLenses = this.emitter.event;
    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        const editor = vscode.window.activeTextEditor;
        // Only show the button if the document matches the active editor.
        if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
            return [];
        }
        const cursorLine = editor.selection.active.line;
        const line = document.lineAt(cursorLine);
        // Create a range at the end of the line.
        const range = new vscode.Range(cursorLine, line.range.end.character, cursorLine, line.range.end.character);
        const command: vscode.Command = {
            title: '$(lightbulb) Get Suggestion',
            tooltip: 'Click to get AI suggestion for this line',
            command: 'ai-coding-tutor.getSuggestion'
        };
        return [new vscode.CodeLens(range, command)];
    }
}

// Helper: Create a decoration showing a loading spinner and message.
function createLoadingDecoration(lineNumber: number): vscode.DecorationOptions {
    return {
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
        renderOptions: {
            after: {
                contentText: ' $(sync~spin) Analyzing...',
                color: new vscode.ThemeColor('descriptionForeground')
            }
        }
    };
}

// Helper: Create a decoration that shows the AI response.
function createResponseDecoration(lineNumber: number, response: string): vscode.DecorationOptions {
    return {
        range: new vscode.Range(lineNumber, 1, lineNumber, 1),
        renderOptions: {
            after: {
                contentText: ` $(lightbulb) ${response}`,
                color: new vscode.ThemeColor('descriptionForeground')
            }
        }
    };
}

// Simulated backend request – replace with your real backend logic.
async function handleBackendRequest(code: string): Promise<string> {
    const mockResponses = new Map<string, string>([
        ['for(', 'Consider using .map() or .filter() for array transformations'],
        ['var ', 'Use const/let instead of var for better scoping'],
        ['function(', 'Arrow functions might be more concise here'],
        ['console.log', 'Remember to remove debug statements before committing']
    ]);

    // Simulate network delay.
    await new Promise(resolve => setTimeout(resolve, 500));

    for (const [pattern, response] of mockResponses) {
        if (code.includes(pattern)) {
            return response;
        }
    }
    return 'This code looks good! Consider adding comments for clarity.';
}

export function deactivate() {}
