import type { Route } from "./+types/home";
import { useState, useEffect, useRef } from 'react';
import { FiSend, FiRefreshCw, FiPlus, FiMessageSquare } from 'react-icons/fi';

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
    { title: "AI Coding Tutor Chat" },
    { name: "description", content: "Interactive AI Coding Assistant" },
  ];
}

export default function Home() {
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

  const createNewChat = () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      lastUpdated: new Date()
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
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

  const loadRequestCount = () => {
    const now = new Date();
    const stored = localStorage.getItem(REQUEST_TRACKING_KEY);
    if (stored) {
      const requests = JSON.parse(stored);
      // Filter requests from the last hour
      const recentRequests = requests.filter((timestamp: string) => 
        now.getTime() - new Date(timestamp).getTime() < 3600000
      );
      localStorage.setItem(REQUEST_TRACKING_KEY, JSON.stringify(recentRequests));
      setRequestsRemaining(MAX_REQUESTS_PER_HOUR - recentRequests.length);
    }
  };

  const trackRequest = () => {
    const now = new Date();
    const stored = localStorage.getItem(REQUEST_TRACKING_KEY);
    const requests = stored ? JSON.parse(stored) : [];
    requests.push(now.toISOString());
    localStorage.setItem(REQUEST_TRACKING_KEY, JSON.stringify(requests));
    loadRequestCount();
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