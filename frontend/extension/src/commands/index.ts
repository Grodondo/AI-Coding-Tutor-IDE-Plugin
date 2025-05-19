/**
 * Command registration and implementations for AI Coding Tutor
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage, ExtensionState } from '../types';
import { 
    fetchFullCodeSuggestions, 
    fetchQueryResponse, 
    sendFeedbackToBackend 
} from '../api/backendService';
import { 
    findStructuralBlock, 
    parseResponseForCodeChanges, 
    showCodeChangeSuggestions,
    clearAllDecorations
} from '../utils/codeUtils';
import { AcceptRejectItem } from '../providers/suggestionProvider';

/**
 * Handler for query errors
 */
function handleQueryError(error: any, state: ExtensionState) {
    console.error('Query error:', error);
    
    const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
    
    // Add error message to chat
    state.chatHistory.push({
        role: 'assistant',
        content: `⚠️ Error: ${errorMessage}`,
        timestamp: Date.now()
    });
    
    // Update the chat view and make sure it's visible
    state.chatViewProvider.update(state.chatHistory);
    state.updateChatHistory(state.chatHistory);
    state.chatViewProvider.showView().catch((err: Error) => {
        console.error('Failed to show chat view after error:', err);
    });
    
    // Show error notification
    vscode.window.showErrorMessage(`Query failed: ${errorMessage}`);
}

/**
 * Register all commands
 */
