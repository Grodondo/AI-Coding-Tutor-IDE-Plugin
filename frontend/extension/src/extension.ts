import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { debounce } from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { marked } from 'marked';

// Type definitions for response data
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

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    codeContext?: string; // Store code context separately 
}

interface CachedIndex {
    files: string[];
    lastIndexed: number;
}

// Configuration helpers
function getConfiguration<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('aiCodingTutor');
    return config.get<T>(key, defaultValue);
}

function getBackendUrl(): string {
    return getConfiguration<string>('backendUrl', 'http://localhost:8080');
}

function getProficiencyLevel(): string {
    return getConfiguration<string>('proficiencyLevel', 'novice');
}

function isExtensionEnabled(): boolean {
    return getConfiguration<boolean>('enable', true);
}

function shouldAutoAnalyze(): boolean {
    return getConfiguration<boolean>('autoAnalyze', true);
}

function shouldShowInlineDecorations(): boolean {
    return getConfiguration<boolean>('showInlineDecorations', true);
}

// Decoration types
const aiResponseDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorHint.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em',
        textDecoration: 'none; cursor: pointer;'
    }
});

const inlineSuggestionDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorGhostText.foreground'),
        fontStyle: 'italic',
        margin: '0',
        textDecoration: 'none'
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});

const errorHighlightDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editorError.background'),
    borderColor: new vscode.ThemeColor('editorError.border'),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '3px'
});

// Helper to read .augmentignore file
function readAugmentIgnore(workspacePath: string): string[] {
    const ignorePath = path.join(workspacePath, '.augmentignore');
    if (fs.existsSync(ignorePath)) {
        const ig = ignore().add(fs.readFileSync(ignorePath, 'utf8'));
        return ig.createFilter() as any; // Simplified for demo
    }
    return [];
}

