/**
 * Chat view provider for AI Coding Tutor
 */

import * as vscode from 'vscode';
import { ChatMessage } from '../types';
import { fetchQueryResponse, sendFeedbackToBackend } from '../api/backendService';
import { parseResponseForCodeChanges, showCodeChangeSuggestions } from '../utils/codeUtils';
import * as path from 'path';
import { marked } from 'marked';

/**
 * Chat view provider for the Ask Questions panel
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _messages: ChatMessage[];
    private _isWebviewReady: boolean = false;
    private _isLoading: boolean = false;
    private _messageQueue: ChatMessage[] = [];
    private _disposables: vscode.Disposable[] = [];
    private _webviewReadyResolve?: () => void;
    private _webviewReadyPromise: Promise<void>;
    
    constructor(extensionUri: vscode.Uri, initialMessages: ChatMessage[]) {
        this._extensionUri = extensionUri;
        this._messages = initialMessages;
        
        // Create a promise that resolves when the webview is ready
        this._webviewReadyPromise = new Promise((resolve) => {
            this._webviewReadyResolve = resolve;
        });
    }
    
    dispose() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
    
    /**
     * Resolves the webview view
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('DEBUG: Resolving webview view for chat');
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        
        // Set HTML content - This must be done before setting up message handlers
        webviewView.webview.html = this._getHtmlForWebview();
        console.log('DEBUG: Webview HTML has been set');
        
        // Handle messages from the webview - proper binding is essential
        const boundMessageHandler = this._handleWebviewMessage.bind(this);
        const messageHandler = webviewView.webview.onDidReceiveMessage(message => {
            console.log('DEBUG: Raw message received from webview:', message);
            try {
                return boundMessageHandler(message);
            } catch (error) {
                console.error('DEBUG: Error in message handler:', error);
                return Promise.reject(error);
            }
        });
        this._disposables.push(messageHandler);
        
        // Try sending a test message to verify communication
        try {
            webviewView.webview.postMessage({
                type: 'forceReady'
            }).then(() => {
                console.log('DEBUG: Initial message successfully sent to webview');
            }, (error: Error) => {
                console.error('DEBUG: Error sending initial message to webview:', error);
            });
        } catch (error) {
            console.error('DEBUG: Exception sending initial message:', error);
        }
        
        // Manually force a ready message if one isn't received within timeout
        setTimeout(() => {
            if (!this._isWebviewReady) {
                console.log('DEBUG: Manually forcing webview ready state after timeout');
                this._handleReadyMessage();
                
                // Also try to send a force ready signal to the webview again
                try {
                    webviewView.webview.postMessage({
                        type: 'forceReady'
                    }).then(() => {
                        console.log('DEBUG: Force ready message sent to webview');
                    }, (error) => {
                        console.error('DEBUG: Error sending force ready message:', error);
                    });
                } catch (error) {
                    console.error('DEBUG: Exception sending force ready message:', error);
                }
            }
        }, 1000);
        
        // Set title and mark setup complete
        webviewView.title = "Ask Questions";
        console.log('DEBUG: Webview setup complete');
        
        // Force refresh view with any existing messages once initialized
        setTimeout(() => {
            if (this._messages.length > 0) {
                console.log('DEBUG: Force refreshing view with existing messages');
                this._refreshView();
            }
        }, 1500);
    }
      /**
     * Force initialization of the webview if normal ready event fails
     */
    private _forceInitialize() {
        if (!this._view) {
            return;
        }
        
        console.log('Forcing chat webview initialization');
        this._isWebviewReady = true;
        
        // Resolve the ready promise if it hasn't been resolved yet
        if (this._webviewReadyResolve) {
            this._webviewReadyResolve();
            this._webviewReadyResolve = undefined;
        }
        
        // Process any queued messages
        this._processQueuedMessages();
    }
    
    /**
     * Process any queued messages
     */
    private _processQueuedMessages() {
        if (this._messageQueue.length > 0) {
            console.log(`Processing ${this._messageQueue.length} queued messages`);
            this.update(this._messageQueue);
            this._messageQueue = [];
        }
    }
    
    /**
     * Refresh the view with current messages
     */
    private _refreshView() {
        if (this._messages.length > 0) {
            this.update(this._messages);
        }
    }
    
    /**
     * Shows the chat view and focuses it
     */
    public async showView() {
        await vscode.commands.executeCommand('workbench.view.extension.aiTutorSidebar');
        
        if (!this._view) {
            try {
                await vscode.commands.executeCommand('aiTutorChat.focus');
            } catch (error) {
                console.error('Error focusing chat view:', error);
            }
            return;
        }
        
        try {
            this._view.show(true);
        } catch (error) {
            console.error('Error showing chat view:', error);
        }
    }
    
    /**
     * Handles messages from the webview
     */
    private async _handleWebviewMessage(message: any) {
        console.log('DEBUG: Processing webview message:', message.type);
        
        switch (message.type) {
            case 'ready':
                console.log('DEBUG: Handling ready message');
                await this._handleReadyMessage();
                break;
                
            case 'sendQuestion':
                console.log('DEBUG: Handling send question message:', message.value);
                await this._handleSendQuestionMessage(message.value);
                break;
                
            case 'clearHistory':
                this._handleClearHistoryMessage();
                break;
                
            case 'applyCode':
                this._handleApplyCodeMessage(message.value);
                break;
                
            case 'sendFeedback':
                this._handleFeedbackMessage(message.queryId, message.isPositive);
                break;
                
            case 'testConnection':
                console.log('DEBUG: Received test connection message:', message.value);
                // Send a response back to confirm communication is working
                if (this._view && this._isWebviewReady) {
                    try {
                        await this._view.webview.postMessage({
                            type: 'connectionTest',
                            success: true,
                            message: 'Connection confirmed at ' + new Date().toLocaleTimeString()
                        });
                        console.log('DEBUG: Sent connection confirmation back to webview');
                    } catch (error) {
                        console.error('DEBUG: Error sending connection confirmation:', error);
                    }
                }
                break;
                
            default:
                console.warn('Unknown message from chat webview:', message.type);
        }
    }
    
    /**
     * Handle ready message from webview
     */
    private async _handleReadyMessage() {
        console.log('Chat webview is ready');
        this._isWebviewReady = true;
        
        // Resolve the ready promise
        if (this._webviewReadyResolve) {
            this._webviewReadyResolve();
            this._webviewReadyResolve = undefined;
        }
        
        // Process any queued messages
        this._processQueuedMessages();
    }
    
    /**
     * Handle user question from webview
     */
    public async _handleSendQuestionMessage(question: string) {
        console.log('DEBUG: Start processing question:', question);
        if (!question || typeof question !== 'string' || !question.trim()) {
            console.warn('Invalid question received from webview');
            return;
        }
        
        await this._sendQuestion(question);
    }
    
    /**
     * Handle clear history message from webview
     */
    private _handleClearHistoryMessage() {
        this._messages = [];
        this.update([]);
        vscode.commands.executeCommand('ai-coding-tutor.clearChatHistory');
    }
    
    /**
     * Handle apply code message from webview
     */
    private _handleApplyCodeMessage(codeContent: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }
        
        if (editor.selection.isEmpty) {
            vscode.window.showWarningMessage('Please select code to replace first');
            return;
        }
        
        editor.edit(editBuilder => {
            editBuilder.replace(editor.selection, codeContent);
        }).then(success => {
            if (success) {
                vscode.window.showInformationMessage('Code applied successfully!');
            } else {
                vscode.window.showErrorMessage('Failed to apply code');
            }
        });
    }
    
    /**
     * Handle feedback message from webview
     */
    private _handleFeedbackMessage(queryId: string, isPositive: boolean) {
        if (!queryId) {
            console.warn('Missing query ID for feedback');
            return;
        }
        
        sendFeedbackToBackend(queryId, isPositive)
            .then(() => console.log(`Feedback sent: ${isPositive ? 'positive' : 'negative'}`))
            .catch(error => console.error('Error sending feedback:', error));
    }
    
    /**
     * Sends a question to the backend
     */
    public async _sendQuestion(question: string) {
        // Get code context from active editor
        const editor = vscode.window.activeTextEditor;
        let codeContext = '';
        let fileInfo = '';
        
        if (editor) {
            if (!editor.selection.isEmpty) {
                codeContext = editor.document.getText(editor.selection);
            } else {
                const fullText = editor.document.getText();
                codeContext = fullText.length <= 10000 ? fullText : fullText.substring(0, 10000) + '\n\n[File truncated due to size...]';
            }
            
            fileInfo = `\nFile: ${path.basename(editor.document.uri.fsPath)}\nLanguage: ${editor.document.languageId}`;
        }
        
        // Add user message to chat
        const userMessage: ChatMessage = {
            role: 'user',
            content: question,
            timestamp: Date.now(),
            codeContext
        };
        
        this._messages.push(userMessage);
        this.update(this._messages);
        
        // Set loading state
        this.setLoading(true);
        
        try {
            // Send the query to the backend
            const fullQuery = codeContext ? `${question}\n\nCode context:${fileInfo}\n${codeContext}` : question;
            
            // Get user's proficiency level from VS Code settings
            const proficiency = vscode.workspace.getConfiguration('aiCodingTutor').get('proficiencyLevel', 'medium');
            
            const { id, response } = await fetchQueryResponse(fullQuery, proficiency);
            
            // Parse response for code changes if editor is available
            const parsedResponse = editor ? 
                await parseResponseForCodeChanges(response, editor) : 
                { message: response, codeChanges: [] };
            
            // Add assistant message to chat
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: parsedResponse.message,
                timestamp: Date.now(),
                queryId: id
            };
            
            this._messages.push(assistantMessage);
            this.update(this._messages);
            
            // Show code changes if available
            if (editor && parsedResponse.codeChanges && parsedResponse.codeChanges.length > 0) {
                await showCodeChangeSuggestions(editor, parsedResponse.codeChanges);
            }
        } catch (error) {
            // Handle error
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('Error sending question:', errorMessage);
            
            // Add error message to chat
            this._messages.push({
                role: 'assistant',
                content: `⚠️ Error: ${errorMessage}`,
                timestamp: Date.now()
            });
            
            this.update(this._messages);
            vscode.window.showErrorMessage(`Query failed: ${errorMessage}`);
        } finally {
            // Turn off loading state
            this.setLoading(false);
        }
    }
    
    /**
     * Update chat messages
     */
    public async update(messages: ChatMessage[]) {
        this._messages = messages;
        
        // Wait for webview to be ready
        if (!this._view || !this._isWebviewReady) {
            this._messageQueue = [...messages];
            return;
        }
        
        try {
            await this._view.webview.postMessage({
                type: 'updateMessages',
                value: messages
            });
        } catch (error) {
            console.error('Error updating chat view:', error);
            this._messageQueue = [...messages];
            
            // Reset webview if it's available
            if (this._view) {
                this._view.webview.html = this._getHtmlForWebview();
                this._isWebviewReady = false;
                
                // Create a new ready promise
                this._webviewReadyPromise = new Promise((resolve) => {
                    this._webviewReadyResolve = resolve;
                });
            }
        }
    }
    
    /**
     * Set loading state
     */
    public setLoading(isLoading: boolean) {
        this._isLoading = isLoading;
        
        if (!this._view || !this._isWebviewReady) {
            return;
        }
        
        try {
            this._view.webview.postMessage({
                type: 'setLoading',
                value: isLoading
            }).then(undefined, error => {
                console.error('Error setting loading state:', error);
            });
        } catch (error) {
            console.error('Error setting loading state:', error);
        }
    }
    
    /**
     * Get resource URI for webview
     */
    private _getResourceUri(filename: string): vscode.Uri {
        return this._view?.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', filename)
        ) || vscode.Uri.parse('');
    }
    
    /**
     * Get HTML for webview
     */
    private _getHtmlForWebview(): string {
        // Get stylesheets
        const styleUri = this._getResourceUri('chat-styles.css');
        
        // Simpler, more reliable template with inline scripts to debug issues
        return /*html*/`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Coding Tutor Chat</title>
    <link rel="stylesheet" href="${styleUri}">
    <style>
        /* Fallback styles in case the CSS file doesn't load */
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid #ccc;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        .input-container {
            padding: 10px;
            border-top: 1px solid #ccc;
        }
        .input-row {
            display: flex;
            gap: 8px;
        }
        #questionInput {
            flex: 1;
            min-height: 36px;
            padding: 8px;
        }
        button {
            padding: 8px 12px;
            cursor: pointer;
        }
        .debug-info {
            margin-top: 8px;
            padding: 8px;
            background-color: #f0f0f0;
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <span>📚 AI Coding Tutor</span>
        </div>
        <div class="header-actions">
            <button id="clearButton" type="button">Clear</button>
        </div>
    </div>
    
    <div id="chatMessages" class="messages">
        <div class="empty-state">
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 32px; margin-bottom: 10px;">💬</div>
                <div style="font-weight: bold; margin-bottom: 10px;">Welcome to AI Coding Tutor</div>
                <div style="margin-bottom: 20px;">
                    Ask questions about your code to get help with understanding, debugging, or optimizing it.
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button type="button" class="suggestion-item">How do I optimize this function?</button>
                    <button type="button" class="suggestion-item">Explain how this code works</button>
                    <button type="button" class="suggestion-item">Help me debug this error</button>
                    <button type="button" class="suggestion-item">Suggest best practices for this code</button>
                </div>
            </div>
        </div>
    </div>
    
    <div class="input-container">
        <div id="loadingIndicator" style="display: none; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; border: 2px solid #ccc; border-top-color: #333; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div>AI is thinking...</div>
            </div>
        </div>
        <div class="input-row">
            <textarea id="questionInput" placeholder="Ask a coding question..." rows="1"></textarea>
            <button id="sendButton" type="button">Send</button>
        </div>
        <div class="debug-info">
            <div id="apiStatus">Initializing API connection...</div>
            <div id="messageStatus"></div>
            <button id="testApiButton" type="button" style="margin-top: 8px; font-size: 12px; padding: 4px 8px;">Test API Connection</button>
        </div>
    </div>

    <script>
        (function() {
            // Declare variables
            let vsCodeApi;
            const chatMessages = document.getElementById('chatMessages');
            const questionInput = document.getElementById('questionInput');
            const sendButton = document.getElementById('sendButton');
            const clearButton = document.getElementById('clearButton');
            const loadingIndicator = document.getElementById('loadingIndicator');
            const testApiButton = document.getElementById('testApiButton');
            const messageStatus = document.getElementById('messageStatus');
            const apiStatus = document.getElementById('apiStatus');
            
            // Initialize VS Code API
            try {
                console.log('DEBUG: Acquiring VS Code API');
                vsCodeApi = acquireVsCodeApi();
                apiStatus.textContent = '✅ VS Code API connected';
                console.log('DEBUG: Successfully acquired VS Code API');
            } catch (error) {
                apiStatus.textContent = '❌ Failed to connect to VS Code API: ' + error.message;
                console.error('DEBUG: Failed to acquire VS Code API', error);
            }
            
            // Function to send message to the extension
            function postMessageToExtension(message) {
                console.log('DEBUG: Attempting to post message:', message);
                
                if (!vsCodeApi) {
                    messageStatus.textContent = '❌ Cannot send message: VS Code API not available';
                    console.error('DEBUG: Cannot send message, VS Code API not available');
                    return false;
                }
                
                try {
                    vsCodeApi.postMessage(message);
                    messageStatus.textContent = '✅ Message sent: ' + message.type;
                    console.log('DEBUG: Message posted successfully', message);
                    return true;
                } catch (error) {
                    messageStatus.textContent = '❌ Error sending message: ' + error.message;
                    console.error('DEBUG: Error posting message:', error);
                    return false;
                }
            }
            
            // Function to send a question
            function sendMessage() {
                const question = questionInput.value.trim();
                
                if (question) {
                    console.log('DEBUG: Sending question:', question);
                    
                    const messageSent = postMessageToExtension({
                        type: 'sendQuestion',
                        value: question
                    });
                    
                    if (messageSent) {
                        // Clear the input field
                        questionInput.value = '';
                        questionInput.style.height = '36px';
                        questionInput.focus();
                    }
                } else {
                    console.log('DEBUG: Empty question, not sending');
                }
            }
            
            // Helper function to create a message element
            function createMessageElement(message) {
                const container = document.createElement('div');
                container.className = message.role === 'user' ? 'message-container user-container' : 'message-container assistant-container';
                
                const messageEl = document.createElement('div');
                messageEl.className = message.role === 'user' ? 'message user' : 'message assistant';
                
                const header = document.createElement('div');
                header.className = 'message-header';
                header.textContent = message.role === 'user' ? 'You' : 'AI Tutor';
                  const content = document.createElement('div');
                content.className = 'message-content';                // Render markdown for assistant messages, plain text for user messages
                if (message.role === 'assistant') {
                    try {
                        // Configure marked for better security and VS Code theme compatibility
                        marked.setOptions({
                            breaks: true,
                            gfm: true,
                            headerIds: false,
                            mangle: false,
                        });
                        
                        const htmlContent = marked.parse(message.content);
                        
                        // Basic HTML sanitization (remove script tags and dangerous attributes)
                        const sanitizedHtml = htmlContent
                            .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '')
                            .replace(/javascript:/gi, '')
                            .replace(/on\\w+\\s*=/gi, '')
                            .replace(/<iframe\\b[^>]*>/gi, '')
                            .replace(/<object\\b[^>]*>/gi, '')
                            .replace(/<embed\\b[^>]*>/gi, '')
                            .replace(/<form\\b[^>]*>/gi, '')
                            .replace(/<input\\b[^>]*>/gi, '')
                            .replace(/<button\\b[^>]*>/gi, '');
                        
                        content.innerHTML = sanitizedHtml;
                    } catch (error) {
                        console.error('Error rendering markdown:', error);
                        content.textContent = message.content;
                    }
                } else {
                    content.textContent = message.content;
                }
                
                const time = document.createElement('div');
                time.className = 'message-time';
                time.textContent = new Date(message.timestamp).toLocaleTimeString();
                
                messageEl.appendChild(header);
                messageEl.appendChild(content);
                messageEl.appendChild(time);
                container.appendChild(messageEl);
                
                // Add feedback buttons for assistant messages
                if (message.role === 'assistant' && message.queryId) {
                    const actions = document.createElement('div');
                    actions.className = 'message-actions';
                    
                    const thumbsUp = document.createElement('button');
                    thumbsUp.type = 'button';
                    thumbsUp.className = 'message-action-button';
                    thumbsUp.innerHTML = '👍 Helpful';
                    thumbsUp.onclick = () => sendFeedback(message.queryId, true);
                    
                    const thumbsDown = document.createElement('button');
                    thumbsDown.type = 'button';
                    thumbsDown.className = 'message-action-button';
                    thumbsDown.innerHTML = '👎 Not helpful';
                    thumbsDown.onclick = () => sendFeedback(message.queryId, false);
                    
                    actions.appendChild(thumbsUp);
                    actions.appendChild(thumbsDown);
                    container.appendChild(actions);
                }
                
                return container;
            }
            
            // Function to send feedback
            function sendFeedback(queryId, isPositive) {
                postMessageToExtension({
                    type: 'sendFeedback',
                    queryId: queryId,
                    isPositive: isPositive
                });
            }
            
            // Function to update messages
            function updateMessages(messages) {
                chatMessages.innerHTML = '';
                
                if (messages && messages.length > 0) {
                    messages.forEach(message => {
                        chatMessages.appendChild(createMessageElement(message));
                    });
                    
                    // Scroll to bottom
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } else {
                    // Show empty state
                    chatMessages.innerHTML = 
                        '<div class="empty-state">' +
                        '<div style="text-align: center; padding: 20px;">' +
                        '<div style="font-size: 32px; margin-bottom: 10px;">💬</div>' +
                        '<div style="font-weight: bold; margin-bottom: 10px;">Welcome to AI Coding Tutor</div>' +
                        '<div style="margin-bottom: 20px;">' +
                        'Ask questions about your code to get help with understanding, debugging, or optimizing it.' +
                        '</div>' +
                        '<div style="display: flex; flex-direction: column; gap: 8px;">' +
                        '<button type="button" class="suggestion-item">How do I optimize this function?</button>' +
                        '<button type="button" class="suggestion-item">Explain how this code works</button>' +
                        '<button type="button" class="suggestion-item">Help me debug this error</button>' +
                        '<button type="button" class="suggestion-item">Suggest best practices for this code</button>' +
                        '</div>' +
                        '</div>' +
                        '</div>';
                    
                    // Reattach event listeners to suggestion items
                    document.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', function() {
                            questionInput.value = this.textContent;
                            questionInput.focus();
                        });
                    });
                }
            }
            
            // Function to set up all event listeners
            function setupEventListeners() {
                // Send button
                sendButton.addEventListener('click', function() {
                    console.log('DEBUG: Send button clicked');
                    sendMessage();
                });
                
                // Enter key in textarea
                questionInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        console.log('DEBUG: Enter key pressed');
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
                // Clear button
                clearButton.addEventListener('click', function() {
                    console.log('DEBUG: Clear button clicked');
                    postMessageToExtension({ type: 'clearHistory' });
                });
                
                // Test API button
                testApiButton.addEventListener('click', function() {
                    console.log('DEBUG: Test API button clicked');
                    postMessageToExtension({
                        type: 'testConnection',
                        value: 'Testing connection at ' + new Date().toLocaleTimeString()
                    });
                });
                
                // Suggestion items
                document.querySelectorAll('.suggestion-item').forEach(function(item) {
                    item.addEventListener('click', function() {
                        console.log('DEBUG: Suggestion clicked:', this.textContent);
                        questionInput.value = this.textContent;
                        questionInput.focus();
                    });
                });
                
                console.log('DEBUG: All event listeners set up successfully');
            }
            
            // Handle messages from extension
            function setupMessageHandler() {
                window.addEventListener('message', function(event) {
                    const message = event.data;
                    console.log('DEBUG: Received message from extension:', message?.type);
                    
                    try {
                        switch (message.type) {
                            case 'updateMessages':
                                messageStatus.textContent = '📩 Received messages update';
                                updateMessages(message.value);
                                break;
                                
                            case 'setLoading':
                                const isLoading = message.value;
                                loadingIndicator.style.display = isLoading ? 'block' : 'none';
                                sendButton.disabled = isLoading;
                                questionInput.disabled = isLoading;
                                messageStatus.textContent = isLoading ? '⏳ Loading...' : '✅ Ready';
                                break;
                                
                            case 'forceReady':
                                console.log('DEBUG: Received force ready signal');
                                messageStatus.textContent = '🔄 Force ready received, sending ready response';
                                postMessageToExtension({ type: 'ready' });
                                break;
                                
                            case 'connectionTest':
                                messageStatus.textContent = '✅ Connection test successful: ' + message.message;
                                break;
                                
                            default:
                                console.warn('DEBUG: Unknown message type:', message?.type);
                        }
                    } catch (error) {
                        console.error('DEBUG: Error handling message from extension:', error);
                        messageStatus.textContent = '❌ Error handling message: ' + error.message;
                    }
                });
            }
            
            // Initialize the webview
            function initialize() {
                console.log('DEBUG: Initializing webview');
                
                // Setup event listeners
                setupEventListeners();
                
                // Setup message handler
                setupMessageHandler();
                
                // Send ready message to extension
                setTimeout(function() {
                    console.log('DEBUG: Sending ready message to extension');
                    postMessageToExtension({ type: 'ready' });
                    
                    // Send ready message again after a delay in case it was missed
                    setTimeout(function() {
                        if (chatMessages.childElementCount === 1 && chatMessages.firstElementChild.className === 'empty-state') {
                            console.log('DEBUG: Sending ready message again');
                            postMessageToExtension({ type: 'ready' });
                        }
                    }, 1000);
                }, 500);
            }
            
            // Start initialization
            window.addEventListener('DOMContentLoaded', initialize);
            
            // Also try to initialize immediately in case DOMContentLoaded already fired
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                console.log('DEBUG: Document already loaded, initializing now');
                initialize();
            }
        })();
    </script>
</body>
</html>`;
    }
    
    /**
     * Basic HTML sanitization to prevent XSS attacks
     */
    private _sanitizeHtml(html: string): string {
        // Remove script tags and dangerous attributes
        let sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<iframe\b[^>]*>/gi, '')
            .replace(/<object\b[^>]*>/gi, '')
            .replace(/<embed\b[^>]*>/gi, '')
            .replace(/<form\b[^>]*>/gi, '')
            .replace(/<input\b[^>]*>/gi, '')
            .replace(/<button\b[^>]*>/gi, '');
        
        return sanitized;
    }
}