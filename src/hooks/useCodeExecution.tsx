import { useState, useCallback, useEffect } from 'react';
import { pistonApi } from '../services/pistonApi';
import { LanguageConfig, getLanguageFromExtension, getDefaultLanguage, SUPPORTED_LANGUAGES } from '../config/languages';
import { ExecutionResult } from '../components/ExecutionResults';
import { toast } from 'sonner';

export interface UseCodeExecutionOptions {
  maxResults?: number;
}

export interface UseCodeExecutionReturn {
  // State
  currentLanguage: LanguageConfig;
  availableLanguages: LanguageConfig[];
  isExecuting: boolean;
  executionResults: ExecutionResult[];
  
  // Actions
  setCurrentLanguage: (language: LanguageConfig) => void;
  executeCode: (code: string, options?: { stdin?: string; args?: string[] }) => Promise<void>;
  clearResults: () => void;
  
  // Utilities
  detectLanguageFromFile: (filename: string) => LanguageConfig;
  getLanguageTemplate: (language: LanguageConfig) => string;
}

export function useCodeExecution(options: UseCodeExecutionOptions = {}): UseCodeExecutionReturn {
  const { maxResults = 10 } = options;
  
  const [currentLanguage, setCurrentLanguage] = useState<LanguageConfig>(getDefaultLanguage());
  const [availableLanguages] = useState<LanguageConfig[]>(SUPPORTED_LANGUAGES);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);

  // Update available languages with actual runtime versions on mount
  useEffect(() => {
    const fetchRuntimes = async () => {
      try {
        // const runtimes = await pistonApi.getRuntimes();
        // const updatedLanguages = updateLanguageVersions(runtimes);
        // setAvailableLanguages(updatedLanguages);
        
        // For now, we'll use the predefined languages
        // In production, you might want to fetch and update from Piston API
      } catch (error) {
        console.warn('Failed to fetch Piston runtimes, using predefined languages');
      }
    };

    fetchRuntimes();
  }, []);

  const detectLanguageFromFile = useCallback((filename: string): LanguageConfig => {
    const detected = getLanguageFromExtension(filename);
    return detected || getDefaultLanguage();
  }, []);

  const getLanguageTemplate = useCallback((language: LanguageConfig): string => {
    return language.defaultCode;
  }, []);

  const executeCode = useCallback(async (
    code: string, 
    options: { stdin?: string; args?: string[] } = {}
  ) => {
    if (isExecuting) {
      toast.warning('Code is already executing, please wait...');
      return;
    }

    if (!code.trim()) {
      toast.error('Please enter some code to execute');
      return;
    }

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      const response = await pistonApi.executeFile(
        currentLanguage.pistonLanguage,
        currentLanguage.version,
        code,
        {
          stdin: options.stdin,
          args: options.args,
          compileTimeout: 10000, // 10 seconds
          runTimeout: 5000,      // 5 seconds
        }
      );

      const duration = Date.now() - startTime;

      const result: ExecutionResult = {
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        language: currentLanguage.name,
        version: currentLanguage.version,
        code,
        response,
        duration,
      };

      setExecutionResults(prev => {
        const newResults = [...prev, result];
        // Keep only the latest maxResults
        return newResults.slice(-maxResults);
      });

      // Show success/error toast
      const hasCompileError = response.compile && response.compile.code !== 0;
      const hasRuntimeError = response.run.code !== 0;

      if (hasCompileError) {
        toast.error('Compilation failed');
      } else if (hasRuntimeError) {
        toast.error('Runtime error occurred');
      } else {
        toast.success('Code executed successfully');
      }

    } catch (error) {
      console.error('Execution failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute code');
      
      // Create an error result
      const errorResult: ExecutionResult = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        language: currentLanguage.name,
        version: currentLanguage.version,
        code,
        response: {
          language: currentLanguage.pistonLanguage,
          version: currentLanguage.version,
          run: {
            stdout: '',
            stderr: error instanceof Error ? error.message : 'Unknown error occurred',
            code: -1,
            signal: null,
            output: error instanceof Error ? error.message : 'Unknown error occurred',
          },
        },
        duration: Date.now() - startTime,
      };

      setExecutionResults(prev => {
        const newResults = [...prev, errorResult];
        return newResults.slice(-maxResults);
      });
    } finally {
      setIsExecuting(false);
    }
  }, [currentLanguage, isExecuting, maxResults]);

  const clearResults = useCallback(() => {
    setExecutionResults([]);
    toast.success('Execution results cleared');
  }, []);

  return {
    // State
    currentLanguage,
    availableLanguages,
    isExecuting,
    executionResults,
    
    // Actions
    setCurrentLanguage,
    executeCode,
    clearResults,
    
    // Utilities
    detectLanguageFromFile,
    getLanguageTemplate,
  };
}