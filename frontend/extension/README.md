# AI Coding Tutor VS Code Extension

The AI Coding Tutor extension integrates an intelligent coding assistant directly into your VS Code environment. It provides real-time code suggestions, answers to coding questions, and code analysis based on your specified proficiency level.

## Features

- **Smart Code Analysis**: Get contextual suggestions and improvements as you code
- **Three Learning Levels**: Choose between novice, medium, or expert explanations based on your skill level
- **Inline Suggestions**: View AI recommendations right next to your code
- **Interactive Q&A**: Ask coding questions through the dedicated chat panel
- **Code Explanations**: Select any snippet and get it explained in detail
- **Code Optimization**: Get suggestions to improve your code's performance and readability
- **Progress Tracking**: View your interaction history and build your knowledge
- **Export Chat History**: Save your learning sessions as Markdown notes for future reference
- **Connection Status**: Visual indicator shows when you're connected to the backend service

## Learning Levels

The AI Coding Tutor adapts to your learning needs with three proficiency levels:

- **Novice**: Simplified explanations focusing on fundamentals with beginner-friendly terms
- **Medium**: Balanced explanations with both concepts and implementation details
- **Expert**: In-depth technical knowledge with advanced patterns and optimizations

## Usage

### Sidebar Panel

Access the AI Coding Tutor through the sidebar icon:

1. **AI Tutor**: Configure settings and access main features
2. **Ask Questions**: Chat with the AI assistant about coding problems
3. **Learning History**: Review your past queries and interactions

### Getting Code Suggestions

1. **Inline Suggestions**:
   - Right-click on a line of code and select "AI Coding Tutor: Get Suggestion"
   - Or click on the AI suggestion CodeLens that appears above your code

2. **Code Analysis**:
   - Use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "AI Coding Tutor: Analyze Code"
   - Or click "Analyze Current File" in the sidebar

3. **Code Explanation**:
   - Select code you want explained
   - Right-click and choose "AI Coding Tutor: Explain Code"
   - View the detailed explanation in the chat panel

4. **Code Optimization**:
   - Select code you want to optimize
   - Right-click and choose "AI Coding Tutor: Optimize Code"
   - Review optimization suggestions and explanations

### Asking Questions

1. Click on the "Ask Questions" panel in the sidebar
2. Type your coding question and press Enter
3. Optionally select code first to include it as context for your question
4. Review the AI's answer with explanations tailored to your proficiency level

## Commands

Access these commands through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `AI Coding Tutor: Toggle Activation` - Enable or disable the extension
- `AI Coding Tutor: Select Proficiency Level` - Change your learning level
- `AI Coding Tutor: Ask Question` - Ask a coding question to the AI assistant
- `AI Coding Tutor: Analyze Code` - Analyze the current file for improvements
- `AI Coding Tutor: Get Suggestion` - Get suggestion for current line/selection
- `AI Coding Tutor: Explain Code` - Get explanation for selected code
- `AI Coding Tutor: Optimize Code` - Get optimization suggestions for selected code
- `AI Coding Tutor: Clear Suggestions` - Clear all current AI suggestions
- `AI Coding Tutor: Export Chat History` - Save conversation as a Markdown file for your notes

## Extension Settings

This extension contributes the following settings:

* `aiCodingTutor.enable`: Enable/disable the extension
* `aiCodingTutor.proficiencyLevel`: Default proficiency level (novice, medium, expert)
* `aiCodingTutor.backendUrl`: URL of the backend server (default: `http://localhost:8080`)
* `aiCodingTutor.autoAnalyze`: Automatically analyze code on file save
* `aiCodingTutor.showInlineDecorations`: Show inline suggestions in the editor

## Privacy and Security

- Code snippets are sent to the configured backend server for processing
- Only necessary code context is transmitted, not entire files
- Configuration allows control over what is sent to the AI service
- No user data is stored within the extension itself (chat history is stored locally only)

## Requirements

- An active backend server (configured via settings)
- Internet connection for AI processing
- VS Code version 1.60.0 or higher

## Installation

1. Install from the VS Code Marketplace
2. Or install via VSIX file:
   - Download the `.vsix` file from the [releases page](https://github.com/yourusername/AI-Coding-Tutor-IDE-Plugin/releases)
   - Open VS Code
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
   - Type "Install from VSIX" and select the command
   - Choose the downloaded file

## Troubleshooting

If you encounter issues:

1. Check that the backend server is running and accessible
2. Verify the backend URL in the extension settings
3. Check your internet connection
4. Try toggling the extension off and on again
5. Inspect the VS Code "Output" panel for error messages (select "AI Coding Tutor" from the dropdown)

## Contributing

The extension is part of the AI Coding Tutor IDE Plugin project. To contribute:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

See the [repository](https://github.com/yourusername/AI-Coding-Tutor-IDE-Plugin) for more information.

## License

This extension is licensed under the MIT License. See the LICENSE file for details.
