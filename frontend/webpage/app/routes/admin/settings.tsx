'use client';
import { useContext, useEffect, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { logger } from '../../utils/logger';
import { AuthContext } from '~/context/AuthContext';

export interface AIModel {
  service: string;
  config: {
    ai_provider: string;
    ai_model:    string;
    // what we got from GET: the encrypted blob
    encrypted_api_key: string;
    // what user types in to change it
    api_key: string;
    // AI model temperature
    temperature?: number;
    prompts: Record<string,string>;
    // API endpoint URL for the provider (new field)
    api_url?: string;
  };
}

// Provider configuration from backend
export interface ProviderConfig {
  name: string;
  default_url: string;
  description: string;
}

export default function AdminSettings() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [supportedProviders, setSupportedProviders] = useState<ProviderConfig[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useContext(AuthContext);

  useEffect(() => {
    // Don't redirect if we're still loading the auth state
    if (authLoading) {
      return;
    }
    
    logger.info('AdminSettings: Checking user role', { user });
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      logger.warn('AdminSettings: Unauthorized access, redirecting');
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  const fetchModels = async () => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    logger.info('AdminSettings: Fetching models', { token: token ? '[present]' : '[missing]' });
    if (!token) {
      logger.warn('AdminSettings: No token, redirecting to login');
      navigate('/auth/login');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8080/api/v1/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        logger.info('AdminSettings: Raw API response', { data });        // Transform backend response to AIModel
        const validModels: AIModel[] = Object.entries(data).map(
          ([service, cfg]: [string, any]) => ({
            service,
            config: {
              ai_provider:       cfg.ai_provider,
              ai_model:          cfg.ai_model,
              encrypted_api_key: cfg.encrypted_api_key,
              api_key:           "",          
              prompts:           cfg.prompts,
              api_url:           cfg.api_url || "", // Include API URL from backend
            }
          })
        );
        logger.info('AdminSettings: Models fetched', { count: validModels.length });
        setModels(validModels);
      } else {
        logger.warn('AdminSettings: Failed to fetch models', {
          status: response.status,
          statusText: response.statusText,
        });
        setError('Failed to load models. Please try again.');
        navigate('/auth/login');
      }
    } catch (error) {
      logger.error('AdminSettings: Error fetching models', error);
      setError('An error occurred while loading models.');
      navigate('/auth/login');
    } finally {
      setIsLoading(false);
    }
  };  useEffect(() => {
    if (!authLoading && user && (user.role === 'admin' || user.role === 'superadmin')) {
      logger.info('AdminSettings: Initializing fetchModels and fetchSupportedProviders');
      fetchModels();
      fetchSupportedProviders();
    }
  }, [user, authLoading]);
  const fetchSupportedProviders = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/providers');
      if (response.ok) {
        const providers = await response.json();
        logger.info('AdminSettings: Supported providers fetched', { count: providers.length });
        setSupportedProviders(providers);
      } else {
        logger.warn('AdminSettings: Failed to fetch supported providers, using fallback');
        // Use fallback providers when API fails
        setFallbackProviders();
      }
    } catch (error) {
      logger.error('AdminSettings: Error fetching supported providers', error);
      // Use fallback providers when API fails
      setFallbackProviders();
    }
  };

  const setFallbackProviders = () => {
    const fallbackProviders: ProviderConfig[] = [
      { name: 'groq', default_url: 'https://api.groq.com/openai/v1', description: 'Fast inference with Groq LPU™' },
      { name: 'openai', default_url: 'https://api.openai.com/v1', description: 'OpenAI GPT models' },
      { name: 'anthropic', default_url: 'https://api.anthropic.com/v1', description: 'Anthropic Claude models' },
      { name: 'azure-openai', default_url: 'https://your-resource.openai.azure.com/openai/deployments', description: 'Azure OpenAI Service' },
      { name: 'cohere', default_url: 'https://api.cohere.ai/v1', description: 'Cohere language models' },
      { name: 'huggingface', default_url: 'https://api-inference.huggingface.co/models', description: 'Hugging Face Inference API' },
      { name: 'custom', default_url: '', description: 'Custom API endpoint' }
    ];
    setSupportedProviders(fallbackProviders);
    logger.info('AdminSettings: Using fallback providers', { count: fallbackProviders.length });
  };

  async function handleSave(model: AIModel) {
    const token = localStorage.getItem('authToken');
    if (!token) {
      logger.warn('AdminSettings: No token for save, redirecting');
      navigate('/auth/login');
      return;
    }

    try {
      console.log('Saving model:', model);
      const response = await fetch('http://localhost:8080/api/v1/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },        body: JSON.stringify({
          service: model.service,
          config: {
            ai_provider: model.config.ai_provider,
            ai_model:    model.config.ai_model,
            api_key:     model.config.api_key,
            temperature: model.config.temperature,
            prompts:     model.config.prompts,
            api_url:     model.config.api_url, // Include API URL in save request
          },
        }),
      });
      if (response.ok) {
        logger.info('AdminSettings: Model saved', { service: model.service });
        setIsEditing(null);
        await fetchModels();
      } else {
        logger.warn('AdminSettings: Failed to save model', {
          status: response.status,
          statusText: response.statusText,
        });
        setError('Failed to save model. Please try again.');
      }
    } catch (error) {
      logger.error('AdminSettings: Error saving model', error);
      setError('An error occurred while saving the model.');
    }
  }

  async function handleDelete(service: string) {
    const token = localStorage.getItem('authToken');
    if (!token) {
      logger.warn('AdminSettings: No token for delete, redirecting');
      navigate('/auth/login');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/api/v1/settings/${service}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        logger.info('AdminSettings: Model deleted', { service });
        await fetchModels();
      } else {
        logger.warn('AdminSettings: Failed to delete model', {
          status: response.status,
          statusText: response.statusText,
        });
        setError('Failed to delete model. Please try again.');
      }
    } catch (error) {
      logger.error('AdminSettings: Error deleting model', error);
      setError('An error occurred while deleting the model.');
    }
  }

  function handleAdd() {
    const newModel: AIModel = {
      service: '',
      config: {
        ai_provider: '',
        ai_model: '',
        encrypted_api_key: '',
        api_key: '',
        prompts: { novice: '', medium: '', expert: '' },
        api_url: '', // Initialize API URL for new models
      },
    };
    setModels([...models, newModel]);
    setIsEditing('new');
    logger.info('AdminSettings: Added new model form');
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">AI Model Configuration</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Configure AI models, manage API keys, and customize prompts for different user experience levels
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}
        
        <div className="mb-8 flex justify-center">
          <button
            onClick={handleAdd}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold flex items-center gap-2"
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add New Model
          </button>
        </div>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300 text-lg">Loading models...</p>
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Models Configured</h3>
              <p className="text-gray-600 dark:text-gray-300">Add your first AI model to get started with the tutoring system.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {models.map((model, index) => (
              <div
                key={model.service || index}
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700"
              >
                {isEditing === model.service || (isEditing === 'new' && index === models.length - 1) ? (                  <ModelForm
                    model={model}
                    supportedProviders={supportedProviders}
                    onSave={handleSave}
                    onCancel={() => {
                      setIsEditing(null);
                      if (isEditing === 'new') {
                        setModels(models.slice(0, -1));
                      }
                    }}
                  />
                ) : (
                  <ModelDisplay
                    model={model}
                    onEdit={() => setIsEditing(model.service)}
                    onDelete={() => handleDelete(model.service)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModelFormProps {
  model: AIModel;
  supportedProviders: ProviderConfig[];
  onSave: (model: AIModel) => void;
  onCancel: () => void;
}

const ModelForm: React.FC<ModelFormProps> = ({ model, supportedProviders, onSave, onCancel }) => {
  const [formModel, setFormModel] = useState<AIModel>(model);
  const [errors, setErrors] = useState<Partial<Record<keyof AIModel['config'] | 'service', string>>>({});
  
  // Handle provider selection and auto-populate API URL
  const handleProviderChange = (providerName: string) => {
    const provider = supportedProviders.find(p => p.name === providerName);
    setFormModel({
      ...formModel,
      config: {
        ...formModel.config,
        ai_provider: providerName,
        api_url: provider?.default_url || formModel.config.api_url || '',
      },
    });
    // Clear provider-related errors
    setErrors((prev) => ({ 
      ...prev, 
      ai_provider: undefined,
      api_url: undefined,
    }));
  };  const validate = () => {
    const newErrors: Partial<Record<keyof AIModel['config'] | 'service', string>> = {};
    
    // Required field validations
    if (!formModel.service.trim()) {
      newErrors.service = 'Service name is required';
    } else if (formModel.service.length < 2) {
      newErrors.service = 'Service name must be at least 2 characters';
    }
    
    if (!formModel.config.ai_provider.trim()) {
      newErrors.ai_provider = 'AI Provider is required';
    } else if (formModel.config.ai_provider.length < 2) {
      newErrors.ai_provider = 'AI Provider must be at least 2 characters';
    }
    
    if (!formModel.config.ai_model.trim()) {
      newErrors.ai_model = 'AI Model is required';
    } else if (formModel.config.ai_model.length < 2) {
      newErrors.ai_model = 'AI Model must be at least 2 characters';
    }
    
    if (!formModel.config.api_key.trim()) {
      newErrors.api_key = 'API Key is required';
    } else if (formModel.config.api_key.length < 10) {
      newErrors.api_key = 'API Key must be at least 10 characters';
    }
    
    // API URL validation (optional but if provided, should be valid)
    if (formModel.config.api_url && formModel.config.api_url.trim()) {
      try {
        new URL(formModel.config.api_url);
      } catch {
        newErrors.api_url = 'Please enter a valid URL (e.g., https://api.example.com)';
      }
    }
    
    // Temperature validation
    if (formModel.config.temperature !== undefined) {
      if (formModel.config.temperature < 0 || formModel.config.temperature > 2) {
        newErrors.temperature = 'Temperature must be between 0 and 2';
      }
    }
    
    // Prompt validations
    const promptLevels = ['novice', 'medium', 'expert'];
    for (const level of promptLevels) {
      if (!formModel.config.prompts[level]?.trim()) {
        newErrors[`prompt_${level}` as keyof typeof newErrors] = `${level.charAt(0).toUpperCase() + level.slice(1)} prompt is required`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };  const handleInputChange = (field: keyof AIModel | keyof AIModel['config'], value: string) => {
    if (field === 'service') {
      setFormModel({ ...formModel, service: value });
    } else if (field === 'temperature') {
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormModel({
        ...formModel,
        config: { ...formModel.config, temperature: numValue },
      });
    } else {
      setFormModel({
        ...formModel,
        config: { ...formModel.config, [field]: value },
      });
    }
    // Clear any related error when user starts typing
    setErrors((prev) => ({ 
      ...prev, 
      [field]: undefined,
      [`prompt_${field}`]: undefined, // Clear prompt-specific errors too
    }));
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formModel);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Name</label>
        <input
          type="text"
          value={formModel.service}
          onChange={(e) => handleInputChange('service', e.target.value)}
          placeholder="e.g., query"
          className={`mt-1 block w-full border ${errors.service ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-blue-500 focus:border-blue-500`}
        />
        {errors.service && <p className="text-red-500 text-sm mt-1">{errors.service}</p>}
      </div>      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI Provider</label>
        <select
          value={formModel.config.ai_provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className={`mt-1 block w-full border ${errors.ai_provider ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white`}
        >
          <option value="">Select a provider...</option>
          {supportedProviders.map((provider) => (
            <option key={provider.name} value={provider.name}>
              {provider.name} - {provider.description}
            </option>
          ))}
          <option value="custom">Custom Provider</option>
        </select>
        {errors.ai_provider && <p className="text-red-500 text-sm mt-1">{errors.ai_provider}</p>}
        {formModel.config.ai_provider && (
          <p className="text-xs text-gray-500 mt-1">
            {supportedProviders.find(p => p.name === formModel.config.ai_provider)?.description || 'Custom provider configuration'}
          </p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          API Endpoint URL
          <span className="text-xs text-gray-500 ml-1">(Optional - uses provider default if empty)</span>
        </label>
        <input
          type="url"
          value={formModel.config.api_url || ''}
          onChange={(e) => handleInputChange('api_url', e.target.value)}
          placeholder={
            formModel.config.ai_provider && supportedProviders.find(p => p.name === formModel.config.ai_provider)?.default_url 
              ? supportedProviders.find(p => p.name === formModel.config.ai_provider)?.default_url
              : "e.g., https://api.openai.com/v1"
          }
          className={`mt-1 block w-full border ${errors.api_url ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-blue-500 focus:border-blue-500`}
        />
        {errors.api_url && <p className="text-red-500 text-sm mt-1">{errors.api_url}</p>}
        {formModel.config.ai_provider && supportedProviders.find(p => p.name === formModel.config.ai_provider) && (
          <p className="text-xs text-gray-500 mt-1">
            Default: {supportedProviders.find(p => p.name === formModel.config.ai_provider)?.default_url}
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI Model</label>
        <input
          type="text"
          value={formModel.config.ai_model}
          onChange={(e) => handleInputChange('ai_model', e.target.value)}
          placeholder="e.g., llama-3.3-70b-versatile"
          className={`mt-1 block w-full border ${errors.ai_model ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-blue-500 focus:border-blue-500`}
        />
        {errors.ai_model && <p className="text-red-500 text-sm mt-1">{errors.ai_model}</p>}      </div>      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
        <input
          type="text"
          value={formModel.config.api_key}
          onChange={(e) => handleInputChange('api_key', e.target.value)}
          placeholder="e.g., gsk_..."
          className={`mt-1 block w-full border ${errors.api_key ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-blue-500 focus:border-blue-500`}
        />
        {errors.api_key && <p className="text-red-500 text-sm mt-1">{errors.api_key}</p>}
      </div><div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Temperature: {formModel.config.temperature !== undefined ? formModel.config.temperature.toFixed(1) : '0.7'}
        </label>
        <div className="mt-2 space-y-2">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={formModel.config.temperature !== undefined ? formModel.config.temperature : 0.7}
            onChange={(e) => handleInputChange('temperature', e.target.value)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider dark:bg-gray-700"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formModel.config.temperature !== undefined ? formModel.config.temperature : 0.7) / 2) * 100}%, #d1d5db ${((formModel.config.temperature !== undefined ? formModel.config.temperature : 0.7) / 2) * 100}%, #d1d5db 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.0 (Focused)</span>
            <span>1.0 (Balanced)</span>
            <span>2.0 (Creative)</span>
          </div>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={formModel.config.temperature !== undefined ? formModel.config.temperature : ''}
            onChange={(e) => handleInputChange('temperature', e.target.value)}
            placeholder="0.7"
            className="mt-1 w-24 border border-gray-300 rounded-md p-1 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Controls randomness. Lower values = more focused, Higher values = more creative</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-100">Prompts</label>        {['novice', 'medium', 'expert'].map((level) => (
          <div key={level} className="mt-2">
            <label className="block text-sm text-gray-600 dark:text-gray-300 capitalize">{level} Prompt</label>
            <textarea
              value={formModel.config.prompts[level] || ''}
              onChange={(e) =>
                setFormModel({
                  ...formModel,
                  config: {
                    ...formModel.config,
                    prompts: { ...formModel.config.prompts, [level]: e.target.value },
                  },
                })
              }
              placeholder={`e.g., ${level === 'novice' ? 'Explain simply...' : level === 'medium' ? 'Provide a detailed analysis...' : 'Give a technical breakdown...'}`}
              className={`mt-1 block w-full border ${errors[`prompt_${level}` as keyof typeof errors] ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-blue-500 focus:border-blue-500`}
              rows={3}
            />
            {errors[`prompt_${level}` as keyof typeof errors] && (
              <p className="text-red-500 text-sm mt-1">{errors[`prompt_${level}` as keyof typeof errors]}</p>
            )}
          </div>
        ))}
      </div>      <div className="flex space-x-4 pt-6">
        <button
          onClick={handleSubmit}
          className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Save Configuration
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gradient-to-r from-gray-400 to-gray-500 text-white px-8 py-3 rounded-xl hover:from-gray-500 hover:to-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel
        </button>
      </div>
    </div>
  );
};

interface ModelDisplayProps {
  model: AIModel;
  onEdit: () => void;
  onDelete: () => void;
}

const ModelDisplay: React.FC<ModelDisplayProps> = ({ model, onEdit, onDelete }) => {
  if (!model.config) {
    logger.warn('ModelDisplay: Invalid model config', { service: model.service });
    return <div className="text-red-500">Error: Invalid model configuration</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 p-6 rounded-xl">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{model.service || 'New Model'}</h3>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-20">Provider:</span>
              <span className="text-gray-600 dark:text-gray-400">{model.config.ai_provider || 'N/A'}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-20">Model:</span>
              <span className="text-gray-600 dark:text-gray-400">{model.config.ai_model || 'N/A'}</span>
            </div>
          </div>          <div className="space-y-2">
            <div className="flex items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-24">Temperature:</span>
              <span className="text-gray-600 dark:text-gray-400">
                {model.config.temperature !== undefined ? model.config.temperature : '0.7 (default)'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-24">API URL:</span>
              <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                {model.config.api_url ? model.config.api_url : 'Default provider URL'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-24">API Key:</span>
              <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                {model.config.encrypted_api_key ? '••••••••••••••••' : 'Not configured'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={onEdit}
          className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Configuration
        </button>
        <button
          onClick={onDelete}
          className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Model
        </button>
      </div>
    </div>
  );
};
