import type { Route } from "./+types/home";
import { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router';
import { FiSend, FiRefreshCw, FiPlus, FiMessageSquare, FiSettings, FiUser } from 'react-icons/fi';
import { AuthContext } from '~/context/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

interface AIModel {
  provider: string;
  name: string;
  description: string;
}

const MAX_REQUESTS_PER_HOUR = 100;
const MAX_MESSAGE_LENGTH = 2000;
const REQUEST_TRACKING_KEY = 'ai_chat_requests';
const CHATS_STORAGE_KEY = 'ai_chats';

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

// Chat interface component for regular users
function ChatInterface() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [requestsRemaining, setRequestsRemaining] = useState(MAX_REQUESTS_PER_HOUR);

  useEffect(() => {
    // Load chats from localStorage
    const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats);
      if (parsedChats.length > 0) {
        setCurrentChatId(parsedChats[0].id);
      }
    }

    // Fetch available models from the backend
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/v1/settings');
        const data = await response.json();
        // Extract unique models from settings
        const availableModels: AIModel[] = Object.values(data).map((setting: any) => ({
          provider: setting.ai_provider,
          name: setting.ai_model,
          description: `${setting.ai_provider} - ${setting.ai_model}`
        })).filter((model, index, self) =>
          index === self.findIndex(m => m.name === model.name && m.provider === model.provider)
        );
        setModels(availableModels.length > 0 ? availableModels : [
          { provider: 'groq', name: 'llama-3.3-70b-versatile', description: 'Versatile large language model' },
          { provider: 'openai', name: 'gpt-3.5-turbo', description: 'Fast and efficient model' }
        ]);
        setSelectedModel(availableModels.length > 0 ? availableModels[0].name : 'llama-3.3-70b-versatile');
      } catch (error) {
        console.error('Failed to fetch models:', error);
        // Fallback to hardcoded models if fetch fails
        const fallbackModels = [
          { provider: 'groq', name: 'llama-3.3-70b-versatile', description: 'Versatile large language model' },
          { provider: 'openai', name: 'gpt-3.5-turbo', description: 'Fast and efficient model' }
        ];
        setModels(fallbackModels);
        setSelectedModel(fallbackModels[0].name);
      }
    };

    fetchModels();
    loadRequestCount();
  }, []);

  // Save chats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  const createNewChat = () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      lastUpdated: new Date()
    };
    setChats([newChat, ...chats]);
    setCurrentChatId(newChat.id);
  };

  const loadRequestCount = () => {
    const stored = localStorage.getItem(REQUEST_TRACKING_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentRequests = data.requests.filter((timestamp: number) => timestamp > oneHourAgo);
      setRequestsRemaining(Math.max(0, MAX_REQUESTS_PER_HOUR - recentRequests.length));
    }
  };

  const updateRequestCount = () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let data;
    try {
      const stored = localStorage.getItem(REQUEST_TRACKING_KEY);
      data = stored ? JSON.parse(stored) : { requests: [] };
    } catch {
      data = { requests: [] };
    }

    const recentRequests = data.requests.filter((timestamp: number) => timestamp > oneHourAgo);
    localStorage.setItem(REQUEST_TRACKING_KEY, JSON.stringify({ requests: recentRequests }));
    setRequestsRemaining(Math.max(0, MAX_REQUESTS_PER_HOUR - recentRequests.length));
  };

  const trackRequest = () => {
    const now = Date.now();
    let data;
    try {
      const stored = localStorage.getItem(REQUEST_TRACKING_KEY);
      data = stored ? JSON.parse(stored) : { requests: [] };
    } catch {
      data = { requests: [] };
    }

    data.requests.push(now);
    localStorage.setItem(REQUEST_TRACKING_KEY, JSON.stringify(data));
    updateRequestCount();
  };

  const getCurrentChat = () => {
    return chats.find(chat => chat.id === currentChatId);
  };

  const updateChatTitle = (chatId: string, firstMessage: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : ''),
          lastUpdated: new Date()
        };
      }
      return chat;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || requestsRemaining <= 0 || !currentChatId) return;
    if (input.length > MAX_MESSAGE_LENGTH) {
      alert(`Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    // Update chat with new message
    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        const updatedMessages = [...chat.messages, userMessage];
        // Update title if this is the first message
        if (chat.messages.length === 0) {
          updateChatTitle(chat.id, input.trim());
        }
        return {
          ...chat,
          messages: updatedMessages,
          lastUpdated: new Date()
        };
      }
      return chat;
    }));

    setInput('');
    setIsLoading(true);

    try {
      // Get conversation context
      const currentChat = getCurrentChat();
      const conversationContext = currentChat?.messages
        .slice(-5) // Last 5 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const response = await fetch('http://localhost:8080/api/v1/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input.trim(),
          level: 'medium',
          model: selectedModel,
          provider: models.find(m => m.name === selectedModel)?.provider,
          context: conversationContext // Send conversation context
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      trackRequest();

      // Update chat with AI response
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, {
              role: 'assistant',
              content: data.response,
              timestamp: new Date()
            }],
            lastUpdated: new Date()
          };
        }
        return chat;
      }));
    } catch (error) {
      console.error('Error:', error);
      // Handle error message in current chat
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, {
              role: 'assistant',
              content: 'Sorry, I encountered an error. Please try again.',
              timestamp: new Date()
            }],
            lastUpdated: new Date()
          };
        }
        return chat;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar with chat list */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="p-4">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus /> New Chat
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-5rem)]">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${
                chat.id === currentChatId ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <FiMessageSquare />
                <div className="truncate">{chat.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Model selector */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full md:w-auto px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.provider} - {model.name}
              </option>
            ))}
          </select>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Requests remaining: {requestsRemaining}/{MAX_REQUESTS_PER_HOUR} per hour
          </div>
        </div>

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {getCurrentChat()?.messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <div className="text-xs mt-2 opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || requestsRemaining <= 0}
              placeholder={requestsRemaining <= 0 ? "Request limit reached" : "Type your message..."}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
              maxLength={MAX_MESSAGE_LENGTH}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || requestsRemaining <= 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {input.length}/{MAX_MESSAGE_LENGTH} characters
          </div>
        </form>
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

  // Show admin dashboard for admin users
  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  // Redirect regular users to chat page
  window.location.href = '/chat';
  return null;
}