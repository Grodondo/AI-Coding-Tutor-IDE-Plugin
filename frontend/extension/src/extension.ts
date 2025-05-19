/**
 * AI Coding Tutor Extension
 * Main extension entry point
 */

import * as vscode from 'vscode';
import { debounce } from 'lodash';
import * as path from 'path';
import { SuggestionCodeLensProvider } from './providers/suggestionProvider';
import { ChatViewProvider } from './views/chatView';
import { AiTutorTreeDataProvider } from './views/treeView';
import { StateManager } from './state/stateManager';
import { checkBackendConnection, fetchFullCodeSuggestions } from './api/backendService';
import { registerCommands } from './commands';
import { isExtensionEnabled, getProficiencyLevel, shouldAutoAnalyze } from './utils/configUtils';
import { ChatMessage, SuggestionResponse, CachedIndex } from './types';

// Export activation function for VS Code
export function activate(context: vscode.ExtensionContext) {
    console.log('AI Coding Tutor: Extension activated');

    // Initialize state
    let isActive = context.globalState.get('ai-coding-tutor.isActive', true);
    let proficiency = context.globalState.get('ai-coding-tutor.proficiency', getProficiencyLevel());
    const suggestionCache = new Map<string, SuggestionResponse>();
    const indexCache = new Map<string, CachedIndex>();
    
    // Create a new chat history array for this session
    const sessionStartTime = Date.now();
    const chatHistory: ChatMessage[] = [];
    
    // Load previous chat history only for reference
    const previousChatHistory: ChatMessage[] = context.globalState.get('ai-coding-tutor.chatHistory', []);
    
    const suggestionQueryIds = new Map<number, string>(); // Map line numbers to query IDs for feedback
    
    // Create status bar items first
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    const connectionStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    context.subscriptions.push(statusBarItem, connectionStatusItem);
    
    // Initialize event emitters and providers
    const codeLensEmitter = new vscode.EventEmitter<void>();
    const suggestionProvider = new SuggestionCodeLensProvider(codeLensEmitter);
    const chatViewProvider = new ChatViewProvider(context.extensionUri, chatHistory);
    const treeDataProvider = new AiTutorTreeDataProvider(() => ({ 
        isActive, 
        proficiency 
    }));
    
    // Register providers
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, suggestionProvider),
        vscode.window.registerWebviewViewProvider('aiTutorChat', chatViewProvider),
        vscode.window.registerTreeDataProvider('aiTutorView', treeDataProvider),
        vscode.window.onDidChangeTextEditorSelection(() => codeLensEmitter.fire())
    );

    // Add a direct command to open the chat view
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-coding-tutor.openChat', async () => {
            await vscode.commands.executeCommand('workbench.view.extension.aiTutorSidebar');
            await vscode.commands.executeCommand('aiTutorChat.focus');
        })
    );

    // Create the state manager
    const stateManager = new StateManager(
        isActive, 
        proficiency, 
        statusBarItem, 
        treeDataProvider,
        context
    );
    
    // Register commands with state access
    registerCommands(context, {
        get isActive() { return stateManager.isActive; },
        setActive: async (value) => { 
            await stateManager.setActive(value);
            isActive = value; // Keep local vars in sync
        },
        proficiency: stateManager.proficiency,
        setProficiency: async (value) => {
            await stateManager.setProficiency(value);
            proficiency = value; // Keep local vars in sync
        },
        suggestionCache,
        suggestionProvider,
        codeLensEmitter,
        chatViewProvider,
        indexCache,
        chatHistory,
        suggestionQueryIds,
        sessionStartTime,
        treeDataProvider,
        updateChatHistory: (messages) => {
            context.globalState.update('ai-coding-tutor.chatHistory', messages);
        },
        updateStatusBarItem: () => stateManager.updateStatusBar()
    });
    
    // Check connection to backend
    checkBackendConnection(connectionStatusItem);
    const connectionCheckInterval = setInterval(() => {
        if (isActive) {
            checkBackendConnection(connectionStatusItem);
        }
    }, 30000); // Check every 30 seconds
    
    context.subscriptions.push({ dispose: () => clearInterval(connectionCheckInterval) });
    
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
        })
    );
    
    // Set initial context for menus
    vscode.commands.executeCommand('setContext', 'aiCodingTutor.isActive', isActive);
    console.log('Set aiCodingTutor.isActive context to:', isActive);
    
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

// Export deactivation function for VS Code
export function deactivate() {
    console.log('AI Coding Tutor: Extension deactivated');
}
