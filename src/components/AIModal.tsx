import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Settings, Bot, Code2 } from 'lucide-react';
import { AI_MODELS, aiService } from '../services/aiService';

interface AIModalProps {
  onModelChange?: (modelId: string) => void;
}

export function AIModal({ onModelChange }: AIModalProps) {
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [apiKey] = useState('');
  const [baseUrl,] = useState('https://api.openai.com/v1');
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState('');
  const [isTestLoading, setIsTestLoading] = useState(false);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    onModelChange?.(modelId);
  };

  const handleSaveSettings = () => {
    if (apiKey) {
      aiService.setApiKey(apiKey);
    }
    if (baseUrl) {
      aiService.setBaseUrl(baseUrl);
    }
    
    // In a real app, you'd save these to localStorage or user preferences
    localStorage.setItem('ai-settings', JSON.stringify({
      selectedModel,
      apiKey: apiKey ? '***' : '', // Don't store the actual key
      baseUrl,
    }));
  };

  const handleTestModel = async () => {
    if (!testQuery.trim()) return;
    
    setIsTestLoading(true);
    try {
      const response = await aiService.queryAI(selectedModel, testQuery);
      setTestResult(response.content);
    } catch (error) {
      setTestResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestLoading(false);
    }
  };

  const getModelIcon = () => {
    // All models are GPT-based, so use consistent icon
    return <Bot className="w-4 h-4" />;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          AI Models
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Assistant Configuration
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Model Selection */}
          <div className="space-y-3">
            <Label>AI Models available</Label>
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent 
                className="!bg-black !text-white !border-gray-700 !opacity-100 min-w-[400px]"
                style={{ 
                  backgroundColor: '#000000 !important',
                  color: '#ffffff !important',
                  opacity: 1,
                  borderColor: '#374151'
                }}
              >
                {AI_MODELS.map((model) => (
                  <SelectItem 
                    key={model.id} 
                    value={model.id} 
                    className="!text-white !bg-black hover:!bg-gray-800 focus:!bg-gray-800 data-[state=checked]:!bg-gray-800 !opacity-100 py-3 px-4"
                    style={{
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      opacity: 1
                    }}
                  >
                    <div className="flex items-center gap-2 !text-white" style={{ color: '#ffffff' }}>
                      {getModelIcon()}
                      <span className="!text-white font-medium" style={{ color: '#ffffff' }}>{model.name}</span>
                      <Badge variant="secondary" className="text-xs !bg-gray-700 !text-white border-gray-600" style={{ backgroundColor: '#374151', color: '#ffffff' }}>
                        {model.maxTokens.toLocaleString()} tokens
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {AI_MODELS.find(m => m.id === selectedModel)?.description}
            </p>
          </div>


          {/* Usage Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              How to use AI in chat:
            </h4>
            <div className="text-sm space-y-1">
              <p><code className="bg-background px-1 rounded">?gpt-mini How do I create a React component?</code></p>
              <p><code className="bg-background px-1 rounded">?gpt-4 Write a function to sort an array</code></p>
              <p><code className="bg-background px-1 rounded">?gpt-4o Explain async/await in JavaScript</code></p>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: <code>?&lt;model_name&gt; &lt;your_question&gt;</code> • All models are GPT-powered
            </p>
          </div>

          {/* Test Section */}
          <div className="space-y-3">
            <Label>Test Model</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter a test query..."
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTestModel()}
              />
              <Button 
                onClick={handleTestModel} 
                disabled={!testQuery.trim() || isTestLoading}
                className="shrink-0"
              >
                {isTestLoading ? 'Testing...' : 'Test'}
              </Button>
            </div>
            
            {testResult && (
              <div className="bg-muted rounded-lg p-3 max-h-32 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSaveSettings} className="flex-1">
              Save Settings
            </Button>
            <DialogTrigger asChild>
              <Button variant="outline">Close</Button>
            </DialogTrigger>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}