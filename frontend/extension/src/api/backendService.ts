/**
 * Backend API communication services
 */

import * as vscode from 'vscode';
import * as path from 'path';
import fetch from 'node-fetch';
import { AnalysisResponse, QueryResponse, SuggestionResponse } from '../types';
import { getBackendUrl } from '../utils/configUtils';
import { extractImports, truncateIfNeeded } from '../utils/codeUtils';

/**
 * Fetch with retry mechanism for more reliable backend communication
 */
export async function fetchWithRetry(url: string, options: any, retries: number = 3, delay: number = 1000): Promise<any> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const fetchOptions = {
            ...options,
            signal: controller.signal
        };
        
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return response;
        }
        
        throw new Error(`Server responded with status: ${response.status} - ${response.statusText}`);
    } catch (error) {
        if (retries <= 0) {
            throw error;
        }
        
        // Log the retry attempt
        console.log(`Fetch attempt failed, retrying in ${delay}ms... (${retries} retries left)`);
        if (error instanceof Error) {
            console.log(`Error details: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry with exponential backoff
        return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
}

/**
 * Check connection to backend
 */
export async function checkBackendConnection(statusItem: vscode.StatusBarItem): Promise<boolean> {
    try {
        const url = `${getBackendUrl()}/health`;
        
        const response = await fetchWithRetry(url, { 
            method: 'GET'
        }, 1, 1000); // One retry with 1s delay
        
        if (response.ok) {
            statusItem.text = '$(plug) Connected';
            statusItem.tooltip = 'Connected to AI Coding Tutor backend';
            statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
            statusItem.show();
            return true;
        } else {
            throw new Error(`Status: ${response.status}`);
        }
    } catch (error) {
        statusItem.text = '$(warning) Disconnected';
        statusItem.tooltip = `Cannot connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`;
        statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusItem.show();
        return false;
    }
}

/**
 * Get a simplified project structure
 */
export async function getProjectStructure(): Promise<{ name: string, files: string[] } | null> {
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return null;
        }
        
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Get a list of important files
        const importantExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.html', '.css', '.json', '.md'];
        const maxFiles = 50; // Limit number of files to avoid huge payloads
        
        const files: string[] = [];
        
        const collectFiles = async (dir: string, depth = 0) => {
            if (depth > 2 || files.length >= maxFiles) return; // Limit depth and number of files
            
            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
                
                for (const [name, type] of entries) {
                    // Skip node_modules, .git, etc.
                    if (name.startsWith('.') || name === 'node_modules' || name === 'dist') {
                        continue;
                    }
                    
                    const fullPath = path.join(dir, name);
                    
                    if (type === vscode.FileType.Directory) {
                        await collectFiles(fullPath, depth + 1);
                    } else if (type === vscode.FileType.File) {
                        const ext = path.extname(name).toLowerCase();
                        if (importantExtensions.includes(ext)) {
                            // Store relative path from project root
                            const relativePath = path.relative(rootPath, fullPath);
                            files.push(relativePath);
                            
                            if (files.length >= maxFiles) break;
                        }
                    }
                }
            } catch (error) {
                console.error('Error reading directory:', error);
            }
        };
        
        await collectFiles(rootPath);
        
        return {
            name: vscode.workspace.name || path.basename(rootPath),
            files
        };
    } catch (error) {
        console.error('Error getting project structure:', error);
        return null;
    }
}

/**
 * Fetch suggestion for a specific code snippet
 */
export async function fetchSuggestionFromBackend(code: string, proficiency: string): Promise<SuggestionResponse> {
    const url = `${getBackendUrl()}/api/v1/query`;
    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: code, level: proficiency })
        });
        
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
            const testResponse = await fetchWithRetry(testUrl, {}, 1, 1000);
            if (!testResponse.ok) {
                throw new Error('Backend service is not responding properly');
            }
        } catch (connectionError) {
            throw new Error('Cannot connect to the AI Coding Tutor backend. Please check your connection and the backend URL in settings.');
        }
        
        throw error;
    }
}

/**
 * Fetch full code analysis result
 */
export async function fetchFullCodeSuggestions(code: string, proficiency: string, suggestionQueryIds?: Map<number, string>): Promise<{ line: number; message: string; explanation: string; diff?: string }[]> {
    const url = `${getBackendUrl()}/api/v1/analyze`;
    
    // Get active editor for context
    const editor = vscode.window.activeTextEditor;
    const fileContext = editor ? {
        fileName: path.basename(editor.document.uri.fsPath),
        language: editor.document.languageId,
        fileSize: code.length,
        // Include imports to help understand dependencies
        imports: extractImports(code, editor.document.languageId)
    } : {};
    
    try {
        console.log(`Sending code for analysis: ${code.length} chars, context:`, fileContext);
        
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                code, 
                level: proficiency,
                includeLineNumbers: true,
                context: fileContext
            })
        }, 2, 2000); // 2 retries with 2 second initial delay
        
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
                        // Use the query endpoint to get a better suggestion
                        const query = `The following code needs improvement: ${s.message}`;
                        const { id, response } = await fetchQueryResponse(query, proficiency);
                        
                        // Store the query ID for feedback
                        if (suggestionQueryIds && enhancedSuggestion.line !== undefined) {
                            suggestionQueryIds.set(enhancedSuggestion.line, id);
                        }
                        
                        // Create a simple diff format
                        enhancedSuggestion.diff = `+ ${response}\n- ${s.message}`;
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
        
        // Add more specific error messaging
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error('Analysis request timed out. The backend may be processing a large file or be overloaded.');
            } else if (error.message.includes('fetch')) {
                throw new Error('Cannot connect to the AI Coding Tutor backend. Please check your connection and backend URL in settings.');
            }
        }
        
        throw error;
    }
}

/**
 * Send a query to the backend and get a response
 */
export async function fetchQueryResponse(query: string, level: string): Promise<QueryResponse> {
    const url = `${getBackendUrl()}/api/v1/query`;
    
    // Add editor context if available
    const editor = vscode.window.activeTextEditor;
    const editorContext = editor ? {
        fileName: path.basename(editor.document.uri.fsPath),
        language: editor.document.languageId,
        selection: editor.selection.isEmpty ? null : editor.document.getText(editor.selection),
        visibleRange: editor.visibleRanges.length > 0 ? 
            editor.document.getText(editor.visibleRanges[0]) : null,
        projectName: vscode.workspace.name,
        // Add project structure information
        projectStructure: await getProjectStructure(),
        // Add file imports for understanding dependencies
        imports: editor ? extractImports(editor.document.getText(), editor.document.languageId) : [],
        // Current file content (truncated if too large)
        fileContent: editor ? truncateIfNeeded(editor.document.getText()) : '',
        // User's proficiency level
        proficiencyLevel: level
    } : {};
    
    try {
        console.log(`Sending query to ${url} with level=${level}, context:`, editorContext);
        
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query, 
                level,
                context: editorContext
            })
        }, 2, 1000); // 2 retries with 1s delay
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with status: ${response.status}, message: ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log(`Received response with ID: ${responseData?.id || 'unknown'}`);
        
        // Validate response format
        if (!responseData || typeof responseData !== 'object' || !('id' in responseData) || !('response' in responseData)) {
            console.error('Invalid response format:', responseData);
            throw new Error('Invalid response format from backend');
        }
        
        return responseData as QueryResponse;
    } catch (error) {
        console.error(`fetchQueryResponse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Add user-friendly error handling with specific instructions
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error('Query request timed out. The AI may be taking longer than expected to respond.');
            } else if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED') || error.message.includes('CORS')) {
                throw new Error(`Cannot connect to the AI Coding Tutor backend at ${getBackendUrl()}. Please check your connection and backend URL in settings.`);
            } else if (error.message.includes('Invalid response')) {
                throw new Error('Received an invalid response from the backend. The service may be misconfigured.');
            }
        }
        
        throw error;
    }
}