// Export activation function for VS Code
export function activate(context: vscode.ExtensionContext) {
    console.log('AI Coding Tutor: Extension activated');

    // State management
    let isActive = context.globalState.get('ai-coding-tutor.isActive', true);
    let proficiency = context.globalState.get('ai-coding-tutor.proficiency', getProficiencyLevel());
    const suggestionCache = new Map<string, SuggestionResponse>();
    const indexCache = new Map<string, CachedIndex>();
    const chatHistory: ChatMessage[] = context.globalState.get('ai-coding-tutor.chatHistory', []);
    const suggestionQueryIds = new Map<number, string>(); // Map line numbers to query IDs for feedback
    
    // Providers and emitters
    const codeLensEmitter = new vscode.EventEmitter<void>();
    const suggestionProvider = new SuggestionCodeLensProvider(codeLensEmitter);
    const chatViewProvider = new ChatViewProvider(context.extensionUri, chatHistory);
    const treeDataProvider = new AiTutorTreeDataProvider(() => ({ isActive, proficiency }));
    
    // Register providers
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, suggestionProvider),
        vscode.window.registerWebviewViewProvider('aiTutorChat', chatViewProvider),
        vscode.window.registerTreeDataProvider('aiTutorView', treeDataProvider),
        vscode.window.onDidChangeTextEditorSelection(() => codeLensEmitter.fire())
    );

    // Register commands
    registerCommands(context, {
        isActive,
        setActive: (value) => { 
            isActive = value;
            context.globalState.update('ai-coding-tutor.isActive', value);
            treeDataProvider.refresh();
            updateStatusBarItem();
        },
        proficiency,
        setProficiency: (value) => {
            proficiency = value;
            context.globalState.update('ai-coding-tutor.proficiency', value);
            treeDataProvider.refresh();
            updateStatusBarItem();
        },
        suggestionCache,
        suggestionProvider,
        codeLensEmitter,
        chatViewProvider,
        indexCache,
        chatHistory,
        suggestionQueryIds,
        updateChatHistory: (messages) => {
            context.globalState.update('ai-coding-tutor.chatHistory', messages);
        }
    });

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    const connectionStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    context.subscriptions.push(statusBarItem, connectionStatusItem);
    
    function updateStatusBarItem() {
        if (isActive) {
            statusBarItem.text = `$(mortar-board) AI Tutor: ${proficiency}`;
            statusBarItem.tooltip = `AI Coding Tutor is active (${proficiency} level)`;
            statusBarItem.show();
        } else {
            statusBarItem.text = `$(circle-slash) AI Tutor`;
            statusBarItem.tooltip = `AI Coding Tutor is inactive`;
            statusBarItem.show();
        }
    }
    
    // Check connection to backend
    async function checkBackendConnection() {
        try {
            const url = `${getBackendUrl()}/health`;
            const response = await fetch(url, { 
                method: 'GET',
                timeout: 3000
            });
            
            if (response.ok) {
                connectionStatusItem.text = '$(plug) Connected';
                connectionStatusItem.tooltip = 'Connected to AI Coding Tutor backend';
                connectionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                connectionStatusItem.show();
                return true;
            } else {
                throw new Error(`Status: ${response.status}`);
            }
        } catch (error) {
            connectionStatusItem.text = '$(warning) Disconnected';
            connectionStatusItem.tooltip = `Cannot connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`;
            connectionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            connectionStatusItem.show();
            return false;
        }
    }
    
    // Check connection initially and periodically
    checkBackendConnection();
    const connectionCheckInterval = setInterval(() => {
        if (isActive) {
            checkBackendConnection();
        }
    }, 30000); // Check every 30 seconds
    
    context.subscriptions.push({ dispose: () => clearInterval(connectionCheckInterval) });
    
    updateStatusBarItem();
    
    // Set up event handlers for auto-analysis
    const debouncedAnalysis = debounce(async (document: vscode.TextDocument) => {
        if (!isActive || !vscode.window.activeTextEditor || 
            vscode.window.activeTextEditor.document.uri.toString() !== document.uri.toString() ||
            !shouldAutoAnalyze()) {
            return;
        }
        
        try {
            const fullText = document.getText();
            const suggestions = await fetchFullCodeSuggestions(fullText, proficiency, suggestionQueryIds);
            suggestionProvider.updateSuggestions(suggestions);
            codeLensEmitter.fire();
        } catch (error) {
            console.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, 2000);
    
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (isActive && shouldAutoAnalyze()) {
                debouncedAnalysis(document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(() => {
            suggestionProvider.updateSuggestions([]);
            codeLensEmitter.fire();
        })
    );
    
    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('ai-coding-tutor.hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'AI Coding Tutor is now active! Get personalized coding assistance with right-click or from the sidebar.',
            'Show Tutorial'
        ).then(selection => {
            if (selection === 'Show Tutorial') {
                vscode.commands.executeCommand('ai-coding-tutor.showTutorial');
            }
        });
        context.globalState.update('ai-coding-tutor.hasShownWelcome', true);
    }
}

// Chat View Provider for the Ask Questions panel
class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _messages: ChatMessage[];
    
    constructor(extensionUri: vscode.Uri, initialMessages: ChatMessage[]) {
        this._extensionUri = extensionUri;
        this._messages = initialMessages;
    }
    
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        
        webviewView.webview.html = this._getHtmlForWebview();
        
        webviewView.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'sendQuestion') {
                // Handle sending a new question from the webview
                // Call directly with the input value to skip the input box
                vscode.commands.executeCommand('ai-coding-tutor.askQuery', data.value);
            }
        });
        
        // Update the webview with existing messages
        this.update(this._messages);
    }
    
    public update(messages: ChatMessage[]) {
        this._messages = messages;
        if (this._view) {
            this._view.webview.postMessage({ 
                type: 'updateMessages', 
                value: messages 
            });
        }
    }
    
    private _getHtmlForWebview() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Coding Tutor Chat</title>
            <style>
                body {
                    padding: 0;
                    margin: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    max-height: 100vh;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }
                .message {
                    margin-bottom: 15px;
                    max-width: 85%;
                }
                .user-message {
                    align-self: flex-end;
                    margin-left: auto;
                    background-color: var(--vscode-editor-infoBackground);
                    border-radius: 10px 10px 0 10px;
                    padding: 8px 12px;
                }
                .assistant-message {
                    align-self: flex-start;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 10px 10px 10px 0;
                    padding: 8px 12px;
                }
                .message-content {
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .message-time {
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                    text-align: right;
                }
                .input-container {
                    display: flex;
                    padding: 10px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                #questionInput {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    resize: none;
                    min-height: 40px;
                    max-height: 120px;
                }
                .send-button {
                    margin-left: 8px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 0 12px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .send-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .markdown-body {
                    line-height: 1.5;
                }
                .markdown-body pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    border-radius: 3px;
                    padding: 8px;
                    overflow-x: auto;
                }
                .markdown-body code {
                    font-family: var(--vscode-editor-font-family);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                .empty-state {
                    text-align: center;
                    margin-top: 50px;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div id="chatMessages" class="chat-messages">
                    <div class="empty-state">
                        <p>Ask the AI Coding Tutor a question about your code.</p>
                        <p>Your conversation will appear here.</p>
                    </div>
                </div>
                <div class="input-container">
                    <textarea 
                        id="questionInput" 
                        placeholder="Ask a coding question..." 
                        rows="1"
                        autofocus
                    ></textarea>
                    <button id="sendButton" class="send-button">Send</button>
                </div>
            </div>
            
            <script>
                (function() {
                    // Get elements
                    const vscode = acquireVsCodeApi();
                    const chatMessages = document.getElementById('chatMessages');
                    const questionInput = document.getElementById('questionInput');
                    const sendButton = document.getElementById('sendButton');
                    
                    // Auto-resize textarea
                    questionInput.addEventListener('input', function() {
                        this.style.height = 'auto';
                        this.style.height = Math.min(120, this.scrollHeight) + 'px';
                    });
                    
                    // Send message
                    function sendMessage() {
                        const question = questionInput.value.trim();
                        if (question) {
                            vscode.postMessage({
                                type: 'sendQuestion',
                                value: question
                            });
                            questionInput.value = '';
                            questionInput.style.height = 'auto';
                        }
                    }
                    
                    // Handle Enter key (with shift for new line)
                    questionInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    });
                    
                    // Handle send button click
                    sendButton.addEventListener('click', sendMessage);
                    
                    // Format timestamp
                    function formatTime(timestamp) {
                        const date = new Date(timestamp);
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    
                    // Render messages
                    function renderMessages(messages) {
                        // Clear chat messages
                        chatMessages.innerHTML = '';
                        
                        if (messages.length === 0) {
                            // Show empty state
                            chatMessages.innerHTML = \`
                                <div class="empty-state">
                                    <p>Ask the AI Coding Tutor a question about your code.</p>
                                    <p>Your conversation will appear here.</p>
                                </div>
                            \`;
                            return;
                        }
                        
                        // Add messages
                        messages.forEach(msg => {
                            const messageDiv = document.createElement('div');
                            messageDiv.className = \`message \${msg.role === 'user' ? 'user-message' : 'assistant-message'}\`;
                            
                            const contentDiv = document.createElement('div');
                            contentDiv.className = 'message-content markdown-body';
                            
                            // Format code blocks in assistant messages
                            if (msg.role === 'assistant') {
                                // Simple markdown-like parsing for code blocks
                                let content = msg.content.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
                                // Inline code
                                content = content.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
                                contentDiv.innerHTML = content;
                            } else {
                                contentDiv.textContent = msg.content;
                            }
                            
                            const timeDiv = document.createElement('div');
                            timeDiv.className = 'message-time';
                            timeDiv.textContent = formatTime(msg.timestamp);
                            
                            messageDiv.appendChild(contentDiv);
                            messageDiv.appendChild(timeDiv);
                            chatMessages.appendChild(messageDiv);
                        });
                        
                        // Scroll to bottom
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                    
                    // Listen for messages
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'updateMessages':
                                renderMessages(message.value);
                                break;
                        }
                    });
                })();
            </script>
        </body>
        </html>`;
    }
}

// Tree view provider for sidebar
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
            new AiTutorTreeItem(
                `Status: ${isActive ? 'Active' : 'Inactive'}`, 
                'ai-coding-tutor.toggleActivation', 
                isActive ? 'check' : 'circle-slash'
            ),
            new AiTutorTreeItem(
                `Level: ${proficiency}`, 
                'ai-coding-tutor.selectLevel', 
                'mortar-board'
            ),
            new AiTutorTreeItem(
                'Ask a Question', 
                'ai-coding-tutor.askQuery', 
                'comment-discussion'
            ),
            new AiTutorTreeItem(
                'Analyze Current File', 
                'ai-coding-tutor.analyzeCode', 
                'microscope'
            ),
            new AiTutorTreeItem(
                'Clear Suggestions', 
                'ai-coding-tutor.clearSuggestions', 
                'clear-all'
            ),
        ];
    }
}

// Tree item for sidebar
class AiTutorTreeItem extends vscode.TreeItem {
    constructor(label: string, commandId: string, icon?: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = { command: commandId, title: label };
        if (icon) this.iconPath = new vscode.ThemeIcon(icon);
    }
}

// Code lens provider for suggestions
class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
    private suggestions: { line: number; message: string; explanation: string; diff?: string }[] = [];

    constructor(private emitter: vscode.EventEmitter<void>) {
        this.onDidChangeCodeLenses = emitter.event;
    }

    onDidChangeCodeLenses?: vscode.Event<void>;

    updateSuggestions(suggestions: { line: number; message: string; explanation: string; diff?: string }[]) {
        // Filter to avoid multiple suggestions on the same line
        const uniqueLineSuggestions: { [line: number]: { line: number; message: string; explanation: string; diff?: string } } = {};
        
        // Keep only the most detailed suggestion for each line
        for (const suggestion of suggestions) {
            const existingSuggestion = uniqueLineSuggestions[suggestion.line];
            
            if (!existingSuggestion || 
                (suggestion.explanation && suggestion.explanation.length > (existingSuggestion.explanation?.length || 0))) {
                uniqueLineSuggestions[suggestion.line] = suggestion;
            }
        }
        
        this.suggestions = Object.values(uniqueLineSuggestions);
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        if (!isExtensionEnabled()) return [];
        
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== document.uri.toString()) return [];

        const codeLenses: vscode.CodeLens[] = [];
        
        for (const suggestion of this.suggestions) {
            // Make sure the line is valid for this document
            if (suggestion.line >= 0 && suggestion.line < document.lineCount) {
                const range = document.lineAt(suggestion.line).range;
                
                // Create the main suggestion CodeLens
                codeLenses.push(new vscode.CodeLens(range, {
                    title: `$(lightbulb) AI Suggestion`,
                    tooltip: suggestion.message,
                    command: 'ai-coding-tutor.previewSuggestion',
                    arguments: [suggestion.line, suggestion.diff]
                }));
                
                // Add "Accept" button if the suggestion has a diff
                if (suggestion.diff) {
                    codeLenses.push(new vscode.CodeLens(range, {
                        title: `$(check) Accept`,
                        tooltip: "Apply this suggestion",
                        command: 'ai-coding-tutor.applySuggestion',
                        arguments: [suggestion.line, suggestion.diff]
                    }));
                }
            }
        }

        return codeLenses;
    }
}

