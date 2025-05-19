# AI Coding Tutor

AI Coding Tutor is a VS Code extension that acts as your personal coding mentor. It monitors your coding activity in real-time and offers intelligent, context-aware hints, best practices, and interactive guidance to help you write cleaner, more efficient code while you learn and grow as a developer.

## Features

- **Interactive Chat Interface**: Ask coding questions and receive detailed explanations with context-aware answers
- **Code Analysis**: Get suggestions for improving your code's quality, performance, and readability
- **Contextual Explanations**: Select code and get explanations tailored to your proficiency level
- **Code Optimization**: Get suggestions to optimize your code with explanations of the improvements
- **Smart Suggestions**: Get intelligent code suggestions as you work

## Chat Functionality

The AI Coding Tutor provides a powerful chat interface where you can:

- Ask any coding-related questions
- Get answers that consider your current file context
- Apply suggested code directly to your editor
- Provide feedback on answers to improve the AI's responses
- Export your chat history for later reference

The chat view automatically captures context from your currently open files to provide more relevant answers.

## Getting Started

1. Install the extension from the VS Code marketplace
2. Open a code file or project
3. Click on the AI Coding Tutor icon in the sidebar
4. Start asking questions or use the code analysis features

## Commands

- `AI Coding Tutor: Ask Question` - Open a prompt to ask a coding question
- `AI Coding Tutor: Open Chat` - Open the chat interface (Ctrl+Shift+C / Cmd+Shift+C)
- `AI Coding Tutor: Analyze Current File` - Analyze your current file for suggestions
- `AI Coding Tutor: Explain Selected Code` - Get an explanation of the selected code
- `AI Coding Tutor: Optimize Selected Code` - Get optimization suggestions for selected code
- `AI Coding Tutor: Get Code Suggestion` - Get general suggestions for the current context

## Configuration

- `aiCodingTutor.enabled`: Enable or disable the extension
- `aiCodingTutor.backendUrl`: URL to the AI Coding Tutor backend service
- `aiCodingTutor.proficiencyLevel`: Set your programming proficiency level (novice, medium, expert)
- `aiCodingTutor.autoAnalyzeOnSave`: Automatically analyze code on save
- `aiCodingTutor.showInlineDecorations`: Show inline decorations for AI suggestions

## Keyboard Shortcuts

- `Ctrl+Shift+A` / `Cmd+Shift+A` - Ask a question
- `Ctrl+Shift+C` / `Cmd+Shift+C` - Open chat interface
- `Ctrl+Shift+E` / `Cmd+Shift+E` - Explain selected code
- `Ctrl+Shift+O` / `Cmd+Shift+O` - Optimize selected code

## Requirements

- Visual Studio Code 1.97.0 or higher
- AI Coding Tutor backend service running (defaults to http://localhost:8080)

## Extension Settings

This extension contributes the following settings:

* `aiCodingTutor.enabled`: Enable/disable this extension
* `aiCodingTutor.backendUrl`: URL to the AI backend service
* `aiCodingTutor.proficiencyLevel`: Your programming proficiency level for tailored explanations
* `aiCodingTutor.autoAnalyzeOnSave`: Automatically analyze code on save
* `aiCodingTutor.showInlineDecorations`: Show inline decorations for AI suggestions

## Known Issues

* Initial loading time may vary depending on your backend server performance
* Backend service needs to be running for the extension to work properly

## Release Notes

### 0.0.1

Initial release of AI Coding Tutor
