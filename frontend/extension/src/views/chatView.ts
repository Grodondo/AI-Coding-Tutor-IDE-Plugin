/**
 * Chat view provider for AI Coding Tutor
 */

import * as vscode from 'vscode';
import { ChatMessage } from '../types';

/**
 * Chat view provider for the Ask Questions panel 
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _messages: ChatMessage[];
    private _isWebviewReady: boolean = false;
    private _isLoading: boolean = false;
    private _messageQueue: ChatMessage[] = []; // Queue for messages when webview isn't ready yet
    
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
        
        // Important: Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            console.log('Received message from webview:', data);
            
            if (data.type === 'sendQuestion') {
                // Handle sending a new question from the webview
                const question = data.value;
                if (!question || typeof question !== 'string' || !question.trim()) {
                    console.warn('Invalid question received');
                    return;
                }
                
                console.log('Sending question to AI via command:', question);
                try {
                    // Set loading state
                    this.setLoading(true);
                    
                    // Execute command directly to expose real errors
                    await vscode.commands.executeCommand('ai-coding-tutor.askQuery', question);
                    
                    console.log('Successfully executed askQuery command');
                } catch (err) {
                    console.error('Error executing askQuery command:', err);
                    vscode.window.showErrorMessage('Failed to send question. Please try again.');
                } finally {
                    this.setLoading(false);
                }
            } else if (data.type === 'clearHistory') {
                // Handle clearing chat history
                this._messages = [];
                this.update([]);
                vscode.commands.executeCommand('ai-coding-tutor.clearChatHistory');
            } else if (data.type === 'ready') {
                console.log('Webview is ready, updating with current messages');
                this._isWebviewReady = true;
                // Process any queued messages
                if (this._messageQueue.length > 0) {
                    this.update(this._messageQueue);
                    this._messageQueue = [];
                } else {
                    this.update(this._messages);
                }
                // Set loading state if needed
                if (this._isLoading) {
                    this.setLoading(this._isLoading);
                }
            } else if (data.type === 'applyCode') {
                const codeContent = data.value;
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    if (!editor.selection.isEmpty) {
                        // Replace selected code with the suggestion
                        editor.edit(editBuilder => {
                            editBuilder.replace(editor.selection, codeContent);
                        });
                        vscode.window.showInformationMessage('Code applied successfully!');
                    } else {
                        vscode.window.showWarningMessage('Please select code to replace first');
                    }
                } else {
                    vscode.window.showWarningMessage('No active editor found');
                }
            } else {
                console.warn('Unknown message type received from webview:', data.type);
            }
        });
        
        // Show loading indicator until webview is ready
        webviewView.title = "Ask Questions";
        
        // Add a timeout to check if webview becomes ready
        setTimeout(() => {
            if (!this._isWebviewReady) {
                console.warn('Webview did not report ready status after timeout, forcing initialization');
                this._isWebviewReady = true;
                this.update(this._messages);
            }
        }, 2000); // Increased timeout to 2 seconds
    }
    
    public update(messages: ChatMessage[]) {
        this._messages = messages;
        
        if (!this._view) {
            console.log('Cannot update chat: view not initialized');
            this._messageQueue = [...messages]; // Queue messages for when view is ready
            return;
        }
        
        if (!this._isWebviewReady) {
            console.log('Deferring message update: webview not ready yet');
            this._messageQueue = [...messages]; // Queue messages for when webview is ready
            return;
        }
        
        try {
            console.log('Updating chat with messages:', messages.length);
            
            this._view.title = "Ask Questions";
            this._view.webview.postMessage({ 
                type: 'updateMessages', 
                value: messages 
            }).then(
                success => {
                    console.log('Message posted successfully to webview');
                    // Ensure the panel is visible when messages update
                    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                        this._view?.show(true); // true means preserve focus
                    }
                },
                error => {
                    console.error('Failed to post message to webview:', error);
                    
                    // If posting fails, try refreshing the webview
                    if (this._view) {
                        console.log('Attempting to refresh webview after post failure');
                        this._view.webview.html = this._getHtmlForWebview();
                        this._isWebviewReady = false;
                        this._messageQueue = [...messages];
                    }
                }
            );
        } catch (err) {
            console.error('Error updating chat view:', err);
            vscode.window.showErrorMessage('Failed to update chat view. Try refreshing the panel.');
            
            // Reset webview on serious error
            if (this._view) {
                this._view.webview.html = this._getHtmlForWebview();
                this._isWebviewReady = false;
                this._messageQueue = [...messages];
            }
        }
    }
    
    public setLoading(isLoading: boolean) {
        this._isLoading = isLoading;
        
        if (!this._view || !this._isWebviewReady) {
            console.log('Cannot set loading state: view not initialized or webview not ready');
            return;
        }
        
        this._view.webview.postMessage({ 
            type: 'setLoading', 
            value: isLoading 
        }).then(
            () => console.log('Loading state updated'),
            (error: Error) => console.error('Error setting loading state:', error)
        );
    }
    
    private _getResourceUri(filename: string): vscode.Uri {
        return this._view?.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', filename)
        ) || vscode.Uri.parse('');
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
                    background-color: var(--vscode-editor-background);
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-tab-activeBackground);
                }
                
                .header-title {
                    font-weight: bold;
                }
                
                .header-button {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: var(--vscode-button-foreground);
                    background-color: var(--vscode-button-background);
                    padding: 4px 8px;
                    border-radius: 2px;
                }
                
                .messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                }
                
                .message {
                    margin-bottom: 16px;
                    padding: 8px 12px;
                    border-radius: 4px;
                    max-width: 80%;
                }
                
                .user {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    align-self: flex-end;
                    margin-left: auto;
                }
                
                .ai {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    color: var(--vscode-editor-foreground);
                }
                
                .message-container {
                    display: flex;
                    flex-direction: column;
                }
                
                .message-header {
                    font-weight: bold;
                    margin-bottom: 4px;
                }
                
                .message-time {
                    font-size: 0.8em;
                    opacity: 0.8;
                    margin-top: 4px;
                    text-align: right;
                }
                
                .input-container {
                    display: flex;
                    flex-direction: column;
                    padding: 8px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                
                #questionInput {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    resize: none;
                }
                
                #sendButton {
                    margin-left: 8px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 0 12px;
                    cursor: pointer;
                }

                pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 8px;
                    border-radius: 3px;
                    overflow-x: auto;
                    white-space: pre-wrap;
                }
                
                code {
                    font-family: var(--vscode-editor-font-family);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                }

                .empty-state-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }
                
                .debug-info {
                    font-size: 10px;
                    color: #888;
                    margin-top: 4px;
                    display: none;
                }
                
                .message-content img {
                    max-width: 100%;
                }
                
                .loading-indicator {
                    display: flex;
                    align-items: center;
                    padding: 8px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .loading-spinner {
                    border: 2px solid var(--vscode-editor-background);
                    border-top: 2px solid var(--vscode-button-background);
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    animation: spin 1s linear infinite;
                    margin-right: 8px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .message-actions {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 4px;
                }
                
                .message-action-button {
                    background: transparent;
                    border: none;
                    color: var(--vscode-descriptionForeground);
                    cursor: pointer;
                    font-size: 12px;
                    padding: 2px 4px;
                    margin-left: 8px;
                }
                
                .message-action-button:hover {
                    color: var(--vscode-button-foreground);
                    background: var(--vscode-button-background);
                    border-radius: 2px;
                }
                
                .input-row {
                    display: flex;
                    align-items: center;
                }
                
                /* Syntax highlighting for code */
                code .token.keyword { color: var(--vscode-editor-foreground); font-weight: bold; }
                code .token.string { color: var(--vscode-debugTokenExpression-string); }
                code .token.number { color: var(--vscode-debugTokenExpression-number); }
                code .token.boolean { color: var(--vscode-debugTokenExpression-boolean); }
                code .token.comment { color: var(--vscode-editorLineNumber-foreground); font-style: italic; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-title">AI Coding Tutor Chat</div>
                <button id="clearButton" class="header-button">Clear</button>
            </div>
            
            <div id="chatMessages" class="messages"></div>
            
            <div class="input-container">
                <div id="loadingIndicator" class="loading-indicator" style="display: none;">
                    <div class="loading-spinner"></div>
                    <div>AI is thinking...</div>
                </div>
                <div class="input-row">
                <textarea id="questionInput" placeholder="Ask a coding question..." rows="2"></textarea>
                <button id="sendButton">Send</button>
                </div>
            </div>

            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    const chatMessages = document.getElementById('chatMessages');
                    const questionInput = document.getElementById('questionInput');
                    const sendButton = document.getElementById('sendButton');
                    const clearButton = document.getElementById('clearButton');
                    const loadingIndicator = document.getElementById('loadingIndicator');
                    
                    console.log('Chat initialized');
                    
                    // Function to send a message
                    function sendMessage() {
                        const question = questionInput.value.trim();
                        
                        if (question) {
                            console.log('Sending question:', question);
                            
                            vscode.postMessage({
                                type: 'sendQuestion',
                                value: question
                            });
                            
                            // Clear the input field
                            questionInput.value = '';
                        }
                    }
                    
                    // Enter key handler (shift+enter for newline)
                    questionInput.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            sendMessage();
                        }
                    });
                    
                    // Button click handler
                    sendButton.addEventListener('click', () => {
                        sendMessage();
                    });
                    
                    // Clear button handler
                    clearButton.addEventListener('click', () => {
                        if (confirm('Clear all messages?')) {
                            vscode.postMessage({
                                type: 'clearHistory'
                            });
                        }
                    });
                    
                    // Format message time
                    function formatTime(timestamp) {
                        const date = new Date(timestamp);
                        return date.toLocaleTimeString();
                    }
                    
                    // HTML escape helper
                    function escapeHtml(html) {
                        const div = document.createElement('div');
                        div.textContent = html;
                        return div.innerHTML;
                    }
                    
                    // Highlight code blocks
                    function highlightCode() {
                        document.querySelectorAll('pre code').forEach((block) => {
                            // Simple syntax highlighting for common programming keywords
                            const html = block.innerHTML
                                .replace(/\\b(class|function|const|let|var|if|else|for|while|return|import|export|async|await)\\b/g, 
                                        '<span class="token keyword">$1</span>')
                                .replace(/('[^']*'|"[^"]*")/g, '<span class="token string">$1</span>')
                                .replace(/\\b(\\d+)\\b/g, '<span class="token number">$1</span>')
                                .replace(/\\b(true|false|null|undefined)\\b/g, '<span class="token boolean">$1</span>')
                                .replace(/(\\/\\/[^\\n]*|\\/*[^]*?\\*\\/)/g, '<span class="token comment">$1</span>');
                            
                            block.innerHTML = html;
                        });
                    }
                    
                    // Render chat messages
                    function renderMessages(messages) {
                        console.log('Rendering messages:', messages?.length);
                        chatMessages.innerHTML = '';
                        
                        if (!messages || messages.length === 0) {
                            chatMessages.innerHTML = \`
                                <div class="empty-state">
                                    <div class="empty-state-icon">💬</div>
                                    <div>Welcome to AI Coding Tutor</div>
                                    <div>Ask questions about your code to get help</div>
                                </div>
                            \`;
                            return;
                        }
                        
                        const messageContainer = document.createElement('div');
                        
                        messages.forEach(msg => {
                            const messageDiv = document.createElement('div');
                            messageDiv.className = \`message \${msg.role === 'user' ? 'user' : 'ai'}\`;
                            
                            const headerDiv = document.createElement('div');
                            headerDiv.className = 'message-header';
                            headerDiv.textContent = msg.role === 'user' ? 'You' : 'AI Tutor';
                            
                            const contentDiv = document.createElement('div');
                            contentDiv.className = 'message-content';
                            
                            // For AI responses, process markdown
                            if (msg.role === 'assistant') {
                                let content = msg.content || '';
                                
                                try {
                                    // Process code blocks with language
                                    content = content.replace(/\`\`\`([\\w]*)[\\s\\n]([\\s\\S]*?)\`\`\`/g, (match, lang, code) => {
                                        return \`<pre><code class="language-\${lang}">\${escapeHtml(code)}</code></pre>\`;
                                    });
                                    
                                    // Process inline code
                                    content = content.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
                                    
                                    // Bold text
                                    content = content.replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>');
                                    
                                    // Italic text
                                    content = content.replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>');
                                    
                                    // Lists (simple implementation)
                                    content = content.replace(/^- (.+)$/gm, '<li>$1</li>');
                                    content = content.replace(/(<li>.+<\/li>)\n(<li>.+<\/li>)/g, '$1$2');
                                    content = content.replace(/(<li>.+<\/li>)+/g, '<ul>$&</ul>');
                                } catch (e) {
                                    console.error('Error formatting message:', e);
                                    content = msg.content;
                                    
                                    // Add debug info
                                    const debugDiv = document.createElement('div');
                                    debugDiv.className = 'debug-info';
                                    debugDiv.textContent = \`Error parsing: \${e.message}\`;
                                    contentDiv.appendChild(debugDiv);
                                }
                                
                                contentDiv.innerHTML = content;
                                
                                // Add action buttons for AI responses
                                const actionsDiv = document.createElement('div');
                                actionsDiv.className = 'message-actions';
                                
                                // Copy button
                                const copyButton = document.createElement('button');
                                copyButton.className = 'message-action-button';
                                copyButton.textContent = 'Copy';
                                copyButton.title = 'Copy to clipboard';
                                copyButton.addEventListener('click', () => {
                                    navigator.clipboard.writeText(msg.content).then(() => {
                                        copyButton.textContent = 'Copied!';
                                        setTimeout(() => {
                                            copyButton.textContent = 'Copy';
                                        }, 2000);
                                    });
                                });
                                actionsDiv.appendChild(copyButton);
                                
                                // Check if there are code blocks to add an "Apply" button
                                if (content.includes('</code></pre>')) {
                                    const applyButton = document.createElement('button');
                                    applyButton.className = 'message-action-button';
                                    applyButton.textContent = 'Apply Code';
                                    applyButton.title = 'Apply code to editor';
                                    applyButton.addEventListener('click', () => {
                                        // Get the first code block
                                        const codeMatch = msg.content.match(/\`\`\`(?:[\\w]*)[\\s\\n]([\\s\\S]*?)\`\`\`/);
                                        if (codeMatch && codeMatch[1]) {
                                            vscode.postMessage({
                                                type: 'applyCode',
                                                value: codeMatch[1].trim()
                                            });
                                        }
                                    });
                                    actionsDiv.appendChild(applyButton);
                                }
                                
                                messageDiv.appendChild(actionsDiv);
                            } else {
                                // User message - simple text
                                contentDiv.textContent = msg.content;
                            }
                            
                            const timeDiv = document.createElement('div');
                            timeDiv.className = 'message-time';
                            timeDiv.textContent = formatTime(msg.timestamp);
                            
                            messageDiv.appendChild(headerDiv);
                            messageDiv.appendChild(contentDiv);
                            messageDiv.appendChild(timeDiv);
                            
                            messageContainer.appendChild(messageDiv);
                        });
                        
                        chatMessages.appendChild(messageContainer);
                        
                        // Apply syntax highlighting
                        setTimeout(highlightCode, 10);
                        
                        // Scroll to bottom
                        setTimeout(() => {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }, 100);
                    }
                    
                    // Listen for messages
                    window.addEventListener('message', event => {
                        const message = event.data;
                        console.log('Received message from extension:', message);
                        
                        switch (message.type) {
                            case 'updateMessages':
                                renderMessages(message.value);
                                break;
                            case 'setLoading':
                                loadingIndicator.style.display = message.value ? 'flex' : 'none';
                                sendButton.disabled = message.value;
                                questionInput.disabled = message.value;
                                break;
                        }
                    });
                    
                    // Let the extension know we're ready
                    vscode.postMessage({ type: 'ready' });
                })();
            </script>
        </body>
        </html>`;
    }
} 