/**
 * Code analysis and manipulation utilities
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodeChange } from '../types';

/**
 * Create decoration for code changes/suggestions
 */
export const suggestedCodeDecorationType = vscode.window.createTextEditorDecorationType({
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

/**
 * Decoration for inline responses
 */
export const aiResponseDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorHint.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em',
        textDecoration: 'none; cursor: pointer;'
    }
});

/**
 * Decoration for inline suggestions
 */
export const inlineSuggestionDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorGhostText.foreground'),
        fontStyle: 'italic',
        margin: '0',
        textDecoration: 'none'
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});

/**
 * Decoration for error highlights
 */
export const errorHighlightDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editorError.background'),
    borderColor: new vscode.ThemeColor('editorError.border'),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '3px'
});

/**
 * Check if a line contains structural code (function, class, control flow, etc.)
 */
export function isStructuralCodeLine(document: vscode.TextDocument, lineNumber: number): boolean {
    if (lineNumber < 0 || lineNumber >= document.lineCount) {
        return false;
    }
    
    const line = document.lineAt(lineNumber).text.trim();
    
    // Check for structural elements in code
    const structuralPatterns = [
        /^(function|class|interface|enum)\s+\w+/,  // Function/class declarations
        /^(if|for|while|switch|try|catch|do)\s*\(/,  // Control flow statements
        /^(public|private|protected)\s+(static\s+)?(async\s+)?\w+/,  // Class methods
        /^export\s+(default\s+)?(function|class|interface|enum)/,  // Exports
        /^import\s+/,  // Imports
        /^const\s+\w+\s*=\s*(function|class|async)/,  // Function expressions
        /^return\s+/   // Return statements
    ];
    
    return structuralPatterns.some(pattern => pattern.test(line));
}

/**
 * Find the next non-empty line from a given line
 */
export function findNextNonEmptyLine(document: vscode.TextDocument, startLine: number): number {
    for (let i = startLine; i < document.lineCount; i++) {
        if (document.lineAt(i).text.trim().length > 0) {
            return i;
        }
    }
    return startLine; // Return the same line if no non-empty line is found
}

/**
 * Clear all decorations across all editors
 */
export function clearAllDecorations() {
    for (const editor of vscode.window.visibleTextEditors) {
        editor.setDecorations(aiResponseDecorationType, []);
        editor.setDecorations(inlineSuggestionDecorationType, []);
        editor.setDecorations(errorHighlightDecorationType, []);
        editor.setDecorations(suggestedCodeDecorationType, []);
    }
}

/**
 * Helper function to extract imports from code
 */
export function extractImports(code: string, language: string): string[] {
    const imports: string[] = [];
    
    try {
        switch (language) {
            case 'typescript':
            case 'javascript':
                // Extract import statements
                const importRegex = /import\s+.*?from\s+['"](.+?)['"];?/g;
                let match;
                while ((match = importRegex.exec(code)) !== null) {
                    imports.push(match[1]);
                }
                break;
            case 'python':
                // Extract import and from statements
                const pythonImportRegex = /(?:import|from)\s+([^\s]+)/g;
                while ((match = pythonImportRegex.exec(code)) !== null) {
                    imports.push(match[1]);
                }
                break;
            case 'java':
            case 'csharp':
            case 'c':
            case 'cpp':
                // Extract import/using/include statements
                const otherImportRegex = /(?:import|using|#include)\s+['<"]?([^'"<>]*)['">]?/g;
                while ((match = otherImportRegex.exec(code)) !== null) {
                    imports.push(match[1]);
                }
                break;
        }
    } catch (error) {
        console.error('Error extracting imports:', error);
    }
    
    return imports;
}

/**
 * Helper to truncate large text to avoid payload size issues
 */
export function truncateIfNeeded(text: string, maxLength = 10000): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '\n\n[Content truncated due to size...]';
}

/**
 * Parse AI response for code changes
 */
export async function parseResponseForCodeChanges(response: string, editor?: vscode.TextEditor): Promise<{ message: string, codeChanges?: CodeChange[] }> {
    const codeChanges: CodeChange[] = [];
    let message = response;
    
    try {
        // Extract code blocks with language tags
        const codeBlockRegex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
        let match;
        
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1].trim() || (editor ? editor.document.languageId : 'plaintext');
            const code = match[2].trim();
            
            if (code) {
                codeChanges.push({
                    code,
                    language
                });
            }
        }
    } catch (error) {
        console.error('Error parsing code blocks from response:', error);
    }
    
    return {
        message,
        codeChanges: codeChanges.length ? codeChanges : undefined
    };
}

/**
 * Show code change suggestions in the editor
 */
