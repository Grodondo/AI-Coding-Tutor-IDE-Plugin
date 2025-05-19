/**
 * Tree view implementation for the AI Coding Tutor sidebar
 */

import * as vscode from 'vscode';

/**
 * Tree view provider for the sidebar menu
 */
export class AiTutorTreeDataProvider implements vscode.TreeDataProvider<AiTutorTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AiTutorTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private getState: () => { isActive: boolean; proficiency: string };

    constructor(getState: () => { isActive: boolean; proficiency: string }) {
        this.getState = getState;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AiTutorTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AiTutorTreeItem): AiTutorTreeItem[] {
        const { isActive, proficiency } = this.getState();
        
        // If this is a category item, return its children
        if (element && element.contextValue === 'category') {
            switch (element.id) {
                case 'settings':
                    return [
                        new AiTutorTreeItem(
                            `Status: ${isActive ? 'Active' : 'Inactive'}`,
                            'ai-coding-tutor.toggleActivation',
                            {
                                icon: isActive ? 'check' : 'circle-slash',
                                description: isActive ? 'Enabled' : 'Disabled',
                                tooltip: `Click to ${isActive ? 'disable' : 'enable'} AI Coding Tutor`,
                                contextValue: 'setting'
                            }
                        ),
                        new AiTutorTreeItem(
                            `Proficiency Level`,
                            'ai-coding-tutor.selectLevel',
                            {
                                icon: 'mortar-board',
                                description: proficiency.charAt(0).toUpperCase() + proficiency.slice(1),
                                tooltip: 'Change your proficiency level to adjust AI explanations',
                                contextValue: 'setting'
                            }
                        )
                    ];
                case 'actions':
                    return [
                        new AiTutorTreeItem(
                            'Ask a Question',
                            'ai-coding-tutor.askQuery',
                            {
                                icon: 'comment-discussion',
                                tooltip: 'Ask the AI tutor a question about your code',
                                contextValue: 'action'
                            }
                        ),
                        new AiTutorTreeItem(
                            'Analyze Current File',
                            'ai-coding-tutor.analyzeCode',
                            {
                                icon: 'microscope',
                                tooltip: 'Analyze the current file for suggestions',
                                contextValue: 'action'
                            }
                        ),
                        new AiTutorTreeItem(
                            'Clear Suggestions',
                            'ai-coding-tutor.clearSuggestions',
                            {
                                icon: 'clear-all',
                                tooltip: 'Clear all current suggestions',
                                contextValue: 'action'
                            }
                        ),
                        new AiTutorTreeItem(
                            'Export Chat History',
                            'ai-coding-tutor.exportChatHistory',
                            {
                                icon: 'save-all',
                                tooltip: 'Export your conversation history as markdown',
                                contextValue: 'action'
                            }
                        )
                    ];
                case 'help':
                    return [
                        new AiTutorTreeItem(
                            'View Tutorial',
                            'ai-coding-tutor.showTutorial',
                            {
                                icon: 'book',
                                tooltip: 'Open the tutorial to learn how to use AI Coding Tutor',
                                contextValue: 'help'
                            }
                        )
                    ];
                default:
                    return [];
            }
        }
        
        // Root level - return categories
        return [
            new AiTutorTreeItem(
                'Settings',
                '',
                {
                    id: 'settings',
                    icon: 'gear',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    contextValue: 'category',
                    tooltip: 'Configure AI Coding Tutor settings'
                }
            ),
            new AiTutorTreeItem(
                'Actions',
                '',
                {
                    id: 'actions',
                    icon: 'tools',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    contextValue: 'category',
                    tooltip: 'Available AI Coding Tutor actions'
                }
            ),
            new AiTutorTreeItem(
                'Help',
                '',
                {
                    id: 'help',
                    icon: 'question',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    contextValue: 'category',
                    tooltip: 'Get help with AI Coding Tutor'
                }
            )
        ];
    }
}

/**
 * Tree item for sidebar menu
 */
export class AiTutorTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        commandId: string,
        options?: {
            id?: string;
            icon?: string;
            description?: string;
            tooltip?: string;
            contextValue?: string;
            collapsibleState?: vscode.TreeItemCollapsibleState;
        }
    ) {
        super(
            label, 
            options?.collapsibleState || vscode.TreeItemCollapsibleState.None
        );
        
        if (commandId) {
            this.command = { command: commandId, title: label };
        }
        
        if (options?.icon) {
            this.iconPath = new vscode.ThemeIcon(options.icon);
        }
        
        if (options?.id) {
            this.id = options.id;
        }
        
        if (options?.description) {
            this.description = options.description;
        }
        
        if (options?.tooltip) {
            this.tooltip = options.tooltip;
        }
        
        if (options?.contextValue) {
            this.contextValue = options.contextValue;
        }
    }
} 