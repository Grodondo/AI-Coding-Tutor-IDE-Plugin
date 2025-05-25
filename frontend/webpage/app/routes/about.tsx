export default function About() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">About AI Coding Tutor</h1>
      
      <div className="space-y-8">
        <section className="bg-white/5 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">What is AI Coding Tutor?</h2>
          <p className="text-lg leading-relaxed">
            AI Coding Tutor is an intelligent VS Code extension that serves as your
            personal programming mentor. It actively monitors your coding in real-time,
            providing smart, context-aware suggestions to help you write better code
            while learning.
          </p>
        </section>

        <section className="bg-white/5 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Key Features</h2>
          <ul className="list-disc list-inside space-y-2 text-lg">
            <li>Real-time code analysis and suggestions</li>
            <li>Customizable proficiency levels (novice, medium, expert)</li>
            <li>Context-aware coding assistance</li>
            <li>Interactive learning experience</li>
            <li>Best practices recommendations</li>
          </ul>
        </section>

        <section className="bg-white/5 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <p className="text-lg leading-relaxed">
            The extension uses advanced AI models to analyze your code in real-time.
            Based on your selected proficiency level, it provides tailored
            suggestions, explanations, and improvements. Whether you're learning
            a new language or optimizing existing code, AI Coding Tutor adapts to
            your needs.
          </p>
        </section>

        <footer className="text-center text-sm text-gray-400 mt-8">
          <p>Version 1.0.0 • Open Source • Made with ❤️</p>
        </footer>
      </div>
    </div>
  );
}
