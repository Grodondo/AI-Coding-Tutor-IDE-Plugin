/**
 * Configuration helper utilities for the AI Coding Tutor extension
 */

import * as vscode from 'vscode';

/**
 * Get a configuration value from vscode settings
 * @param key Configuration key
 * @param defaultValue Default value if not set
 * @returns The configuration value
 */
export function getConfiguration<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('aiCodingTutor');
    return config.get<T>(key, defaultValue);
}

/**
 * Get the backend API URL from configuration
 * @returns Backend URL
 */
export function getBackendUrl(): string {
    return getConfiguration<string>('backendUrl', 'http://localhost:8080');
}

/**
 * Get the user's proficiency level from configuration
 * @returns Proficiency level
 */
export function getProficiencyLevel(): string {
    return getConfiguration<string>('proficiencyLevel', 'medium');
}

/**
 * Check if the extension is enabled
 * @returns True if extension is active
 */
export function isExtensionEnabled(): boolean {
    return getConfiguration<boolean>('enabled', true);
}

/**
 * Check if auto-analysis is enabled
 * @returns True if auto-analysis should run on save
 */
export function shouldAutoAnalyze(): boolean {
    return getConfiguration<boolean>('autoAnalyzeOnSave', false);
}

/**
 * Check if inline decorations should be shown
 * @returns Whether inline decorations should be shown
 */
export function shouldShowInlineDecorations(): boolean {
    return getConfiguration<boolean>('showInlineDecorations', true);
} 