// Create loading decoration
function createLoadingDecoration(lineNumber: number): vscode.DecorationOptions {
    return {
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
        renderOptions: {
            after: { 
                contentText: '$(sync~spin) Analyzing...', 
                color: new vscode.ThemeColor('editorInfo.foreground') 
            }
        }
    };
}

// Create response decoration
function createResponseDecoration(lineNumber: number, response: SuggestionResponse): vscode.DecorationOptions {
    // Format the diff for display if available
    let diffDisplay = '';
    if (response.diff) {
        // Extract only added lines for preview
        const addedLines = response.diff
            .split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .map(line => line.substring(1))
            .join('\n');
            
        if (addedLines.trim()) {
            diffDisplay = `\n\n**Suggested Code:**\n\`\`\`\n${addedLines}\n\`\`\``;
        } else {
            // If we couldn't extract added lines, show the full diff
            diffDisplay = `\n\n**Diff Preview:**\n\`\`\`diff\n${response.diff}\n\`\`\``;
        }
    }
    
    // Create a markdown string with a detailed explanation
    const hoverMessage = new vscode.MarkdownString(
        `# ${response.suggestion}\n\n` +
        `${response.explanation}${diffDisplay}\n\n` +
        (response.documentationLink ? `[Learn More](${response.documentationLink})\n\n` : '') +
        `Use the **$(check) Accept** button to apply this suggestion.`
    );
    
    // Enable command links in markdown
    hoverMessage.isTrusted = true;
    
    return {
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
        renderOptions: {
            after: {
                contentText: `$(lightbulb) ${response.suggestion}`,
                color: new vscode.ThemeColor('editorInfo.foreground'),
                fontStyle: 'italic',
                margin: '0 0 0 1em',
                border: '1px solid ' + new vscode.ThemeColor('tab.activeBorderTop'),
                backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground')
            }
        },
        hoverMessage
    };
}

