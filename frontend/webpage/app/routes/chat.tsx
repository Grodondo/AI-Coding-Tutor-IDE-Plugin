import type { Route } from "./+types/chat";
import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router';
import { FiSend, FiRefreshCw, FiPlus, FiMessageSquare } from 'react-icons/fi';
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
    { title: "AI Chat - AI Coding Tutor" },
    { name: "description", content: "Chat with AI Models" },
  ];
}

export default function Chat() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [difficultyLevel, setDifficultyLevel] = useState<string>('medium');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [requestsRemaining, setRequestsRemaining] = useState(MAX_REQUESTS_PER_HOUR);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Load chats from localStorage
    const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats);
      if (parsedChats.length > 0) {
        setCurrentChatId(parsedChats[0].id);
      }
    }    // Fetch available models from the backend
    const fetchModels = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch('http://localhost:8080/api/v1/settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
        },        body: JSON.stringify({
          query: input.trim(),
          level: difficultyLevel,
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

  if (!user) {
    return null; // Will be redirected by useEffect
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar with chat list */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg"
          >
            <FiPlus className="text-lg" /> New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Recent Chats
          </h3>
          <div className="space-y-2">
            {chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setCurrentChatId(chat.id)}
                className={`p-4 cursor-pointer rounded-xl transition-all duration-200 border ${
                  chat.id === currentChatId 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <FiMessageSquare className={`mt-1 ${
                    chat.id === currentChatId ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {chat.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(chat.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">        {/* Header with model and difficulty selector */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Chat Assistant</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Choose your AI model and difficulty level
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  AI Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.provider} - {model.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Difficulty Level
                </label>
                <select
                  value={difficultyLevel}
                  onChange={(e) => setDifficultyLevel(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="novice">🟢 Novice - Basic concepts</option>
                  <option value="medium">🟡 Medium - Intermediate level</option>
                  <option value="expert">🔴 Expert - Advanced topics</option>
                </select>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {requestsRemaining}/{MAX_REQUESTS_PER_HOUR} requests remaining
              </div>
            </div>
          </div>
        </div>

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {getCurrentChat()?.messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Start a new conversation
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Ask me anything about programming, debugging, code review, or software development best practices.
              </p>
            </div>
          ) : (
            getCurrentChat()?.messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-6 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-lg'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <div className={`text-xs mt-3 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading || requestsRemaining <= 0}
                placeholder={requestsRemaining <= 0 ? "Request limit reached" : "Type your message..."}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                maxLength={MAX_MESSAGE_LENGTH}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Press Enter to send, Shift+Enter for new line</span>
                <span>{input.length}/{MAX_MESSAGE_LENGTH}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim() || requestsRemaining <= 0}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold"
            >
              {isLoading ? (
                <FiRefreshCw className="animate-spin text-lg" />
              ) : (
                <FiSend className="text-lg" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
