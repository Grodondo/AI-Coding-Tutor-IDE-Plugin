import type { Route } from "./+types/home";
import { useContext } from 'react';
import { Link } from 'react-router';
import { FiMessageSquare, FiSettings, FiUser } from 'react-icons/fi';
import { AuthContext } from '~/context/AuthContext';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AI Coding Tutor" },
    { name: "description", content: "Interactive AI Coding Assistant" },
  ];
}

// Landing page component for non-authenticated users
function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-32 right-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-32 left-32 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Custom navbar for landing page */}
      <nav className="relative z-10 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold text-white">
            AI<span className="text-blue-400">Tutor</span>
          </div>
          <div className="flex gap-4">
            <Link
              to="/auth/login"
              className="px-6 py-2 text-white border border-white/30 rounded-full hover:bg-white/10 transition-all duration-300"
            >
              Sign In
            </Link>
            <Link
              to="/auth/register"
              className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-8 leading-tight">
            Your AI-Powered
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Coding Tutor
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Transform your programming journey with intelligent assistance. Get instant help,
            debug complex issues, and master coding concepts with our advanced AI companion.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
            <Link
              to="/auth/register"
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-lg shadow-2xl transform hover:scale-105"
            >
              Start Learning Now
            </Link>
            <Link
              to="/about"
              className="px-10 py-4 border-2 border-white/30 text-white rounded-full hover:bg-white/10 transition-all duration-300 font-semibold text-lg backdrop-blur-sm"
            >
              Discover Features
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="text-5xl mb-6">⚡</div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Instant Solutions
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Get immediate answers to coding questions and debug complex problems with context-aware AI assistance that understands your specific needs.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="text-5xl mb-6">🎯</div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Adaptive Learning
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Personalized responses that adapt to your skill level, providing beginner-friendly explanations or advanced technical insights as needed.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="text-5xl mb-6">🚀</div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Advanced AI Models
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Powered by cutting-edge AI technology to provide accurate, contextual programming assistance across multiple languages and frameworks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="relative z-10 text-center py-16 border-t border-white/10">
        <p className="text-gray-400 mb-4">Join thousands of developers already improving their skills</p>
        <div className="flex justify-center gap-8 text-gray-500">
          <span>🔒 Secure & Private</span>
          <span>📱 Cross-Platform</span>
          <span>⭐ Trusted by Developers</span>
        </div>
      </div>
    </div>
  );
}

// Admin dashboard component
function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Admin Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Manage AI models, user accounts, and system configuration from your centralized control panel
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Link
            to="/admin/settings"
            className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transform hover:-translate-y-2"
          >
            <div className="flex items-center mb-6">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                <FiSettings className="text-3xl text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white ml-4">
                AI Settings
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Configure AI models, API keys, prompts, and temperature settings for different services.
            </p>
            <div className="text-blue-600 dark:text-blue-400 font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300">
              Manage AI Configuration →
            </div>
          </Link>

          <Link
            to="/admin/users"
            className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 transform hover:-translate-y-2"
          >
            <div className="flex items-center mb-6">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                <FiUser className="text-3xl text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white ml-4">
                User Management
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              View and manage user accounts, roles, permissions, and access control settings.
            </p>
            <div className="text-green-600 dark:text-green-400 font-semibold group-hover:text-green-700 dark:group-hover:text-green-300">
              Manage Users →
            </div>
          </Link>

          <Link
            to="/chat"
            className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transform hover:-translate-y-2"
          >
            <div className="flex items-center mb-6">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                <FiMessageSquare className="text-3xl text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white ml-4">
                AI Chat
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Test and interact with AI models using the chat interface for development and testing.
            </p>
            <div className="text-purple-600 dark:text-purple-400 font-semibold group-hover:text-purple-700 dark:group-hover:text-purple-300">
              Open Chat Interface →
            </div>
          </Link>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-75">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-xl">
                <FiMessageSquare className="text-3xl text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white ml-4">
                Analytics
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Monitor chat usage, popular queries, system performance metrics, and usage statistics.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Coming Soon</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-75">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-xl">
                <FiSettings className="text-3xl text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white ml-4">
                System Settings
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Configure system-wide settings, security options, and application preferences.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Coming Soon</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-75">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-xl">
                <FiUser className="text-3xl text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white ml-4">
                API Management
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Manage API keys, rate limiting, and external service integrations for the platform.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple dashboard for regular users
function UserDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            AI Coding Tutor
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Get personalized coding assistance with our AI-powered tutor
          </p>
        </div>

        <div className="flex justify-center">
          <div className="max-w-md w-full">
            <Link
              to="/chat"
              className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transform hover:-translate-y-2 block text-center"
            >
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-xl group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <FiMessageSquare className="text-4xl text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                AI Chat
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                Start a conversation with our AI coding tutor. Get help with coding questions, debugging, best practices, and more.
              </p>
              <div className="text-purple-600 dark:text-purple-400 font-semibold group-hover:text-purple-700 dark:group-hover:text-purple-300">
                Start Chatting →
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component with authentication flow
export default function Home() {
  const { user } = useContext(AuthContext);

  // Show landing page for non-authenticated users
  if (!user) {
    return <LandingPage />;
  }
  // Show admin dashboard for admin and superadmin users
  if (user.role === 'admin' || user.role === 'superadmin') {
    return <AdminDashboard />;
  }

  // Show user dashboard for regular users
  return <UserDashboard />;
}