/**
 * State management for the AI Coding Tutor extension
 */

import * as vscode from 'vscode';
import { ExtensionState } from '../types';
import { AiTutorTreeDataProvider } from '../views/treeView';

/**
 * Central state manager to handle extension state
 */
export class StateManager {
    private _isActive: boolean;
    private _proficiency: string;
    private _statusBarItem: vscode.StatusBarItem;
    private _treeDataProvider: AiTutorTreeDataProvider;
    private _context: vscode.ExtensionContext;
    
    constructor(
        initialActive: boolean,
        initialProficiency: string,
        statusBarItem: vscode.StatusBarItem,
        treeDataProvider: AiTutorTreeDataProvider,
        context: vscode.ExtensionContext
    ) {
        this._isActive = initialActive;
        this._proficiency = initialProficiency;
        this._statusBarItem = statusBarItem;
        this._treeDataProvider = treeDataProvider;
        this._context = context;
        
        // Initial setup
        this.updateStatusBar();
        this.updateContext();
    }
    
    public get isActive(): boolean {
        return this._isActive;
    }
    
    public get proficiency(): string {
        return this._proficiency;
    }
    
    public async setActive(value: boolean): Promise<void> {
        console.log(`Setting AI Coding Tutor active state to: ${value}`);
        
        if (this._isActive === value) {
            console.log('Active state unchanged, skipping update');
            return;
        }
        
        this._isActive = value;
        
        // Update everything that depends on active state
        try {
            // First update global state for persistence
            await this._context.globalState.update('ai-coding-tutor.isActive', value);
            
            // Then update UI and context
            this.updateStatusBar();
            await this.updateContext();
            this._treeDataProvider.refresh();
            
            // Log success
            console.log(`AI Coding Tutor active state updated: ${value}`);
        } catch (error) {
            console.error('Error updating active state:', error);
            vscode.window.showErrorMessage(`Failed to update AI Coding Tutor state: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    public async setProficiency(value: string): Promise<void> {
        if (this._proficiency === value) {
            return;
        }
        
        this._proficiency = value;
        
        try {
            await this._context.globalState.update('ai-coding-tutor.proficiency', value);
            this.updateStatusBar();
            this._treeDataProvider.refresh();
        } catch (error) {
            console.error('Error updating proficiency:', error);
            vscode.window.showErrorMessage(`Failed to update proficiency level: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    public updateStatusBar(): void {
        if (this._isActive) {
            this._statusBarItem.text = `$(mortar-board) AI Tutor: ${this._proficiency}`;
            this._statusBarItem.tooltip = `AI Coding Tutor is active (${this._proficiency} level)`;
            this._statusBarItem.backgroundColor = undefined;
        } else {
            this._statusBarItem.text = `$(circle-slash) AI Tutor`;
            this._statusBarItem.tooltip = `AI Coding Tutor is inactive`;
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        this._statusBarItem.command = 'ai-coding-tutor.toggleActivation';
        this._statusBarItem.show();
    }
    
    private async updateContext(): Promise<void> {
        await vscode.commands.executeCommand('setContext', 'aiCodingTutor.isActive', this._isActive);
        console.log(`Context updated: aiCodingTutor.isActive = ${this._isActive}`);
    }
    
    /**
     * Handle errors in a centralized way
     */
    public handleError(error: any, operation: string): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error during ${operation}:`, error);
        vscode.window.showErrorMessage(`AI Coding Tutor: ${operation} failed - ${errorMessage}`);
    }
} 