import { useContext } from 'react';
import { Link } from 'react-router';
import { AuthContext } from '../context/AuthContext';

export default function About() {
  const { user } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      <div className="max-w-6xl mx-auto py-16 px-4">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            About AI Coding Tutor
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Revolutionizing the way developers learn and code with intelligent, 
            context-aware assistance powered by advanced AI technology.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* What is AI Coding Tutor */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h2 className="text-3xl font-bold">What is AI Coding Tutor?</h2>
            </div>
            <p className="text-lg leading-relaxed text-gray-200">
              AI Coding Tutor is an intelligent VS Code extension that serves as your
              personal programming mentor. It actively monitors your coding in real-time,
              providing smart, context-aware suggestions to help you write better code
              while accelerating your learning journey.
            </p>
          </div>

          {/* Key Features */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center mr-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h2 className="text-3xl font-bold">Key Features</h2>
            </div>
            <ul className="space-y-3 text-lg text-gray-200">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mr-3"></span>
                Real-time code analysis and suggestions
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mr-3"></span>
                Customizable proficiency levels (novice, medium, expert)
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mr-3"></span>
                Context-aware coding assistance
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mr-3"></span>
                Interactive learning experience
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mr-3"></span>
                Best practices recommendations
              </li>
            </ul>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 mb-16">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
              <span className="text-2xl">🔧</span>
            </div>
            <h2 className="text-3xl font-bold">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Code Analysis</h3>
              <p className="text-gray-300">
                Advanced AI analyzes your code in real-time, understanding context and patterns.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Suggestions</h3>
              <p className="text-gray-300">
                Receive tailored suggestions based on your proficiency level and coding style.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📚</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Continuous Learning</h3>
              <p className="text-gray-300">
                Learn best practices and improve your coding skills with every suggestion.
              </p>
            </div>
          </div>
        </div>

        {/* Technology Stack */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 mb-16">
          <div className="flex items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mr-4">
              <span className="text-2xl">🚀</span>
            </div>
            <h2 className="text-3xl font-bold">Technology Stack</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'TypeScript', icon: '🔷' },
              { name: 'React', icon: '⚛️' },
              { name: 'VS Code API', icon: '💻' },
              { name: 'OpenAI GPT', icon: '🧠' },
              { name: 'Node.js', icon: '🟢' },
              { name: 'Remix', icon: '🎵' },
              { name: 'Tailwind CSS', icon: '🎨' },
              { name: 'RESTful APIs', icon: '🌐' }
            ].map((tech, index) => (
              <div key={index} className="text-center p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div className="text-3xl mb-2">{tech.icon}</div>
                <div className="text-sm font-medium">{tech.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        {!user && (
          <div className="text-center">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-xl text-gray-300 mb-8">
                Join thousands of developers who are already coding smarter with AI assistance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/auth/login"
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth/register"
                  className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-semibold rounded-xl hover:from-gray-600 hover:to-gray-700 transform hover:scale-105 transition-all duration-300 shadow-lg border border-gray-600"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-gray-400 mt-16 pt-8 border-t border-white/10">
          <div className="flex items-center justify-center space-x-2 text-lg">
            <span>Version 1.0.0</span>
            <span>•</span>
            <span>Open Source</span>
            <span>•</span>
            <span>Made with ❤️ for developers</span>
          </div>
          <p className="mt-4 text-sm">
            Empowering the next generation of developers with intelligent coding assistance.
          </p>
        </footer>
      </div>
    </div>
  );
}