// API interaction functions
async function fetchSuggestionFromBackend(code: string, proficiency: string): Promise<SuggestionResponse> {
    const url = `${getBackendUrl()}/api/v1/query`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: code, level: proficiency }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Backend error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json() as QueryResponse;
        
        return {
            suggestion: data.response,
            explanation: `This suggestion is tailored for ${proficiency} level understanding.`,
            diff: `+ ${data.response}\n- ${code}`, // Simplified diff example
            documentationLink: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' // Example link
        };
    } catch (error) {
        console.error(`fetchSuggestionFromBackend error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Add user-friendly error handling
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out. The backend service may be overloaded or unavailable.');
        }
        
        // Error handling without circular reference
        try {
            const testUrl = `${getBackendUrl()}/health`;
            const testResponse = await fetch(testUrl, { timeout: 3000 });
            if (!testResponse.ok) {
                throw new Error('Backend service is not responding properly');
            }
        } catch (connectionError) {
            throw new Error('Cannot connect to the AI Coding Tutor backend. Please check your connection and the backend URL in settings.');
        }
        
        throw error;
    }
}

async function fetchFullCodeSuggestions(code: string, proficiency: string, suggestionQueryIds?: Map<number, string>): Promise<{ line: number; message: string; explanation: string; diff?: string }[]> {
    const url = `${getBackendUrl()}/api/v1/analyze`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                code, 
                level: proficiency,
                includeLineNumbers: true // Request line-specific suggestions
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json() as AnalysisResponse;
        
        // Handle case where suggestions might be null
        if (!data.suggestions) {
            console.warn('Received null suggestions from backend');
            return [];
        }
        
        console.log('Raw analysis response:', data);
        
        // Process each suggestion to generate a diff
        const enhancedSuggestions = await Promise.all(
            data.suggestions.map(async s => {
                // Clone the suggestion
                const enhancedSuggestion = { 
                    line: s.line,
                    message: s.message,
                    explanation: s.explanation || 'No additional explanation provided.',
                    diff: s.diff
                };
                
                // If the suggestion doesn't have a diff, try to generate one
                if (!enhancedSuggestion.diff && enhancedSuggestion.line !== undefined) {
                    try {
                        // Get the current line and surrounding context
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            const lineNumber = enhancedSuggestion.line;
                            const document = editor.document;
                            
                            // Get the indented code block only
                            const startLine = lineNumber;
                            const baseIndent = document.lineAt(startLine).firstNonWhitespaceCharacterIndex;
                            let endLine = startLine;
                            
                            // Find the end of the indented block
                            for (let i = startLine + 1; i < document.lineCount; i++) {
                                const line = document.lineAt(i);
                                if (line.text.trim() === '' || line.firstNonWhitespaceCharacterIndex <= baseIndent) {
                                    // If empty line or outdented, we've reached the end of the block
                                    // But check if the next line is more indented, in which case continue
                                    if (i + 1 < document.lineCount) {
                                        const nextLine = document.lineAt(i + 1);
                                        if (nextLine.firstNonWhitespaceCharacterIndex > baseIndent) {
                                            continue; // Include this line as it's part of the block
                                        }
                                    }
                                    break;
                                }
                                endLine = i;
                            }
                            
                            let contextCode = '';
                            for (let i = startLine; i <= endLine; i++) {
                                const line = document.lineAt(i).text;
                                if (i === lineNumber) {
                                    contextCode += `[CURRENT LINE] ${line}\n`;
                                } else {
                                    contextCode += line + '\n';
                                }
                            }
                            
                            // Generate a query to improve this specific block
                            const query = `The code below needs improvement. The issue is: ${enhancedSuggestion.message}
Please provide a specific replacement for this indented code block as a diff format.
Only return the exact code that should replace the current code block, with proper indentation.
Do not add explanations in the code block.

${contextCode}`;
                            
                            // Use the query endpoint to get a better suggestion
                            const { id, response } = await fetchQueryResponse(query, proficiency);
                            
                            // Store the query ID for feedback
                            if (suggestionQueryIds) {
                                suggestionQueryIds.set(lineNumber, id);
                            }
                            
                            // Extract code block from response
                            const codeBlockRegex = /```(?:.*?)\n([\s\S]*?)```/g;
                            let match;
                            let improvedCode = '';
                            
                            while ((match = codeBlockRegex.exec(response)) !== null) {
                                improvedCode = match[1].trim();
                            }
                            
                            if (improvedCode) {
                                // Create a simple diff format
                                const originalBlock = document.getText(new vscode.Range(startLine, 0, endLine + 1, 0));
                                enhancedSuggestion.diff = `- ${originalBlock.replace(/\n/g, '\n- ')}\n+ ${improvedCode.replace(/\n/g, '\n+ ')}`;
                                
                                // Enhance the explanation with more details from the response
                                if (enhancedSuggestion.explanation === 'No additional explanation provided.') {
                                    // Remove code blocks from response to get explanation
                                    let explanation = response.replace(codeBlockRegex, '').trim();
                                    
                                    // If explanation is too long, trim it
                                    if (explanation.length > 500) {
                                        explanation = explanation.substring(0, 500) + '...';
                                    }
                                    
                                    enhancedSuggestion.explanation = explanation || 'No additional explanation provided.';
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error generating diff for line', enhancedSuggestion.line, error);
                    }
                }
                
                return enhancedSuggestion;
            })
        );
        
        return enhancedSuggestions;
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

function registerCommands(
    context: vscode.ExtensionContext, 
    state: {
        isActive: boolean;
        setActive: (value: boolean) => void;
        proficiency: string;
        setProficiency: (value: string) => void;
        suggestionCache: Map<string, SuggestionResponse>;
        suggestionProvider: SuggestionCodeLensProvider;
        codeLensEmitter: vscode.EventEmitter<void>;
        chatViewProvider: ChatViewProvider;
        indexCache: Map<string, CachedIndex>;
        chatHistory: ChatMessage[];
        suggestionQueryIds: Map<number, string>;
        updateChatHistory: (messages: ChatMessage[]) => void;
    }
) {
    context.subscriptions.push(
        // Toggle extension activation
        vscode.commands.registerCommand('ai-coding-tutor.toggleActivation', () => {
            state.setActive(!state.isActive);
            vscode.window.showInformationMessage(
                `AI Coding Tutor ${state.isActive ? 'activated' : 'deactivated'}`
            );
            
            // Clear decorations when deactivated
            if (!state.isActive) {
                state.suggestionProvider.updateSuggestions([]);
                state.codeLensEmitter.fire();
                clearAllDecorations();
            }
        }),
        
        // Proficiency level selection
        vscode.commands.registerCommand('ai-coding-tutor.selectLevel', async () => {
            const options = [
                { label: '$(mortar-board) Novice', description: 'Simple explanations for beginners', detail: 'Focus on basic concepts with simplified explanations' },
                { label: '$(mortar-board) Medium', description: 'Balanced explanations for intermediate users', detail: 'More detailed information with some advanced concepts' },
                { label: '$(mortar-board) Expert', description: 'In-depth technical explanations', detail: 'Comprehensive technical details for advanced users' }
            ];
            
            const selection = await vscode.window.showQuickPick(options, {
                placeHolder: 'Select your proficiency level',
                title: 'AI Coding Tutor - Proficiency Level'
            });
            
            if (selection) {
                const level = selection.label.includes('Novice') ? 'novice' : 
                              selection.label.includes('Medium') ? 'medium' : 'expert';
                
                state.setProficiency(level);
                vscode.window.showInformationMessage(`Proficiency set to ${level}`);
                state.suggestionCache.clear();
            }
        }),
        
        // Ask AI a question
        vscode.commands.registerCommand('ai-coding-tutor.askQuery', async (queryText?: string) => {
            if (!state.isActive) {
                vscode.window.showWarningMessage('AI Coding Tutor is currently disabled. Enable it first.');
                return;
            }
            
            let query = queryText;
            if (!query) {
                query = await vscode.window.showInputBox({ 
                    prompt: 'Enter your coding question',
                    placeHolder: 'E.g., How do I optimize this function?'
                });
            }
            
            if (!query) return;
            
            // Always get current file context
            let codeContext = '';
            const editor = vscode.window.activeTextEditor;
            
            if (editor) {
                // If there's a selection, use that as context
                if (!editor.selection.isEmpty) {
                    codeContext = editor.document.getText(editor.selection);
                } 
                // Otherwise use the entire file (up to a reasonable size)
                else {
                    const fullText = editor.document.getText();
                    // Limit to 10,000 characters to avoid huge payloads
                    codeContext = fullText.length <= 10000 ? fullText : fullText.substring(0, 10000) + '\n\n[File truncated due to size...]';
                }
            }
            
            // Add to chat view - but don't display the code context in the UI
            state.chatHistory.push({
                role: 'user',
                content: query, // Only display the question itself
                timestamp: Date.now(),
                codeContext: codeContext // Store separately
            });
            
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            
            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "AI Coding Tutor",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Processing your question..." });
                
                try {
                    // Include file name and language in the context
                    const fileInfo = editor ? `\nFile: ${path.basename(editor.document.uri.fsPath)}\nLanguage: ${editor.document.languageId}` : '';
                    const fullQuery = codeContext ? `${query}\n\nCode context:${fileInfo}\n${codeContext}` : query;
                    const { id, response } = await fetchQueryResponse(fullQuery, state.proficiency);
                    
                    // Parse the response to look for code blocks
                    const parsedResponse = await parseResponseForCodeChanges(response, editor);
                    
                    // Add to chat history
                    state.chatHistory.push({
                        role: 'assistant',
                        content: parsedResponse.message,
                        timestamp: Date.now()
                    });
                    
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                    
                    // If there are code changes, display them inline
                    if (parsedResponse.codeChanges && parsedResponse.codeChanges.length > 0 && editor) {
                        await showCodeChangeSuggestions(editor, parsedResponse.codeChanges);
                    }
                    
                    // Show feedback options
                    const feedbackOptions = ['👍 Helpful', '👎 Not Helpful'];
                    vscode.window.showInformationMessage(
                        `AI Response received`,
                        ...feedbackOptions
                    ).then(async (feedback) => {
                        if (feedback) {
                            const isPositive = feedback === '👍 Helpful';
                            await sendFeedbackToBackend(id, isPositive);
                        }
                    });
                    
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                    
                    // Add error to chat
                    state.chatHistory.push({
                        role: 'assistant',
                        content: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        timestamp: Date.now()
                    });
                    
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                }
            });
        }),
        
        // Preview suggestion
        vscode.commands.registerCommand('ai-coding-tutor.previewSuggestion', async (lineNumber: number, diff: string) => {
            if (!state.isActive || !vscode.window.activeTextEditor) return;
            
            const editor = vscode.window.activeTextEditor;
            const document = editor.document;
            
            try {
                // First, determine the code block to replace
                const startLine = lineNumber;
                const baseIndent = document.lineAt(startLine).firstNonWhitespaceCharacterIndex;
                let endLine = startLine;
                
                // Find the end of the indented block
                for (let i = startLine + 1; i < document.lineCount; i++) {
                    const line = document.lineAt(i);
                    if (line.text.trim() === '' || line.firstNonWhitespaceCharacterIndex <= baseIndent) {
                        // If empty line or outdented, we've reached the end of the block
                        // But check if the next line is more indented, in which case continue
                        if (i + 1 < document.lineCount) {
                            const nextLine = document.lineAt(i + 1);
                            if (nextLine.firstNonWhitespaceCharacterIndex > baseIndent) {
                                continue; // Include this line as it's part of the block
                            }
                        }
                        break;
                    }
                    endLine = i;
                }
                
                // Extract the new code from the diff
                let newCode = '';
                if (diff && diff.includes('+')) {
                    const lines = diff.split('\n');
                    const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
                    newCode = addedLines.map(line => line.substring(1)).join('\n');
                } else if (diff) {
                    // If diff format is not recognized, use the whole diff as new code
                    newCode = diff;
                }
                
                if (!newCode) {
                    vscode.window.showWarningMessage('No suggested code found in the diff');
                    return;
                }
                
                // Save the original code for restoration
                const originalRange = new vscode.Range(startLine, 0, endLine + 1, 0);
                const originalCode = document.getText(originalRange);
                
                // Create a temporary preview of the change
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, originalRange, newCode);
                await vscode.workspace.applyEdit(edit);
                
                // Show buttons to accept or reject
                vscode.window.showInformationMessage(
                    'Preview of suggested changes. Would you like to keep them?',
                    { modal: false },
                    'Accept Changes', 'Reject Changes'
                ).then(async selection => {
                    if (selection === 'Reject Changes') {
                        // Restore original code
                        const revertEdit = new vscode.WorkspaceEdit();
                        revertEdit.replace(document.uri, new vscode.Range(startLine, 0, startLine + newCode.split('\n').length, 0), originalCode);
                        await vscode.workspace.applyEdit(revertEdit);
                    } else if (selection === 'Accept Changes') {
                        // Send positive feedback
                        const queryId = state.suggestionQueryIds.get(lineNumber);
                        if (queryId) {
                            await sendFeedbackToBackend(queryId, true);
                            state.suggestionQueryIds.delete(lineNumber);
                        }
                        vscode.window.showInformationMessage('Changes applied successfully');
                    }
                });
                
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to preview suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }),
        
        // Apply suggestion
        vscode.commands.registerCommand('ai-coding-tutor.applySuggestion', async (lineNumber: number, diff: string) => {
            if (!state.isActive || !vscode.window.activeTextEditor) return;
            
            const editor = vscode.window.activeTextEditor;
            const document = editor.document;
            
            try {
                // First, determine the code block to replace
                const startLine = lineNumber;
                const baseIndent = document.lineAt(startLine).firstNonWhitespaceCharacterIndex;
                let endLine = startLine;
                
                // Find the end of the indented block
                for (let i = startLine + 1; i < document.lineCount; i++) {
                    const line = document.lineAt(i);
                    if (line.text.trim() === '' || line.firstNonWhitespaceCharacterIndex <= baseIndent) {
                        // If empty line or outdented, we've reached the end of the block
                        // But check if the next line is more indented, in which case continue
                        if (i + 1 < document.lineCount) {
                            const nextLine = document.lineAt(i + 1);
                            if (nextLine.firstNonWhitespaceCharacterIndex > baseIndent) {
                                continue; // Include this line as it's part of the block
                            }
                        }
                        break;
                    }
                    endLine = i;
                }
                
                // Extract the new code from the diff
                let newCode = '';
                if (diff && diff.includes('+')) {
                    const lines = diff.split('\n');
                    const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
                    newCode = addedLines.map(line => line.substring(1)).join('\n');
                } else if (diff) {
                    // If diff format is not recognized, use the whole diff as new code
                    newCode = diff;
                }
                
                if (!newCode) {
                    vscode.window.showWarningMessage('No suggested code found in the diff');
                    return;
                }
                
                // Apply the edit to the indented block
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(startLine, 0, endLine + 1, 0), newCode);
                await vscode.workspace.applyEdit(edit);
                
                // Send feedback that the suggestion was accepted
                const queryId = state.suggestionQueryIds.get(lineNumber);
                if (queryId) {
                    await sendFeedbackToBackend(queryId, true);
                    state.suggestionQueryIds.delete(lineNumber);
                }
                
                vscode.window.showInformationMessage('Code suggestion applied successfully');
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to apply suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }),
        
        // Analyze entire file
        vscode.commands.registerCommand('ai-coding-tutor.analyzeCode', async () => {
            if (!state.isActive || !vscode.window.activeTextEditor) return;
            
            const editor = vscode.window.activeTextEditor;
            const document = editor.document;
            const fileName = path.basename(document.uri.fsPath);
            const language = document.languageId;
            
            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "AI Coding Tutor",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: `Analyzing ${fileName}...` });
                
                // Analyze code
                try {
                    const fullText = document.getText();
                    console.log(`Sending code for analysis: ${fullText.length} characters, language: ${language}`);
                    
                    // Add file metadata to help the AI provide better analysis
                    const metadataComment = `// Analyzing file: ${fileName}\n// Language: ${language}\n`;
                    const codeWithMetadata = metadataComment + fullText;
                    
                    const suggestions = await fetchFullCodeSuggestions(codeWithMetadata, state.proficiency, state.suggestionQueryIds);
                    console.log("Received suggestions:", suggestions);
                    
                    if (suggestions.length === 0) {
                        vscode.window.showInformationMessage(`No suggestions found for ${fileName}.`);
                        return;
                    }
                    
                    // Update the suggestionProvider with the received suggestions
                    state.suggestionProvider.updateSuggestions(suggestions);
                    state.codeLensEmitter.fire();
                    
                    vscode.window.showInformationMessage(
                        `Found ${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} for your code.`,
                        'Show All'
                    ).then(selection => {
                        if (selection === 'Show All') {
                            // Create a quick pick to show all suggestions
                            const items = suggestions.map(s => ({
                                label: `Line ${s.line + 1}: ${s.message.substring(0, 60)}${s.message.length > 60 ? '...' : ''}`,
                                detail: s.explanation,
                                lineNumber: s.line
                            }));
                            
                            vscode.window.showQuickPick(items, {
                                placeHolder: 'Select a suggestion to jump to',
                                matchOnDetail: true
                            }).then(selected => {
                                if (selected) {
                                    // Jump to the selected line
                                    const position = new vscode.Position(selected.lineNumber, 0);
                                    editor.selection = new vscode.Selection(position, position);
                                    editor.revealRange(
                                        new vscode.Range(position, position),
                                        vscode.TextEditorRevealType.InCenter
                                    );
                                }
                            });
                        }
                    });
                } catch (error) {
                    console.error("Analysis error:", error);
                    vscode.window.showErrorMessage(
                        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                }
            });
        }),
        
        // Explain selected code
        vscode.commands.registerCommand('ai-coding-tutor.explainCode', async () => {
            if (!state.isActive || !vscode.window.activeTextEditor) return;
            
            const editor = vscode.window.activeTextEditor;
            if (editor.selection.isEmpty) {
                vscode.window.showInformationMessage('Please select code to explain');
                return;
            }
            
            const selectedCode = editor.document.getText(editor.selection);
            const query = `Explain the following code:\n\n${selectedCode}`;
            
            // Add to chat view
            state.chatHistory.push({
                role: 'user',
                content: query,
                timestamp: Date.now()
            });
            
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            
            // Open chat panel
            vscode.commands.executeCommand('aiTutorChat.focus');
            
            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "AI Coding Tutor",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Analyzing code..." });
                
                try {
                    const { id, response } = await fetchQueryResponse(query, state.proficiency);
                    
                    // Add to chat history
                    state.chatHistory.push({
                        role: 'assistant',
                        content: response,
                        timestamp: Date.now()
                    });
                    
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                    
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                    
                    // Add error to chat
                    state.chatHistory.push({
                        role: 'assistant',
                        content: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        timestamp: Date.now()
                    });
                    
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                }
            });
        }),
        
        // Optimize selected code
        vscode.commands.registerCommand('ai-coding-tutor.optimizeCode', async () => {
            if (!state.isActive || !vscode.window.activeTextEditor) return;
            
            const editor = vscode.window.activeTextEditor;
            if (editor.selection.isEmpty) {
                vscode.window.showInformationMessage('Please select code to optimize');
                return;
            }
            
            const selectedCode = editor.document.getText(editor.selection);
            const query = `Optimize the following code for better performance (keep the same functionality):\n\n${selectedCode}`;
            
            // Add to chat view
            state.chatHistory.push({
                role: 'user',
                content: query,
                timestamp: Date.now()
            });
            
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            
            // Open chat panel
            vscode.commands.executeCommand('aiTutorChat.focus');
            
            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "AI Coding Tutor",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Optimizing code..." });
                
                try {
                    const { id, response } = await fetchQueryResponse(query, state.proficiency);
                    
                    // Add to chat history
                    state.chatHistory.push({
                        role: 'assistant',
                        content: response,
                        timestamp: Date.now()
                    });
                    
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                    
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                    
                    // Add error to chat
                    state.chatHistory.push({
                        role: 'assistant',
                        content: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        timestamp: Date.now()
                    });
                    
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                }
            });
        }),
        
        // Clear all suggestions
        vscode.commands.registerCommand('ai-coding-tutor.clearSuggestions', () => {
            state.suggestionProvider.updateSuggestions([]);
            state.codeLensEmitter.fire();
            clearAllDecorations();
            vscode.window.showInformationMessage('All AI suggestions cleared');
        }),
        
        // Show tutorial
        vscode.commands.registerCommand('ai-coding-tutor.showTutorial', () => {
            const tutorialPanel = vscode.window.createWebviewPanel(
                'aiTutorTutorial',
                'AI Coding Tutor - Tutorial',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );
            
            tutorialPanel.webview.html = getTutorialHtml();
        }),
        
        // Save chat history as markdown
        vscode.commands.registerCommand('ai-coding-tutor.exportChatHistory', async () => {
            if (state.chatHistory.length === 0) {
                vscode.window.showInformationMessage('No chat history to export');
                return;
            }
            
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }
            
            try {
                // Generate markdown content
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `ai-tutor-notes-${timestamp}.md`;
                const filePath = path.join(workspaceFolders[0].uri.fsPath, filename);
                
                let markdownContent = `# AI Coding Tutor Study Notes\n\n`;
                markdownContent += `Generated: ${new Date().toLocaleString()}\n\n`;
                markdownContent += `Proficiency Level: ${state.proficiency}\n\n`;
                markdownContent += `## Conversation History\n\n`;
                
                state.chatHistory.forEach((msg, index) => {
                    const formattedTime = new Date(msg.timestamp).toLocaleString();
                    const role = msg.role === 'user' ? '🧑‍💻 **User**' : '🤖 **AI Tutor**';
                    markdownContent += `### ${index + 1}. ${role} (${formattedTime})\n\n${msg.content}\n\n`;
                });
                
                // Write file
                await fs.promises.writeFile(filePath, markdownContent, 'utf8');
                
                // Show success and open file
                const openAction = 'Open File';
                vscode.window.showInformationMessage(
                    `Chat history exported to ${filename}`,
                    openAction
                ).then(selection => {
                    if (selection === openAction) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
                    }
                });
            } catch (error: unknown) {
                vscode.window.showErrorMessage(`Failed to export chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        })
    );
}

// Helper to clear decorations
function clearDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType) {
    editor.setDecorations(decorationType, []);
}

function clearAllDecorations() {
    if (vscode.window.activeTextEditor) {
        const editor = vscode.window.activeTextEditor;
        clearDecorations(editor, aiResponseDecorationType);
        clearDecorations(editor, inlineSuggestionDecorationType);
        clearDecorations(editor, errorHighlightDecorationType);
    }
}

// HTML for tutorial
function getTutorialHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Coding Tutor Tutorial</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                padding: 20px;
            }
            h1, h2 {
                color: var(--vscode-editor-foreground);
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 10px;
            }
            .feature {
                margin-bottom: 30px;
            }
            .feature h3 {
                margin-bottom: 5px;
                color: var(--vscode-textLink-foreground);
            }
            .steps {
                margin-left: 20px;
            }
            .step {
                margin-bottom: 10px;
            }
            .command {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                padding: 5px 10px;
                border-radius: 4px;
                font-family: var(--vscode-editor-font-family);
            }
        </style>
    </head>
    <body>
        <h1>Welcome to AI Coding Tutor</h1>
        <p>This tutorial will help you get started with the AI Coding Tutor extension.</p>
        
        <div class="feature">
            <h2>Proficiency Levels</h2>
            <p>The extension provides three levels of assistance to match your experience:</p>
            <ul>
                <li><strong>Novice:</strong> Simple explanations focused on basics</li>
                <li><strong>Medium:</strong> More detailed insights with some advanced concepts</li>
                <li><strong>Expert:</strong> In-depth technical explanations</li>
            </ul>
            <p>To change your level, click on the status bar icon or use the command:</p>
            <div class="command">AI Coding Tutor: Select Proficiency Level</div>
        </div>
        
        <div class="feature">
            <h2>Key Features</h2>
            
            <div class="feature">
                <h3>1. Get code suggestions</h3>
                <div class="steps">
                    <div class="step">Right-click on a line of code and select "AI Coding Tutor: Get Suggestion"</div>
                    <div class="step">Or click on a CodeLens suggestion that appears above your code</div>
                </div>
            </div>
            
            <div class="feature">
                <h3>2. Analyze entire file</h3>
                <div class="steps">
                    <div class="step">Use the command: <span class="command">AI Coding Tutor: Analyze Code</span></div>
                    <div class="step">Or click the analyze button in the sidebar</div>
                </div>
            </div>
            
            <div class="feature">
                <h3>3. Ask questions</h3>
                <div class="steps">
                    <div class="step">Open the "Ask Questions" panel in the sidebar</div>
                    <div class="step">Type your question and press Enter</div>
                </div>
            </div>
            
            <div class="feature">
                <h3>4. Explain selected code</h3>
                <div class="steps">
                    <div class="step">Select code you want explained</div>
                    <div class="step">Right-click and choose "AI Coding Tutor: Explain Code"</div>
                </div>
            </div>
        </div>
        
        <h2>Getting Help</h2>
        <p>If you have any questions or issues, you can:</p>
        <ul>
            <li>Check the README file for detailed documentation</li>
            <li>Submit issues on the GitHub repository</li>
            <li>Ask the AI assistant itself for help using the extension</li>
        </ul>
        
        <h2>Happy Coding!</h2>
        <p>We hope this extension helps you learn and improve your coding skills.</p>
    </body>
    </html>`;
}

// Index workspace files
async function indexWorkspace(workspacePath: string, exclusions: string[]): Promise<string[]> {
    const files: string[] = [];
    const walker = async (dir: string) => {
        try {
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
        } catch (error) {
            console.error(`Error indexing ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    
    await walker(workspacePath);
    return files;
}

export function deactivate() {
    // Clean up resources on deactivation
    clearAllDecorations();
}

// Helper function to parse AI responses for code blocks and change suggestions
interface CodeChange {
    startLine: number;
    endLine: number;
    newCode: string;
    explanation: string;
}

interface ParsedResponse {
    message: string;
    codeChanges: CodeChange[];
}

// Parse an AI response to extract code changes
async function parseResponseForCodeChanges(response: string, editor?: vscode.TextEditor): Promise<ParsedResponse> {
    if (!editor) {
        return { message: response, codeChanges: [] };
    }
    
    const codeChanges: CodeChange[] = [];
    let message = response;
    
    // Match all code blocks with optional language specification
    const codeBlockRegex = /```(?:diff)?\s*([^]*?)```/g;
    let match;
    
    // Extract all code blocks from the response
    while ((match = codeBlockRegex.exec(response)) !== null) {
        const fullMatch = match[0];
        const codeContent = match[1].trim();
        
        if (codeContent.includes('+++') || codeContent.includes('---') || codeContent.includes('+') || codeContent.includes('-')) {
            // This looks like a diff, try to extract it
            try {
                // For simplicity, we'll look for lines that are added (+) and where they should be added
                const lines = codeContent.split('\n');
                let currentCodeSegment = '';
                let currentStartLine = -1;
                let currentEndLine = -1;
                let explanation = '';
                
                // Look for context lines to help us locate the position
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Look for context, which is usually a few lines that haven't changed
                    if (!line.startsWith('+') && !line.startsWith('-')) {
                        if (line.trim().length > 0) {
                            // Search for this line in the editor
                            const editorContent = editor.document.getText();
                            const lineIndex = editorContent.indexOf(line.trim());
                            
                            if (lineIndex >= 0) {
                                // Find the line number for this text
                                const position = editor.document.positionAt(lineIndex);
                                currentStartLine = position.line;
                                
                                // Collect all + lines that follow until the next context line
                                currentCodeSegment = '';
                                while (i + 1 < lines.length && (lines[i + 1].startsWith('+') || lines[i + 1].trim() === '')) {
                                    if (lines[i + 1].startsWith('+')) {
                                        currentCodeSegment += lines[i + 1].substring(1) + '\n';
                                    } else {
                                        currentCodeSegment += '\n';
                                    }
                                    i++;
                                }
                                
                                if (currentCodeSegment.trim().length > 0) {
                                    // We found a valid code segment to replace at this line
                                    currentEndLine = currentStartLine + 1; // Default to replacing one line
                                    
                                    // Look for explanation before or after the code block
                                    const codeBlockIndex = response.indexOf(fullMatch);
                                    const previousText = response.substring(0, codeBlockIndex).trim();
                                    const lastParagraph = previousText.split('\n\n').pop() || '';
                                    
                                    if (lastParagraph && !lastParagraph.includes('```')) {
                                        explanation = lastParagraph;
                                    }
                                    
                                    codeChanges.push({
                                        startLine: currentStartLine,
                                        endLine: currentEndLine,
                                        newCode: currentCodeSegment.trim(),
                                        explanation: explanation
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing diff:', error);
            }
        }
        
        // Remove the full match from the message to be displayed
        message = message.replace(fullMatch, '**[Code change suggestion]**\n*See inline suggestion in editor*');
    }
    
    return {
        message,
        codeChanges
    };
}

// Display code change suggestions in the editor
async function showCodeChangeSuggestions(editor: vscode.TextEditor, changes: CodeChange[]): Promise<void> {
    for (const change of changes) {
        const startPos = new vscode.Position(change.startLine, 0);
        const endPos = new vscode.Position(change.endLine, 0);
        const range = new vscode.Range(startPos, endPos);
        
        // Create a code lens to show the suggestion
        const options: vscode.DecorationOptions = {
            range,
            hoverMessage: new vscode.MarkdownString(
                `### Suggested Change\n${change.explanation}\n\n` +
                "```\n" + change.newCode + "\n```\n\n" +
                "Use context menu to apply or dismiss."
            )
        };
        
        // Add a decoration to highlight the code
        const decoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.hoverHighlightBackground'),
            border: '1px dashed ' + new vscode.ThemeColor('editor.selectionBackground'),
            after: {
                contentText: ' // AI suggestion available',
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
                fontStyle: 'italic'
            }
        });
        
        editor.setDecorations(decoration, [options]);
        
        // Show a message to the user
        vscode.window.showInformationMessage(
            'AI suggested code changes are available (see highlighted areas)',
            'Apply Changes', 'Dismiss'
        ).then(selection => {
            if (selection === 'Apply Changes') {
                // Apply the change
                editor.edit(editBuilder => {
                    editBuilder.replace(range, change.newCode);
                });
            }
            
            // Always remove the decoration when the user makes a decision
            editor.setDecorations(decoration, []);
        });
    }
}