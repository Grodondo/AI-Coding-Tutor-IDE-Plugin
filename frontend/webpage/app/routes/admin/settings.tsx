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
  };
}

export default function AdminSettings() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    logger.info('AdminSettings: Checking user role', { user });
    if (!user || user.role !== 'admin') {
      logger.warn('AdminSettings: Unauthorized access, redirecting');
      navigate('/auth/login');
    }
  }, [user, navigate]);

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
        logger.info('AdminSettings: Raw API response', { data });
        // Transform backend response to AIModel
        const validModels: AIModel[] = Object.entries(data).map(
          ([service, cfg]: [string, any]) => ({
            service,
            config: {
              ai_provider:       cfg.ai_provider,
              ai_model:          cfg.ai_model,
              encrypted_api_key: cfg.encrypted_api_key,
              api_key:           "",          
              prompts:           cfg.prompts,
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
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      logger.info('AdminSettings: Initializing fetchModels');
      fetchModels();
    }
  }, [user]);

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
      },
    };
    setModels([...models, newModel]);
    setIsEditing('new');
    logger.info('AdminSettings: Added new model form');
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-800 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">AI Model Settings</h1>
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      <button
        onClick={handleAdd}
        className="mb-6 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
        disabled={isLoading}
      >
        Add New Model
      </button>
      {isLoading ? (
        <div className="text-center text-gray-600">Loading models...</div>
      ) : models.length === 0 ? (
        <p className="text-gray-600">No models available. Add a new model to get started.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {models.map((model, index) => (
            <div
              key={model.service || index}
              className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md"
            >
              {isEditing === model.service || (isEditing === 'new' && index === models.length - 1) ? (
                <ModelForm
                  model={model}
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
  );
}

interface ModelFormProps {
  model: AIModel;
  onSave: (model: AIModel) => void;
  onCancel: () => void;
}

const ModelForm: React.FC<ModelFormProps> = ({ model, onSave, onCancel }) => {
  const [formModel, setFormModel] = useState<AIModel>(model);
  const [errors, setErrors] = useState<Partial<Record<keyof AIModel['config'] | 'service', string>>>({});

  const validate = () => {
    const newErrors: Partial<Record<keyof AIModel['config'] | 'service', string>> = {};
    if (!formModel.service.trim()) newErrors.service = 'Service name is required';
    if (!formModel.config.ai_provider.trim()) newErrors.ai_provider = 'AI Provider is required';
    if (!formModel.config.ai_model.trim()) newErrors.ai_model = 'AI Model is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleInputChange = (field: keyof AIModel | keyof AIModel['config'], value: string) => {
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
    setErrors((prev) => ({ ...prev, [field]: undefined }));
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
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI Provider</label>
        <input
          type="text"
          value={formModel.config.ai_provider}
          onChange={(e) => handleInputChange('ai_provider', e.target.value)}
          placeholder="e.g., groq"
          className={`mt-1 block w-full border ${errors.ai_provider ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-blue-500 focus:border-blue-500`}
        />
        {errors.ai_provider && <p className="text-red-500 text-sm mt-1">{errors.ai_provider}</p>}
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
        {errors.ai_model && <p className="text-red-500 text-sm mt-1">{errors.ai_model}</p>}      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
        <input
          type="text"
          value={formModel.config.api_key}
          onChange={(e) => handleInputChange('api_key', e.target.value)}
          placeholder="e.g., gsk_..."
          className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Temperature</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="2"
          value={formModel.config.temperature || ''}
          onChange={(e) => handleInputChange('temperature', e.target.value)}
          placeholder="e.g., 0.7 (0.0 - 2.0)"
          className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">Controls randomness. Lower values (0.1) = more focused, Higher values (1.5) = more creative</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-100">Prompts</label>
        {['novice', 'medium', 'expert'].map((level) => (
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
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
        ))}
      </div>
      <div className="flex space-x-4">
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
        >
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
    <div className="space-y-4">      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{model.service || 'New Model'}</h3>
        <p className="text-gray-600 dark:text-gray-300">Provider: {model.config.ai_provider || 'N/A'}</p>
        <p className="text-gray-600 dark:text-gray-300">Model: {model.config.ai_model || 'N/A'}</p>
        <p className="text-gray-600 dark:text-gray-300">Temperature: {model.config.temperature !== undefined ? model.config.temperature : 'Default (0.7)'}</p>
        <p className="text-gray-600 dark:text-gray-300 truncate">API Key: {model.config.api_key ? '••••' + model.config.api_key.slice(-4) : 'N/A'}</p>
      </div>
      <div className="flex space-x-4">
        <button
          onClick={onEdit}
          className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