/**
 * Send feedback to the backend for a specific query
 */
export async function sendFeedbackToBackend(queryId: string, isPositive: boolean): Promise<void> {
    if (!queryId) {
        console.log('No queryId provided for feedback, skipping');
        return;
    }

    const url = `${getBackendUrl()}/api/v1/feedback`;
    try {
        console.log(`Sending ${isPositive ? 'positive' : 'negative'} feedback for query ${queryId} to ${url}`);
        
        // Updated payload format to match backend expectations
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query_id: queryId,  // Changed from queryId to query_id
                feedback_type: isPositive ? 'positive' : 'negative'  // Changed from feedback to feedback_type
            })
        }, 2, 500); // Retry twice with short delay for feedback
        
        if (response.ok) {
            console.log(`Feedback sent successfully: ${isPositive ? 'positive' : 'negative'} for query ${queryId}`);
        } else {
            console.error(`Feedback response status: ${response.status}`);
            const errorText = await response.text();
            console.error(`Feedback error response: ${errorText}`);
            throw new Error(`Server responded with status: ${response.status}`);
        }
    } catch (error) {
        console.error(`sendFeedbackToBackend error:`, error);
        
        // Don't throw the error since feedback is non-critical
        vscode.window.showInformationMessage('Could not send feedback, but your response was still processed locally.');
    }
} 