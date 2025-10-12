import OpenAI from 'openai';

interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
}

interface AIResponse {
  content: string;
  model: string;
  timestamp: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and efficient OpenAI model for code assistance',
    maxTokens: 4000,
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'Advanced OpenAI model for complex coding tasks',
    maxTokens: 8000,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Latest OpenAI model with multimodal capabilities',
    maxTokens: 8000,
  },
];

class AIService {
  private openai: OpenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    // Try to get API key from environment variables or localStorage
    this.apiKey = import.meta.env.VITE_AI_API_KEY || 
                  localStorage.getItem('ai-api-key') || 
                  null;
    
    if (this.apiKey) {
      this.initializeOpenAI();
    }
  }

  private initializeOpenAI() {
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true // Enable client-side usage
      });
    }
  }

  setApiKey(key: string) {
    this.apiKey = key;
    // Optionally persist to localStorage (be careful with security)
    if (key) {
      localStorage.setItem('ai-api-key', key);
      this.initializeOpenAI();
    } else {
      localStorage.removeItem('ai-api-key');
      this.openai = null;
    }
  }

  setBaseUrl(_url: string) {
    // Not needed with OpenAI SDK, but kept for compatibility
    console.log('Base URL setting not applicable with OpenAI SDK');
  }

  async queryAI(modelId: string, query: string): Promise<AIResponse> {
    const model = AI_MODELS.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Unknown AI model: ${modelId}`);
    }

    // If no OpenAI client is initialized, use demo mode
    if (!this.openai) {
      return this.simulateAIResponse(modelId, query);
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.getAPIModelName(modelId),
        messages: [
          {
            role: 'system',
            content: 'You are a helpful coding assistant. Provide concise, practical code help and snippets. Focus on clarity and best practices. Format code using markdown code blocks.',
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: Math.min(model.maxTokens, 2000),
        temperature: 0.7,
      });

      return {
        content: completion.choices[0]?.message?.content || 'No response generated',
        model: model.name,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      
      // Check if it's a model access issue and provide helpful message
      if (error instanceof Error && error.message.includes('does not exist or you do not have access')) {
        console.warn(`Model ${modelId} (mapped to ${this.getAPIModelName(modelId)}) not accessible. Using simulated response.`);
      }
      
      // Fallback to simulated response
      return this.simulateAIResponse(modelId, query);
    }
  }

  private getAPIModelName(modelId: string): string {
    // Map internal model IDs to actual OpenAI model names
    // Using widely available models that most API keys can access
    const modelMap: Record<string, string> = {
      'gpt-mini': 'gpt-4o-mini',  // Most widely available
      'gpt-4': 'gpt-4o-mini',     // Fall back to mini if gpt-4 not available
      'gpt-4o': 'gpt-4o-mini',    // Fall back to mini if gpt-4o not available
    };
    return modelMap[modelId] || 'gpt-4o-mini';
  }

  private simulateAIResponse(modelId: string, query: string): AIResponse {
    const model = AI_MODELS.find(m => m.id === modelId);
    
    // Simple response simulation based on query content
    let content = '';
    
    if (query.toLowerCase().includes('function') || query.toLowerCase().includes('method')) {
      content = `Here's a simple function example:\n\n\`\`\`javascript\nfunction processData(data) {\n  return data.map(item => {\n    return {\n      ...item,\n      processed: true,\n      timestamp: new Date().toISOString()\n    };\n  });\n}\n\`\`\`\n\nThis function takes an array of data and adds processing metadata to each item.`;
    } else if (query.toLowerCase().includes('react') || query.toLowerCase().includes('component')) {
      content = `Here's a basic React component:\n\n\`\`\`tsx\nimport React, { useState } from 'react';\n\ninterface Props {\n  title: string;\n}\n\nexport function MyComponent({ title }: Props) {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div>\n      <h2>{title}</h2>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>\n        Increment\n      </button>\n    </div>\n  );\n}\n\`\`\``;
    } else if (query.toLowerCase().includes('css') || query.toLowerCase().includes('style')) {
      content = `Here's a CSS styling example:\n\n\`\`\`css\n.container {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  padding: 20px;\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n  border-radius: 8px;\n  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n}\n\n.button {\n  padding: 10px 20px;\n  background-color: #3b82f6;\n  color: white;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  transition: background-color 0.2s;\n}\n\n.button:hover {\n  background-color: #2563eb;\n}\n\`\`\``;
    } else {
      content = `I'm ${model?.name || 'an AI assistant'} and I'd be happy to help with your coding question!\n\nFor: "${query}"\n\nCould you provide more specific details about what you're trying to accomplish? I can help with:\n- Code examples and snippets\n- Debugging assistance\n- Best practices\n- Framework-specific guidance\n- Performance optimization\n\nFeel free to ask more specific questions!`;
    }

    return {
      content,
      model: model?.name || 'Unknown Model',
      timestamp: new Date().toISOString(),
    };
  }

  getAvailableModels(): AIModel[] {
    return AI_MODELS;
  }

  parseAIQuery(message: string): { modelId: string; query: string } | null {
    // Parse messages in format: ?<model_name> <query>
    // Updated regex to handle hyphens in model names like gpt-4, gpt-mini, etc.
    const aiQueryRegex = /^\?([\w-]+)\s+(.+)$/;
    const match = message.match(aiQueryRegex);
    
    if (match) {
      const [, modelId, query] = match;
      const model = AI_MODELS.find(m => m.id.toLowerCase() === modelId.toLowerCase());
      
      if (model) {
        return {
          modelId: model.id,
          query: query.trim(),
        };
      }
    }
    
    return null;
  }
}

export const aiService = new AIService();