/**
 * Type definitions for the AI Coding Tutor extension
 */

import * as vscode from 'vscode';

export interface SuggestionResponse {
    suggestion: string;
    explanation: string;
    documentationLink?: string;
    diff?: string;
}

export interface AnalysisResponse {
    suggestions: { line: number; message: string; explanation?: string; diff?: string }[];
}

export interface QueryResponse {
    id: string;
    response: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    codeContext?: string; // Store code context separately 
    queryId?: string; // ID to associate with feedback
}

export interface CodeChange {
    code: string;
    language: string;
}

export interface ParsedResponse {
    message: string;
    codeChanges?: CodeChange[];
}

export interface CachedIndex {
    filePath: string;
    codeStructure: {
        functions: { name: string; startLine: number; endLine: number }[];
        classes: { name: string; startLine: number; endLine: number }[];
    };
    timestamp: number;
}

/**
 * Accept/reject quickpick item for code suggestions
 */
export interface AcceptRejectQuickPickItem extends vscode.QuickPickItem {
    action: string;
}

/**
 * Main extension state interface
 */
export interface ExtensionState {
    isActive: boolean;
    setActive: (value: boolean) => Promise<void>;
    proficiency: string;
    setProficiency: (value: string) => Promise<void>;
    suggestionCache: Map<string, SuggestionResponse>;
    suggestionProvider: any;
    codeLensEmitter: vscode.EventEmitter<void>;
    chatViewProvider: any;
    indexCache: Map<string, CachedIndex>;
    chatHistory: ChatMessage[];
    suggestionQueryIds: Map<number, string>;
    sessionStartTime: number;
    treeDataProvider: any;
    updateChatHistory: (messages: ChatMessage[]) => void;
    updateStatusBarItem: () => void;
} 