export async function showCodeChangeSuggestions(editor: vscode.TextEditor, codeChanges: CodeChange[]) {
    if (!codeChanges.length || !editor) {
        return;
    }
    
    // Create quickpick for suggestions
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'AI Suggested Code Changes';
    quickPick.placeholder = 'Select a suggestion to apply';
    
    const items = codeChanges.map((change, index) => ({
        label: `Suggestion #${index + 1}`,
        description: `${change.language} (${change.code.split('\n').length} lines)`,
        detail: change.code.split('\n').slice(0, 3).join('\n') + (change.code.split('\n').length > 3 ? '...' : ''),
        change
    }));
    
    quickPick.items = items;
    
    quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0] as any;
        quickPick.hide();
        
        if (selected && selected.change) {
            // If selection exists in editor, replace it
            if (!editor.selection.isEmpty) {
                await editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, selected.change.code);
                });
                vscode.window.showInformationMessage('AI suggestion applied');
            } else {
                // Copy to clipboard if no selection
                await vscode.env.clipboard.writeText(selected.change.code);
                vscode.window.showInformationMessage('Code copied to clipboard');
            }
        }
    });
    
    quickPick.show();
}

/**
 * Find structural block (if statement, function, class, etc.) around a given line
 */
export function findStructuralBlock(document: vscode.TextDocument, lineNumber: number): {startLine: number, endLine: number} {
    let startLine = lineNumber;
    let endLine = lineNumber;
    const maxLines = document.lineCount - 1;
    
    // First, try to find the start of the structural block by looking backwards
    while (startLine > 0) {
        const line = document.lineAt(startLine).text.trim();
        // Check for block starters like if, function, class, etc.
        if (isBlockStart(line) && startLine !== lineNumber) {
            break; // Found the start of a different block
        }
        
        // If we're on a statement separator like semicolon and not inside a braced block
        // this might be a single line statement or expression
        if (line.endsWith(';') && !line.includes('{') && startLine !== lineNumber) {
            startLine++; // Move back down since we've gone too far
            break;
        }
        
        // If we find an opening brace, this might be the start of our block
        if (line.includes('{')) {
            // Found the start, now look for a function/class/if declaration
            let potentialStart = startLine;
            while (potentialStart > 0) {
                const declarationLine = document.lineAt(potentialStart).text.trim();
                if (isStructuralCodeLine(document, potentialStart)) {
                    startLine = potentialStart;
                    break;
                }
                // If we hit another closing brace, we've gone too far
                if (declarationLine.includes('}')) {
                    break;
                }
                potentialStart--;
            }
            break;
        }
        
        startLine--;
    }
    
    // Then, try to find the end of the block
    let braceBalance = 0;
    let inBlock = false;
    
    for (let i = startLine; i <= maxLines; i++) {
        const line = document.lineAt(i).text.trim();
        
        // Count opening and closing braces
        for (const char of line) {
            if (char === '{') {
                braceBalance++;
                inBlock = true;
            } else if (char === '}') {
                braceBalance--;
                // If braces are balanced and we were in a block, we've found the end
                if (braceBalance === 0 && inBlock) {
                    endLine = i;
                    return { startLine, endLine };
                }
            }
        }
        
        // For languages like Python that use indentation
        if (!inBlock && i > startLine) {
            const currentIndent = document.lineAt(i).firstNonWhitespaceCharacterIndex;
            const startIndent = document.lineAt(startLine).firstNonWhitespaceCharacterIndex;
            
            // If we're back to the same or lower indentation level and on a non-continuation line
            if (currentIndent <= startIndent && !isBlockContinuation(line)) {
                endLine = i - 1;
                return { startLine, endLine };
            }
        }
        
        // For single line statements without braces
        if (!inBlock && i > startLine && line.endsWith(';') && !isBlockContinuation(line)) {
            endLine = i;
            return { startLine, endLine };
        }
    }
    
    // If we couldn't determine the end, use a reasonable range
    return { 
        startLine: Math.max(0, startLine),
        endLine: Math.min(startLine + 20, maxLines) 
    };
}

/**
 * Check if a line is likely to be the start of a block
 */
export function isBlockStart(line: string): boolean {
    // Common patterns that indicate the start of a block
    const patterns = [
        /^(function|class|interface|enum|if|for|while|switch|try)\b/,
        /^(public|private|protected|async)\s+/,
        /^export\s+/,
        /^import\s+/,
        /^const\s+\w+\s*=\s*(function|class|async)/
    ];
    
    return patterns.some(pattern => pattern.test(line));
}

/**
 * Check if a line is likely to be a continuation of a block
 */
export function isBlockContinuation(line: string): boolean {
    // Lines that continue a block rather than start a new one
    const patterns = [
        /^\s*(else|catch|finally|elif|except)\b/,
        /^\s*\.\w+/,  // Method chaining
        /^\s*[|&]{2}/,  // Logical operators at start of line
        /^\s*[+\-*/%<>=!&|^]+/,  // Operators at start of line
        /^[\],})]/  // Closing brackets/braces/parentheses at start of line
    ];
    
    return patterns.some(pattern => pattern.test(line));
} 