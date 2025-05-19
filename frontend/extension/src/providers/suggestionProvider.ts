/**
 * Code suggestion provider for AI code recommendations
 */

import * as vscode from 'vscode';
import { isExtensionEnabled } from '../utils/configUtils';
import { suggestedCodeDecorationType } from '../utils/codeUtils';
import { AcceptRejectQuickPickItem } from '../types';

/**
 * Code lens provider for displaying inline AI suggestions
 */
export class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
    private suggestions: { line: number; message: string; explanation: string; diff?: string }[] = [];

    constructor(private emitter: vscode.EventEmitter<void>) {
        this.onDidChangeCodeLenses = emitter.event;
    }

    onDidChangeCodeLenses?: vscode.Event<void>;

    /**
     * Update the available suggestions 
     */
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

    /**
     * Provide code lenses for the suggestions
     */
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
            }
        }

        return codeLenses;
    }
}

/**
 * Class for Accept/Reject items in the quickpick
 */
export class AcceptRejectItem implements AcceptRejectQuickPickItem {
    label: string;
    description: string;
    action: string;
    iconPath?: vscode.ThemeIcon;
    
    constructor(label: string, description: string, action: string, iconPath?: vscode.ThemeIcon) {
        this.label = label;
        this.description = description;
        this.action = action;
        this.iconPath = iconPath;
    }
}

/**
 * Create loading decoration
 */
export function createLoadingDecoration(lineNumber: number): vscode.DecorationOptions {
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

/**
 * Create response decoration
 */
export function createResponseDecoration(lineNumber: number, response: any): vscode.DecorationOptions {
    // Format the diff for display if available
    let diffDisplay = '';
    if (response.diff) {
        // Extract only added lines for preview
        const addedLines = response.diff
            .split('\n')
            .filter((line: string) => line.startsWith('+') && !line.startsWith('+++'))
            .map((line: string) => line.substring(1))
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