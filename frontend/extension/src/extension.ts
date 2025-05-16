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

// Custom decoration types for highlighting suggested code
const suggestedCodeDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editorUnnecessaryCode.opacity'),
    border: '1px dashed ' + new vscode.ThemeColor('editorInfo.foreground'),
    borderRadius: '3px',
    overviewRulerColor: new vscode.ThemeColor('editorInfo.foreground'),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    light: {
        backgroundColor: 'rgba(0, 120, 215, 0.1)',
    },
    dark: {
        backgroundColor: 'rgba(14, 99, 156, 0.2)',
    },
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
                :root {
                    --message-spacing: 16px;
                    --border-radius: 8px;
                    --transition-speed: 0.2s;
                    --header-height: 48px;
                }
                
                body {
                    padding: 0;
                    margin: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                
                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    max-height: 100vh;
                }
                
                .header {
                    height: var(--header-height);
                    display: flex;
                    align-items: center;
                    padding: 0 16px;
                    background-color: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                
                .header-title {
                    font-size: 14px;
                    font-weight: 600;
                    flex: 1;
                }
                
                .header-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .header-button {
                    background: transparent;
                    border: none;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.8;
                    transition: all var(--transition-speed) ease;
                }
                
                .header-button:hover {
                    opacity: 1;
                    background-color: var(--vscode-toolbar-hoverBackground);
                }
                
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: var(--message-spacing);
                }
                
                .message-group {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    margin-bottom: var(--message-spacing);
                }
                
                .message {
                    max-width: 85%;
                    position: relative;
                    transition: transform 0.2s ease;
                }
                
                .message:hover {
                    transform: translateY(-1px);
                }
                
                .user-message {
                    align-self: flex-end;
                    margin-left: auto;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border-radius: var(--border-radius) var(--border-radius) 0 var(--border-radius);
                    padding: 12px 16px;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }
                
                .assistant-message {
                    align-self: flex-start;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: var(--border-radius) var(--border-radius) var(--border-radius) 0;
                    padding: 12px 16px;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .message-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 4px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .message-avatar {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                }
                
                .user-avatar {
                    background-color: var(--vscode-button-background);
                }
                
                .message-sender {
                    font-weight: 600;
                    margin-right: 8px;
                }
                
                .message-content {
                    white-space: pre-wrap;
                    word-break: break-word;
                    line-height: 1.5;
                }
                
                .message-time {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 6px;
                    text-align: right;
                    opacity: 0.8;
                }
                
                .input-container {
                    display: flex;
                    padding: 16px;
                    border-top: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-editor-background);
                    position: sticky;
                    bottom: 0;
                }
                
                #questionInput {
                    flex: 1;
                    padding: 10px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: var(--border-radius);
                    resize: none;
                    min-height: 40px;
                    max-height: 120px;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    transition: border-color var(--transition-speed) ease;
                }
                
                #questionInput:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .send-button {
                    margin-left: 8px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 0 16px;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color var(--transition-speed) ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .send-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .send-button:active {
                    transform: translateY(1px);
                }
                
                .markdown-body {
                    line-height: 1.6;
                }
                
                .markdown-body pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    border-radius: var(--border-radius);
                    padding: 12px;
                    overflow-x: auto;
                    margin: 12px 0;
                    border: 1px solid var(--vscode-panel-border);
                }
                
                .markdown-body code {
                    font-family: var(--vscode-editor-font-family);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-size: 0.9em;
                }
                
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 20px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                }
                
                .empty-state-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.7;
                }
                
                .empty-state-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                
                .empty-state-description {
                    font-size: 13px;
                    max-width: 300px;
                    line-height: 1.5;
                }
                
                /* Scrollbar styling */
                .chat-messages::-webkit-scrollbar {
                    width: 8px;
                }
                
                .chat-messages::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .chat-messages::-webkit-scrollbar-thumb {
                    background-color: var(--vscode-scrollbarSlider-background);
                    border-radius: 4px;
                }
                
                .chat-messages::-webkit-scrollbar-thumb:hover {
                    background-color: var(--vscode-scrollbarSlider-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="header-title">AI Coding Tutor Chat</div>
                    <div class="header-actions">
                        <button class="header-button" id="clearButton" title="Clear conversation">
                            <span class="codicon codicon-clear-all"></span>
                        </button>
                    </div>
                </div>
                <div id="chatMessages" class="chat-messages">
                    <div class="empty-state">
                        <div class="empty-state-icon">💬</div>
                        <div class="empty-state-title">Welcome to AI Coding Tutor</div>
                        <div class="empty-state-description">
                            Ask questions about your code, request explanations, or get help with programming concepts.
                        </div>
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
                    const clearButton = document.getElementById('clearButton');
                    
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
                    
                    // Handle clear button click
                    if (clearButton) {
                        clearButton.addEventListener('click', function() {
                            if (confirm('Are you sure you want to clear the conversation history?')) {
                                vscode.postMessage({
                                    type: 'clearHistory'
                                });
                            }
                        });
                    }
                    
                    // Format timestamp
                    function formatTime(timestamp) {
                        const date = new Date(timestamp);
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    
                    // Get initials for avatar
                    function getInitials(role) {
                        return role === 'user' ? 'U' : 'AI';
                    }
                    
                    // Render messages
                    function renderMessages(messages) {
                        // Clear chat messages
                        chatMessages.innerHTML = '';
                        
                        if (messages.length === 0) {
                            // Show empty state
                            chatMessages.innerHTML = \`
                                <div class="empty-state">
                                    <div class="empty-state-icon">💬</div>
                                    <div class="empty-state-title">Welcome to AI Coding Tutor</div>
                                    <div class="empty-state-description">
                                        Ask questions about your code, request explanations, or get help with programming concepts.
                                    </div>
                                </div>
                            \`;
                            return;
                        }
                        
                        // Group messages by role for better visual separation
                        let currentRole = null;
                        let currentGroup = null;
                        
                        messages.forEach(msg => {
                            // Create a new message group if role changes
                            if (msg.role !== currentRole) {
                                currentRole = msg.role;
                                currentGroup = document.createElement('div');
                                currentGroup.className = 'message-group';
                                chatMessages.appendChild(currentGroup);
                            }
                            
                            const messageDiv = document.createElement('div');
                            messageDiv.className = \`message \${msg.role === 'user' ? 'user-message' : 'assistant-message'}\`;
                            
                            // Add message header with avatar and role
                            const headerDiv = document.createElement('div');
                            headerDiv.className = 'message-header';
                            
                            const avatarDiv = document.createElement('div');
                            avatarDiv.className = \`message-avatar \${msg.role === 'user' ? 'user-avatar' : ''}\`;
                            avatarDiv.textContent = getInitials(msg.role);
                            
                            const senderDiv = document.createElement('div');
                            senderDiv.className = 'message-sender';
                            senderDiv.textContent = msg.role === 'user' ? 'You' : 'AI Tutor';
                            
                            headerDiv.appendChild(avatarDiv);
                            headerDiv.appendChild(senderDiv);
                            
                            const contentDiv = document.createElement('div');
                            contentDiv.className = 'message-content markdown-body';
                            
                            // Format code blocks in assistant messages
                            if (msg.role === 'assistant') {
                                // Enhanced markdown parsing for code blocks
                                let content = msg.content;
                                
                                // Code blocks with language
                                content = content.replace(/\`\`\`([a-z]*)\n([\\s\\S]*?)\`\`\`/g, (match, lang, code) => {
                                    return \`<pre><code class="language-\${lang || 'text'}">\${code}</code></pre>\`;
                                });
                                
                                // Code blocks without language
                                content = content.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
                                
                                // Inline code
                                content = content.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
                                
                                // Bold text
                                content = content.replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>');
                                
                                // Italic text
                                content = content.replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>');
                                
                                // Lists
                                content = content.replace(/^- (.+)$/gm, '<li>$1</li>');
                                content = content.replace(/(<li>.+<\/li>)\n(<li>.+<\/li>)/g, '$1$2');
                                content = content.replace(/(<li>.+<\/li>)+/g, '<ul>$&</ul>');
                                
                                contentDiv.innerHTML = content;
                            } else {
                                contentDiv.textContent = msg.content;
                            }
                            
                            const timeDiv = document.createElement('div');
                            timeDiv.className = 'message-time';
                            timeDiv.textContent = formatTime(msg.timestamp);
                            
                            messageDiv.appendChild(headerDiv);
                            messageDiv.appendChild(contentDiv);
                            messageDiv.appendChild(timeDiv);
                            
                            if (currentGroup) {
                                currentGroup.appendChild(messageDiv);
                            } else {
                                chatMessages.appendChild(messageDiv);
                            }
                        });
                        
                        // Scroll to bottom
                        setTimeout(() => {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }, 100);
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
        const { isActive, proficiency } = this.getState();
        
        // If this is a category item, return its children
        if (element && element.contextValue === 'category') {
            switch (element.id) {
                case 'settings':
                    return [
                        new AiTutorTreeItem(
                            `Status: ${isActive ? 'Active' : 'Inactive'}`,
                            'ai-coding-tutor.toggleActivation',
                            {
                                icon: isActive ? 'check' : 'circle-slash',
                                description: isActive ? 'Enabled' : 'Disabled',
                                tooltip: `Click to ${isActive ? 'disable' : 'enable'} AI Coding Tutor`,
                                contextValue: 'setting'
                            }
                        ),
                        new AiTutorTreeItem(
                            `Proficiency Level`,
                            'ai-coding-tutor.selectLevel',
                            {
                                icon: 'mortar-board',
                                description: proficiency.charAt(0).toUpperCase() + proficiency.slice(1),
                                tooltip: 'Change your proficiency level to adjust AI explanations',
                                contextValue: 'setting'
                            }
                        )
                    ];
                case 'actions':
                    return [
                        new AiTutorTreeItem(
                            'Ask a Question',
                            'ai-coding-tutor.askQuery',
                            {
                                icon: 'comment-discussion',
                                tooltip: 'Ask the AI tutor a question about your code',
                                contextValue: 'action'
                            }
                        ),
                        new AiTutorTreeItem(
                            'Analyze Current File',
                            'ai-coding-tutor.analyzeCode',
                            {
                                icon: 'microscope',
                                tooltip: 'Analyze the current file for suggestions',
                                contextValue: 'action'
                            }
                        ),
                        new AiTutorTreeItem(
                            'Clear Suggestions',
                            'ai-coding-tutor.clearSuggestions',
                            {
                                icon: 'clear-all',
                                tooltip: 'Clear all current suggestions',
                                contextValue: 'action'
                            }
                        ),
                        new AiTutorTreeItem(
                            'Export Chat History',
                            'ai-coding-tutor.exportChatHistory',
                            {
                                icon: 'save-all',
                                tooltip: 'Export your conversation history as markdown',
                                contextValue: 'action'
                            }
                        )
                    ];
                case 'help':
                    return [
                        new AiTutorTreeItem(
                            'View Tutorial',
                            'ai-coding-tutor.showTutorial',
                            {
                                icon: 'book',
                                tooltip: 'Open the tutorial to learn how to use AI Coding Tutor',
                                contextValue: 'help'
                            }
                        )
                    ];
                default:
                    return [];
            }
        }
        
        // Root level - return categories
        return [
            new AiTutorTreeItem(
                'Settings',
                '',
                {
                    id: 'settings',
                    icon: 'gear',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    contextValue: 'category',
                    tooltip: 'Configure AI Coding Tutor settings'
                }
            ),
            new AiTutorTreeItem(
                'Actions',
                '',
                {
                    id: 'actions',
                    icon: 'tools',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    contextValue: 'category',
                    tooltip: 'Available AI Coding Tutor actions'
                }
            ),
            new AiTutorTreeItem(
                'Help',
                '',
                {
                    id: 'help',
                    icon: 'question',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    contextValue: 'category',
                    tooltip: 'Get help with AI Coding Tutor'
                }
            )
        ];
    }
}

// Tree item for sidebar
class AiTutorTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        commandId: string,
        options?: {
            id?: string;
            icon?: string;
            description?: string;
            tooltip?: string;
            contextValue?: string;
            collapsibleState?: vscode.TreeItemCollapsibleState;
        }
    ) {
        super(
            label, 
            options?.collapsibleState || vscode.TreeItemCollapsibleState.None
        );
        
        if (commandId) {
            this.command = { command: commandId, title: label };
        }
        
        if (options?.icon) {
            this.iconPath = new vscode.ThemeIcon(options.icon);
        }
        
        if (options?.id) {
            this.id = options.id;
        }
        
        if (options?.description) {
            this.description = options.description;
        }
        
        if (options?.tooltip) {
            this.tooltip = options.tooltip;
        }
        
        if (options?.contextValue) {
            this.contextValue = options.contextValue;
        }
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
                
                // Remove the "Accept" button as requested
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
                            
                            // Prioritize structural elements when choosing lines to suggest changes for
                            let targetLine = lineNumber;
                            const MAX_LOOK_AHEAD = 5; // Look ahead at most 5 lines
                            
                            for (let i = lineNumber; i < Math.min(lineNumber + MAX_LOOK_AHEAD, document.lineCount); i++) {
                                if (isStructuralCodeLine(document, i)) {
                                    targetLine = i;
                                    break;
                                }
                            }
                            
                            // Update the line number if we found a better target
                            if (targetLine !== lineNumber) {
                                enhancedSuggestion.line = targetLine;
                            }
                            
                            // Find next non-empty line to match its indentation
                            const nextNonEmptyLine = findNextNonEmptyLine(document, targetLine);
                            const baseIndent = document.lineAt(nextNonEmptyLine).firstNonWhitespaceCharacterIndex;
                            
                            // Get the indented code block only
                            const startLine = targetLine;
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
                                if (i === targetLine) {
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
                
                // Highlight the changed code using the decoration
                const highlightRange = new vscode.Range(
                    new vscode.Position(startLine, 0),
                    new vscode.Position(startLine + newCode.split('\n').length - 1, document.lineAt(startLine + newCode.split('\n').length - 1).text.length)
                );
                editor.setDecorations(suggestedCodeDecorationType, [{ range: highlightRange }]);
                
                // Create QuickPick for more visually appealing UI
                const quickPick = vscode.window.createQuickPick<AcceptRejectItem>();
                quickPick.title = 'AI Suggestion';
                quickPick.placeholder = 'Review the suggested changes';
                
                // No need to reference a non-existent variable here
                quickPick.items = [
                    new AcceptRejectItem(
                        '$(check) Accept Changes',
                        'Apply the suggested changes',
                        'accept',
                        new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiGreen'))
                    ),
                    new AcceptRejectItem(
                        '$(x) Reject Changes',
                        'Revert to original code',
                        'reject',
                        new vscode.ThemeIcon('close', new vscode.ThemeColor('terminal.ansiRed'))
                    )
                ];
                
                // Handle user selection
                quickPick.onDidAccept(async () => {
                    const selectedItem = quickPick.selectedItems[0] as AcceptRejectItem;
                    quickPick.hide();
                    
                    if (selectedItem.action === 'reject') {
                        // Restore original code
                        const revertEdit = new vscode.WorkspaceEdit();
                        revertEdit.replace(document.uri, new vscode.Range(startLine, 0, startLine + newCode.split('\n').length, 0), originalCode);
                        await vscode.workspace.applyEdit(revertEdit);
                        
                        // Clear decoration
                        editor.setDecorations(suggestedCodeDecorationType, []);
                    } else if (selectedItem.action === 'accept') {
                        // Send positive feedback
                        const queryId = state.suggestionQueryIds.get(lineNumber);
                        if (queryId) {
                            await sendFeedbackToBackend(queryId, true);
                            state.suggestionQueryIds.delete(lineNumber);
                        }
                        
                        // Clear decoration since it's now accepted
                        editor.setDecorations(suggestedCodeDecorationType, []);
                        
                        vscode.window.showInformationMessage('Changes applied successfully');
                    }
                });
                
                // Handle dismissal (treat as rejection)
                quickPick.onDidHide(async () => {
                    if (!quickPick.selectedItems.length) {
                        // No selection made, revert changes
                        const revertEdit = new vscode.WorkspaceEdit();
                        revertEdit.replace(document.uri, new vscode.Range(startLine, 0, startLine + newCode.split('\n').length, 0), originalCode);
                        await vscode.workspace.applyEdit(revertEdit);
                        
                        // Clear decoration
                        editor.setDecorations(suggestedCodeDecorationType, []);
                    }
                });
                
                quickPick.show();
                
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to preview suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        clearDecorations(editor, suggestedCodeDecorationType);
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
            :root {
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
                --spacing-xl: 32px;
                --border-radius: 8px;
                --transition-speed: 0.2s;
            }
            
            body {
                font-family: var(--vscode-font-family);
                padding: var(--spacing-xl);
                margin: 0;
                color: var(--vscode-foreground);
                line-height: 1.6;
                font-size: 14px;
                max-width: 900px;
                margin: 0 auto;
            }
            
            h1, h2, h3 {
                color: var(--vscode-editor-foreground);
                margin-top: var(--spacing-xl);
                margin-bottom: var(--spacing-md);
                font-weight: 600;
            }
            
            h1 {
                font-size: 28px;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: var(--spacing-md);
                margin-top: 0;
            }
            
            h2 {
                font-size: 20px;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: var(--spacing-sm);
            }
            
            h3 {
                font-size: 16px;
                color: var(--vscode-textLink-foreground);
            }
            
            p {
                margin-bottom: var(--spacing-md);
            }
            
            .container {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xl);
            }
            
            .header {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-lg);
            }
            
            .header-icon {
                font-size: 32px;
                color: var(--vscode-textLink-foreground);
            }
            
            .header-text {
                flex: 1;
            }
            
            .feature-section {
                margin-bottom: var(--spacing-xl);
            }
            
            .feature {
                margin-bottom: var(--spacing-lg);
                padding: var(--spacing-md);
                border-radius: var(--border-radius);
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                transition: transform var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
            }
            
            .feature:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            
            .feature-header {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-md);
            }
            
            .feature-icon {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border-radius: 50%;
                font-size: 16px;
                font-weight: bold;
            }
            
            .feature-title {
                font-size: 16px;
                font-weight: 600;
                margin: 0;
            }
            
            .steps {
                margin-left: var(--spacing-xl);
                margin-top: var(--spacing-md);
            }
            
            .step {
                margin-bottom: var(--spacing-md);
                position: relative;
                padding-left: var(--spacing-lg);
            }
            
            .step:before {
                content: "";
                position: absolute;
                left: 0;
                top: 8px;
                width: 8px;
                height: 8px;
                background-color: var(--vscode-button-background);
                border-radius: 50%;
            }
            
            .command {
                background-color: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-panel-border);
                padding: var(--spacing-sm) var(--spacing-md);
                border-radius: var(--border-radius);
                font-family: var(--vscode-editor-font-family);
                font-size: 13px;
                display: inline-block;
                margin: var(--spacing-xs) 0;
            }
            
            .proficiency-levels {
                display: flex;
                gap: var(--spacing-lg);
                margin-top: var(--spacing-lg);
                flex-wrap: wrap;
            }
            
            .proficiency-card {
                flex: 1;
                min-width: 200px;
                padding: var(--spacing-md);
                border-radius: var(--border-radius);
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
            }
            
            .proficiency-card h4 {
                margin-top: 0;
                margin-bottom: var(--spacing-sm);
                color: var(--vscode-textLink-foreground);
                font-size: 15px;
            }
            
            .proficiency-card p {
                margin: 0;
                font-size: 13px;
                color: var(--vscode-descriptionForeground);
            }
            
            .help-section {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-lg);
                margin-top: var(--spacing-xl);
            }
            
            .help-section h2 {
                margin-top: 0;
                border-bottom: none;
                padding-bottom: 0;
            }
            
            .help-links {
                display: flex;
                gap: var(--spacing-lg);
                flex-wrap: wrap;
                margin-top: var(--spacing-lg);
            }
            
            .help-link {
                flex: 1;
                min-width: 200px;
                padding: var(--spacing-md);
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border-radius: var(--border-radius);
                text-align: center;
                text-decoration: none;
                font-weight: 500;
                transition: background-color var(--transition-speed) ease;
            }
            
            .help-link:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            .footer {
                margin-top: var(--spacing-xl);
                padding-top: var(--spacing-lg);
                border-top: 1px solid var(--vscode-panel-border);
                text-align: center;
                color: var(--vscode-descriptionForeground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-icon">🎓</div>
                <div class="header-text">
                    <h1>Welcome to AI Coding Tutor</h1>
                    <p>Your personal AI assistant for learning and improving your coding skills. This tutorial will help you get started with the AI Coding Tutor extension.</p>
                </div>
            </div>
            
            <div class="feature-section">
                <h2>Proficiency Levels</h2>
                <p>The extension adapts to your experience level, providing explanations that match your understanding:</p>
                
                <div class="proficiency-levels">
                    <div class="proficiency-card">
                        <h4>Novice</h4>
                        <p>Simple explanations focused on fundamentals with beginner-friendly terminology and examples.</p>
                    </div>
                    
                    <div class="proficiency-card">
                        <h4>Medium</h4>
                        <p>Balanced explanations with more technical details and some advanced concepts for intermediate developers.</p>
                    </div>
                    
                    <div class="proficiency-card">
                        <h4>Expert</h4>
                        <p>In-depth technical explanations with comprehensive details and advanced programming concepts.</p>
                    </div>
                </div>
                
                <p>To change your level, click on the status bar icon or use the command:</p>
                <div class="command">AI Coding Tutor: Select Proficiency Level</div>
            </div>
            
            <div class="feature-section">
                <h2>Key Features</h2>
                
                <div class="feature">
                    <div class="feature-header">
                        <div class="feature-icon">1</div>
                        <h3 class="feature-title">Get Code Suggestions</h3>
                    </div>
                    <p>Receive intelligent suggestions to improve your code quality, performance, and readability.</p>
                    <div class="steps">
                        <div class="step">Right-click on a line of code and select "AI Coding Tutor: Get Suggestion"</div>
                        <div class="step">Or click on a CodeLens suggestion that appears above your code</div>
                        <div class="step">Review the suggestion and apply it with a single click if you find it helpful</div>
                    </div>
                </div>
                
                <div class="feature">
                    <div class="feature-header">
                        <div class="feature-icon">2</div>
                        <h3 class="feature-title">Analyze Entire File</h3>
                    </div>
                    <p>Get a comprehensive analysis of your code file with multiple improvement suggestions.</p>
                    <div class="steps">
                        <div class="step">Use the command: <span class="command">AI Coding Tutor: Analyze Code</span></div>
                        <div class="step">Or click the analyze button in the sidebar</div>
                        <div class="step">Review the list of suggestions and navigate to each one with a click</div>
                    </div>
                </div>
                
                <div class="feature">
                    <div class="feature-header">
                        <div class="feature-icon">3</div>
                        <h3 class="feature-title">Ask Questions</h3>
                    </div>
                    <p>Have a conversation with the AI tutor about your code or programming concepts.</p>
                    <div class="steps">
                        <div class="step">Open the "Ask Questions" panel in the sidebar</div>
                        <div class="step">Type your question and press Enter</div>
                        <div class="step">The AI will respond with explanations, examples, and code snippets</div>
                    </div>
                </div>
                
                <div class="feature">
                    <div class="feature-header">
                        <div class="feature-icon">4</div>
                        <h3 class="feature-title">Explain Selected Code</h3>
                    </div>
                    <p>Get detailed explanations of specific code sections to understand how they work.</p>
                    <div class="steps">
                        <div class="step">Select code you want explained</div>
                        <div class="step">Right-click and choose "AI Coding Tutor: Explain Code"</div>
                        <div class="step">Review the explanation in the chat panel</div>
                    </div>
                </div>
            </div>
            
            <div class="help-section">
                <h2>Getting Help</h2>
                <p>If you have any questions or issues with the extension, there are several ways to get help:</p>
                
                <div class="help-links">
                    <a href="#" class="help-link" onclick="vscode.postMessage({command: 'openDocumentation'})">
                        Documentation
                    </a>
                    <a href="#" class="help-link" onclick="vscode.postMessage({command: 'openIssues'})">
                        Report Issues
                    </a>
                    <a href="#" class="help-link" onclick="vscode.postMessage({command: 'askHelp'})">
                        Ask the AI
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p>AI Coding Tutor v1.0.0 | Helping developers learn and grow</p>
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            // Handle link clicks
            document.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' && e.target.getAttribute('onclick')) {
                    e.preventDefault();
                }
            });
        </script>
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

// Function to determine if a line contains structural code elements
function isStructuralCodeLine(document: vscode.TextDocument, lineIndex: number): boolean {
    if (lineIndex < 0 || lineIndex >= document.lineCount) return false;
    
    const line = document.lineAt(lineIndex).text.trim();
    
    // Check for class, function, method, loop, or if statement declarations
    // This is a simplified check - in a real implementation you'd use language-specific parsing
    return (
        line.startsWith('class ') || 
        line.startsWith('def ') || 
        line.startsWith('function ') || 
        line.startsWith('for ') || 
        line.startsWith('while ') || 
        line.startsWith('if ') || 
        line.includes(' class ') || 
        line.includes(' function ') || 
        line.includes(' = function') || 
        line.includes('struct ') || 
        line.includes(' interface ') ||
        line.includes(' enum ')
    );
}

// Function to find the next non-empty line after a given line
function findNextNonEmptyLine(document: vscode.TextDocument, startLine: number): number {
    for (let i = startLine + 1; i < document.lineCount; i++) {
        if (document.lineAt(i).text.trim() !== '') {
            return i;
        }
    }
    return startLine; // Return the start line if no non-empty lines are found
}

// Create more appealing quick pick items for accept/reject choices
class AcceptRejectItem implements vscode.QuickPickItem {
    constructor(
        public label: string,
        public description: string,
        public action: 'accept' | 'reject',
        public iconPath?: { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon
    ) {}
}