export function registerCommands(
    context: vscode.ExtensionContext, 
    state: ExtensionState
) {
    context.subscriptions.push(
        // Toggle extension activation
        vscode.commands.registerCommand('ai-coding-tutor.toggleActivation', () => {
            state.setActive(!state.isActive);
            
            // Update status bar item
            state.updateStatusBarItem();
            
            // Update context for menus
            vscode.commands.executeCommand('setContext', 'aiCodingTutor.isActive', state.isActive);
            
            // Show feedback message
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
        
        // Clear chat history
        vscode.commands.registerCommand('ai-coding-tutor.clearChatHistory', () => {
            state.chatHistory.length = 0;
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            vscode.window.showInformationMessage('Chat history cleared');
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
            
            // First show the chat view
            await state.chatViewProvider.showView();
            
            // Now directly send the query through the appropriate method
            // This will bypass any webview message communication
            const chatView = state.chatViewProvider;
            
            // Get code context from active editor
            const editor = vscode.window.activeTextEditor;
            let codeContext = '';
            
            if (editor && !editor.selection.isEmpty) {
                codeContext = editor.document.getText(editor.selection);
            }
            
            // Add user message directly to chat history
            const userMessage: ChatMessage = {
                role: 'user',
                content: query,
                timestamp: Date.now(),
                codeContext
            };
            
            state.chatHistory.push(userMessage);
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            
            // Call the method directly
            if (typeof chatView._sendQuestion === 'function') {
                try {
                    console.log('Directly calling _sendQuestion method');
                    await chatView._sendQuestion(query);
                } catch (error) {
                    console.error('Error calling _sendQuestion directly:', error);
                    handleQueryError(error, state);
                }
            } else {
                // If _sendQuestion is not available (should not happen with our implementation)
                console.error('_sendQuestion method not found on ChatViewProvider');
                vscode.window.showErrorMessage('Could not send query to AI, internal error.');
            }
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
                editor.setDecorations(vscode.workspace.getConfiguration('aiCodingTutor').get('showInlineDecorations', true) ? vscode.window.createTextEditorDecorationType({}) : vscode.window.createTextEditorDecorationType({}), [{ range: highlightRange }]);
                
                // Create QuickPick for more visually appealing UI
                const quickPick = vscode.window.createQuickPick<AcceptRejectItem>();
                quickPick.title = 'AI Suggestion';
                quickPick.placeholder = 'Review the suggested changes';
                
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
                        editor.setDecorations(vscode.workspace.getConfiguration('aiCodingTutor').get('showInlineDecorations', true) ? vscode.window.createTextEditorDecorationType({}) : vscode.window.createTextEditorDecorationType({}), []);
                    } else if (selectedItem.action === 'accept') {
                        // Send positive feedback
                        const queryId = state.suggestionQueryIds.get(lineNumber);
                        if (queryId) {
                            await sendFeedbackToBackend(queryId, true);
                            state.suggestionQueryIds.delete(lineNumber);
                        }
                        
                        // Clear decoration since it's now accepted
                        editor.setDecorations(vscode.workspace.getConfiguration('aiCodingTutor').get('showInlineDecorations', true) ? vscode.window.createTextEditorDecorationType({}) : vscode.window.createTextEditorDecorationType({}), []);
                        
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
                        editor.setDecorations(vscode.workspace.getConfiguration('aiCodingTutor').get('showInlineDecorations', true) ? vscode.window.createTextEditorDecorationType({}) : vscode.window.createTextEditorDecorationType({}), []);
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
        
        // Clear suggestions
        vscode.commands.registerCommand('ai-coding-tutor.clearSuggestions', () => {
            state.suggestionProvider.updateSuggestions([]);
            state.codeLensEmitter.fire();
            clearAllDecorations();
            vscode.window.showInformationMessage('Suggestions cleared');
        }),
        
        // Explain selected code
        vscode.commands.registerCommand('ai-coding-tutor.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.selection.isEmpty) {
                vscode.window.showInformationMessage('Please select code to explain');
                return;
            }
            
            if (!state.isActive) {
                vscode.window.showWarningMessage('AI Coding Tutor is currently disabled. Enable it first.');
                return;
            }
            
            const selectedCode = editor.document.getText(editor.selection);
            const fileName = path.basename(editor.document.uri.fsPath);
            const language = editor.document.languageId;
            
            // Create a detailed query with context
            const query = `Explain this ${language} code from ${fileName}:\n\n\`\`\`${language}\n${selectedCode}\n\`\`\`\n\nProvide a clear, detailed explanation at ${state.proficiency} level.`;
            
            // Add user message to chat
            state.chatHistory.push({
                role: 'user',
                content: `Explain this code:\n\`\`\`${language}\n${selectedCode}\n\`\`\``,
                timestamp: Date.now()
            });
            
            // 1. First update chat UI
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            
            // 2. Set loading state
            state.chatViewProvider.setLoading(true);
            
            // 3. Show the chat view and make sure it's focused BEFORE sending request
            try {
                console.log("Showing chat view before explain code query");
                await state.chatViewProvider.showView();
            } catch (error) {
                console.error("Failed to show chat view before explain code query:", error);
            }
            
            // Show progress indicator
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "AI Coding Tutor",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Analyzing code..." });
                
                try {
                    const { id, response } = await fetchQueryResponse(query, state.proficiency);
                    
                    // Add AI response to chat
                    state.chatHistory.push({
                        role: 'assistant',
                        content: response,
                        timestamp: Date.now()
                    });
                    
                    // Update chat
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                    
                    // Turn off loading state
                    state.chatViewProvider.setLoading(false);
                    
                    // Show the chat view AFTER receiving response
                    try {
                        console.log("Showing chat view after explain code response");
                        await state.chatViewProvider.showView();
                    } catch (error) {
                        console.error("Failed to show chat view after explain code response:", error);
                    }
                    
                    // Show feedback options
                    const feedbackOptions = ['👍 Helpful', '👎 Not Helpful'];
                    vscode.window.showInformationMessage(
                        `Explanation received`,
                        ...feedbackOptions
                    ).then(async (feedback) => {
                        if (feedback) {
                            const isPositive = feedback === '👍 Helpful';
                            await sendFeedbackToBackend(id, isPositive);
                        }
                    });
                } catch (error) {
                    handleQueryError(error, state);
                } finally {
                    // Always turn off loading state
                    state.chatViewProvider.setLoading(false);
                }
            });
        }),
        
        // Optimize selected code
        vscode.commands.registerCommand('ai-coding-tutor.optimizeCode', async () => {
            if (!state.isActive) {
                vscode.window.showWarningMessage('AI Coding Tutor is currently disabled. Enable it first.');
                return;
            }
            
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.selection.isEmpty) {
                vscode.window.showInformationMessage('Please select code to optimize');
                return;
            }
            
            const selectedCode = editor.document.getText(editor.selection);
            const fileName = path.basename(editor.document.uri.fsPath);
            const language = editor.document.languageId;
            
            // Create optimization-focused query
            const query = `Optimize this ${language} code from ${fileName} for performance and readability:\n\n\`\`\`${language}\n${selectedCode}\n\`\`\`\n\nProvide a specifically optimized version with explanation of improvements.`;
            
            // Add user message to chat
            state.chatHistory.push({
                role: 'user',
                content: `Optimize this code:\n\`\`\`${language}\n${selectedCode}\n\`\`\``,
                timestamp: Date.now()
            });
            
            // 1. First update chat UI
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            
            // 2. Set loading state
            state.chatViewProvider.setLoading(true);
            
            // 3. Show the chat view and make sure it's focused BEFORE sending request
            try {
                console.log("Showing chat view before optimize code query");
                await state.chatViewProvider.showView();
            } catch (error) {
                console.error("Failed to show chat view before optimize code query:", error);
            }
            
            // Show progress indicator
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "AI Coding Tutor",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Optimizing code..." });
                
                try {
                    const { id, response } = await fetchQueryResponse(query, state.proficiency);
                    
                    // Parse the response to extract code blocks
                    const parsedResponse = await parseResponseForCodeChanges(response, editor);
                    
                    // Add AI response to chat
                    state.chatHistory.push({
                        role: 'assistant',
                        content: response,
                        timestamp: Date.now()
                    });
                    
                    // Update chat
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                    
                    // Turn off loading state
                    state.chatViewProvider.setLoading(false);
                    
                    // Show the chat view AFTER receiving response
                    try {
                        console.log("Showing chat view after optimize code response");
                        await state.chatViewProvider.showView();
                    } catch (error) {
                        console.error("Failed to show chat view after optimize code response:", error);
                    }
                    
                    // If there are code changes, display them inline
                    if (parsedResponse.codeChanges && parsedResponse.codeChanges.length > 0) {
                        await showCodeChangeSuggestions(editor, parsedResponse.codeChanges);
                    }
                    
                    // Show feedback options
                    const feedbackOptions = ['👍 Helpful', '👎 Not Helpful'];
                    vscode.window.showInformationMessage(
                        `Optimization suggestions received`,
                        ...feedbackOptions
                    ).then(async (feedback) => {
                        if (feedback) {
                            const isPositive = feedback === '👍 Helpful';
                            await sendFeedbackToBackend(id, isPositive);
                        }
                    });
                } catch (error) {
                    handleQueryError(error, state);
                } finally {
                    // Always turn off loading state
                    state.chatViewProvider.setLoading(false);
                }
            });
        }),
        
        // Get code suggestion
        vscode.commands.registerCommand('ai-coding-tutor.getSuggestion', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor found');
                return;
            }
            
            if (!state.isActive) {
                vscode.window.showWarningMessage('AI Coding Tutor is currently disabled. Enable it first.');
                return;
            }
            
            // Get selected text or current line if no selection
            let code: string;
            let range: vscode.Range;
            
            if (editor.selection.isEmpty) {
                // Get the entire structural block (if statement, function, class, etc.)
                const document = editor.document;
                const position = editor.selection.active;
                const lineNumber = position.line;
                
                // Find structural element and its scope
                const {startLine, endLine} = findStructuralBlock(document, lineNumber);
                range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
                code = document.getText(range);
            } else {
                range = editor.selection;
                code = editor.document.getText(range);
            }
            
            if (!code.trim()) {
                vscode.window.showInformationMessage('No code selected or cursor not in a valid code block');
                return;
            }
            
            const fileName = path.basename(editor.document.uri.fsPath);
            const language = editor.document.languageId;
            
            // Create a detailed suggestion request
            const query = `Suggest improvements for this ${language} code from ${fileName}:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide specific, actionable improvements focusing on:
1. Code quality and best practices
2. Performance optimization
3. Readability and maintainability
4. Potential bugs or edge cases`;
            
            // Add user message to chat
            state.chatHistory.push({
                role: 'user',
                content: `Suggest improvements for this code:\n\`\`\`${language}\n${code}\n\`\`\``,
                timestamp: Date.now()
            });
            
            // 1. First update chat UI
            state.chatViewProvider.update(state.chatHistory);
            state.updateChatHistory(state.chatHistory);
            
            // 2. Set loading state
            state.chatViewProvider.setLoading(true);
            
            // 3. Show the chat view and make sure it's focused BEFORE sending request
            try {
                console.log("Showing chat view before get suggestion query");
                await state.chatViewProvider.showView();
            } catch (error) {
                console.error("Failed to show chat view before get suggestion query:", error);
            }
            
            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "AI Coding Tutor",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Analyzing code..." });
                
                try {
                    const { id, response } = await fetchQueryResponse(query, state.proficiency);
                    
                    // Store the query ID for feedback
                    if (state.suggestionQueryIds && range.start.line >= 0) {
                        state.suggestionQueryIds.set(range.start.line, id);
                    }
                    
                    // Parse the response to extract code blocks
                    const parsedResponse = await parseResponseForCodeChanges(response, editor);
                    
                    // Add AI response to chat
                    state.chatHistory.push({
                        role: 'assistant',
                        content: response,
                        timestamp: Date.now()
                    });
                    
                    // Update chat
                    state.chatViewProvider.update(state.chatHistory);
                    state.updateChatHistory(state.chatHistory);
                    
                    // Turn off loading state
                    state.chatViewProvider.setLoading(false);
                    
                    // Show the chat view AFTER receiving response
                    try {
                        console.log("Showing chat view after get suggestion response");
                        await state.chatViewProvider.showView();
                    } catch (error) {
                        console.error("Failed to show chat view after get suggestion response:", error);
                    }
                    
                    // If there are code changes, display them inline
                    if (parsedResponse.codeChanges && parsedResponse.codeChanges.length > 0) {
                        await showCodeChangeSuggestions(editor, parsedResponse.codeChanges);
                    }
                    
                    // Show feedback options
                    const feedbackOptions = ['👍 Helpful', '👎 Not Helpful'];
                    vscode.window.showInformationMessage(
                        `Suggestions received`,
                        ...feedbackOptions
                    ).then(async (feedback) => {
                        if (feedback) {
                            const isPositive = feedback === '👍 Helpful';
                            await sendFeedbackToBackend(id, isPositive);
                        }
                    });
                } catch (error) {
                    handleQueryError(error, state);
                } finally {
                    // Always turn off loading state
                    state.chatViewProvider.setLoading(false);
                }
            });
        }),
        
        // Export chat history
        vscode.commands.registerCommand('ai-coding-tutor.exportChatHistory', async () => {
            if (state.chatHistory.length === 0) {
                vscode.window.showInformationMessage('No chat history to export');
                return;
            }
            
            try {
                const historyText = state.chatHistory.map(msg => {
                    const role = msg.role === 'user' ? '# User' : '# AI Tutor';
                    const time = new Date(msg.timestamp).toLocaleString();
                    return `${role} (${time})\n\n${msg.content}\n\n---\n\n`;
                }).join('');
                
                const filename = `ai-tutor-chat-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.md`;
                
                // Ask the user where to save the file
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(filename),
                    filters: {
                        'Markdown': ['md']
                    }
                });
                
                if (uri) {
                    // Write the file
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(historyText));
                    vscode.window.showInformationMessage(`Chat history exported to ${uri.fsPath}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // Show tutorial
        vscode.commands.registerCommand('ai-coding-tutor.showTutorial', () => {
            // Create and show webview panel for tutorial
            const panel = vscode.window.createWebviewPanel(
                'aiCodingTutorTutorial',
                'AI Coding Tutor Tutorial',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );
            
            panel.webview.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AI Coding Tutor Tutorial</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 20px;
                        line-height: 1.5;
                    }
                    h1, h2, h3 {
                        color: var(--vscode-editor-foreground);
                    }
                    .feature {
                        margin-bottom: 30px;
                    }
                    code {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 2px 5px;
                        border-radius: 3px;
                        font-family: var(--vscode-editor-font-family);
                    }
                    img {
                        max-width: 100%;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 5px;
                        margin: 10px 0;
                    }
                    .tip {
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 10px;
                        border-left: 3px solid var(--vscode-button-background);
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <h1>AI Coding Tutor Tutorial</h1>
                
                <p>Welcome to AI Coding Tutor! This extension helps you learn and improve your coding skills with personalized AI assistance.</p>
                
                <div class="feature">
                    <h2>1. Asking Questions</h2>
                    <p>Use the chat interface to ask any coding question:</p>
                    <ol>
                        <li>Click on the "AI Coding Tutor" icon in the Activity Bar</li>
                        <li>Select the "Ask Questions" panel</li>
                        <li>Type your question and press Enter or click Send</li>
                    </ol>
                    <div class="tip">
                        <strong>Tip:</strong> The AI takes into account your current file context to provide better answers.
                    </div>
                </div>
                
                <div class="feature">
                    <h2>2. Code Analysis</h2>
                    <p>Get suggestions for improving your code:</p>
                    <ol>
                        <li>Open a file you want to analyze</li>
                        <li>Click "Analyze Current File" in the sidebar</li>
                        <li>Review the suggestions that appear as CodeLens above your code</li>
                    </ol>
                </div>
                
                <div class="feature">
                    <h2>3. Right-Click Options</h2>
                    <p>Use the context menu to get specific help:</p>
                    <ol>
                        <li>Select a block of code</li>
                        <li>Right-click and choose one of the AI Tutor options:
                            <ul>
                                <li>"Explain Selected Code" - Get an explanation of what the code does</li>
                                <li>"Optimize Selected Code" - Get suggestions for improving the code</li>
                                <li>"Get Code Suggestion" - Get general improvement tips</li>
                            </ul>
                        </li>
                    </ol>
                </div>
                
                <div class="feature">
                    <h2>4. Proficiency Level</h2>
                    <p>Set your proficiency level to get explanations at the right depth:</p>
                    <ol>
                        <li>Click on "Proficiency Level" in the sidebar</li>
                        <li>Choose between Novice, Medium, or Expert</li>
                    </ol>
                    <div class="tip">
                        <strong>Tip:</strong> Novice provides simpler explanations, while Expert gives more technical details.
                    </div>
                </div>
                
                <div class="feature">
                    <h2>5. Additional Features</h2>
                    <ul>
                        <li>Use the "Copy" button in chat responses to copy text</li>
                        <li>Click "Apply Code" to insert code suggestions directly into your editor</li>
                        <li>Export your chat history using the "Export Chat History" option</li>
                        <li>Provide feedback for AI responses to help improve future suggestions</li>
                    </ul>
                </div>
                
                <p>That's it! Start exploring the features and enjoy learning with AI Coding Tutor!</p>
            </body>
            </html>`;
        })
    );
} 