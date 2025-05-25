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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            AI Coding <span className="text-blue-600 dark:text-blue-400">Tutor</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Your intelligent programming companion. Get instant help with coding questions, 
            debug issues, and learn best practices from our advanced AI assistant.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/auth/login"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Get Started
            </Link>
            <Link
              to="/about"
              className="px-8 py-3 border border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors font-semibold"
            >
              Learn More
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-blue-600 dark:text-blue-400 text-3xl mb-4">💡</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Instant Help
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Get immediate answers to your coding questions and debug complex problems with AI assistance.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-blue-600 dark:text-blue-400 text-3xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Personalized Learning
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Adaptive responses based on your skill level, from beginner to expert programming guidance.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-blue-600 dark:text-blue-400 text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Fast & Accurate
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Powered by advanced AI models to provide quick, accurate, and contextual programming assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin dashboard component
function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage AI models, settings, and system configuration
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/admin/settings"
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center mb-4">
              <FiSettings className="text-2xl text-blue-600 dark:text-blue-400 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                AI Settings
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Configure AI models, API keys, prompts, and temperature settings for different services.
            </p>
          </Link>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <FiUser className="text-2xl text-green-600 dark:text-green-400 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                User Management
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              View and manage user accounts, roles, and permissions.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Coming soon</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <FiMessageSquare className="text-2xl text-purple-600 dark:text-purple-400 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Chat Analytics
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Monitor chat usage, popular queries, and system performance metrics.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Coming soon</p>
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

  // Show chat interface for regular users
  return <ChatInterface />;
}