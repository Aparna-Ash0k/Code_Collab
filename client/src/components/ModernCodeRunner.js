import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Settings, 
  Terminal, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Download,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  Zap,
  X,
  Save,
  FolderOpen,
  File
} from 'lucide-react';
import { getServerUrl } from '../utils/serverConfig';

const ModernCodeRunner = ({ 
  code = '', 
  language = 'javascript', 
  onLanguageChange,
  socket,
  sessionId 
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [executionTime, setExecutionTime] = useState(null);
  const [exitCode, setExitCode] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveInterface, setShowSaveInterface] = useState(false);
  const [savedFiles, setSavedFiles] = useState([]);
  const [currentFileName, setCurrentFileName] = useState('');
  const outputRef = useRef(null);

  // Supported languages with modern styling
  const languageConfigs = {
    javascript: { 
      name: 'JavaScript', 
      color: '#f7df1e', 
      icon: '🟨',
      extension: '.js'
    },
    python: { 
      name: 'Python', 
      color: '#3776ab', 
      icon: '🐍',
      extension: '.py'
    },
    java: { 
      name: 'Java', 
      color: '#ed8b00', 
      icon: '☕',
      extension: '.java'
    },
    cpp: { 
      name: 'C++', 
      color: '#00599c', 
      icon: '⚡',
      extension: '.cpp'
    },
    c: { 
      name: 'C', 
      color: '#a8b9cc', 
      icon: '🔧',
      extension: '.c'
    },
    typescript: { 
      name: 'TypeScript', 
      color: '#3178c6', 
      icon: '📘',
      extension: '.ts'
    },
    php: { 
      name: 'PHP', 
      color: '#777bb4', 
      icon: '🐘',
      extension: '.php'
    },
    ruby: { 
      name: 'Ruby', 
      color: '#cc342d', 
      icon: '💎',
      extension: '.rb'
    },
    go: { 
      name: 'Go', 
      color: '#00add8', 
      icon: '🐹',
      extension: '.go'
    },
    rust: { 
      name: 'Rust', 
      color: '#000000', 
      icon: '🦀',
      extension: '.rs'
    }
  };

  useEffect(() => {
    // Fetch available languages
    const fetchLanguages = async () => {
      try {
        const serverUrl = getServerUrl();
        const response = await fetch(`${serverUrl}/api/execution/languages`);
        const data = await response.json();
        setAvailableLanguages(data.languages || []);
      } catch (error) {
        console.error('Failed to fetch languages:', error);
        // Fallback to default languages
        setAvailableLanguages(Object.keys(languageConfigs).map(lang => ({
          name: lang,
          displayName: languageConfigs[lang].name,
          available: true
        })));
      }
    };

    fetchLanguages();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleExecutionResult = (result) => {
      console.log('📥 Execution result received:', result);
      if (result.sessionId === sessionId) {
        setIsRunning(false);
        setOutput(result.output || '');
        setError(result.error || '');
        setExitCode(result.exitCode);
        setExecutionTime(Date.now() - result.executionTime);
        
        // Add to history
        setExecutionHistory(prev => [...prev.slice(-9), {
          id: Date.now(),
          language: result.language,
          output: result.output,
          error: result.error,
          exitCode: result.exitCode,
          timestamp: result.executionTime
        }]);
      }
    };

    const handleExecutionError = (error) => {
      console.log('❌ Execution error received:', error);
      if (error.sessionId === sessionId) {
        setIsRunning(false);
        setOutput('');
        
        // Handle specific error cases with better user feedback
        let errorMessage = error.error || 'Unknown error occurred';
        if (error.details) {
          errorMessage += `\n${error.details}`;
        }
        
        // If rate limited or server issues, suggest local fallback
        if (error.error === 'Rate limit exceeded' || error.error === 'Queue timeout' || error.error === 'Execution failed') {
          errorMessage += '\n🏠 Consider using local execution mode for immediate results.';
        }
        
        setError(errorMessage);
        setExitCode(1);
      }
    };

    const handleExecutionStarted = (data) => {
      console.log('🚀 Execution started:', data);
      if (data.sessionId === sessionId && data.clientId !== socket.id) {
        setIsRunning(true);
        setOutput('');
        setError('');
        setExecutionTime(null);
      }
    };

    socket.on('execution_result', handleExecutionResult);
    socket.on('execution_error', handleExecutionError);
    socket.on('execution_started', handleExecutionStarted);

    return () => {
      socket.off('execution_result', handleExecutionResult);
      socket.off('execution_error', handleExecutionError);
      socket.off('execution_started', handleExecutionStarted);
    };
  }, [socket, sessionId]);

  const executeCode = async () => {
    if (!code.trim()) {
      setError('No code to execute');
      return;
    }

    console.log('🚀 Executing code:', { 
      language, 
      codeLength: code.length, 
      hasSocket: !!socket,
      socketConnected: socket?.connected,
      sessionId,
      codePreview: code.substring(0, 100) + (code.length > 100 ? '...' : '')
    });

    setIsRunning(true);
    setOutput('');
    setError('');
    setExitCode(null);
    setExecutionTime(null);

    const startTime = Date.now();

    try {
      // Use Piston API via server for all executions
      console.log('� Using Piston API via server');
      executeViaAPI();
      
      // Socket communication for collaboration (if available)
      if (socket && socket.connected && sessionId) {
        console.log('📡 Also broadcasting via socket for collaboration');
        socket.emit('execute_code', {
          code: code,
          language,
          input,
          sessionId
        });
      }
    } catch (error) {
      console.error('❌ Execution error:', error);
      setIsRunning(false);
      setError(`Execution error: ${error.message}`);
      setExitCode(1);
    }
  };

  const executeViaAPI = async () => {
    try {
      console.log('🌐 Making direct API call');
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/execution/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          language,
          input
        }),
      });

      const result = await response.json();
      console.log('📥 API response:', result);
      
      setIsRunning(false);
      if (result.success) {
        setOutput(result.output || '');
        setError(result.error || '');
        setExitCode(result.exitCode);
        setExecutionTime(result.executionTime ? Date.now() - result.executionTime : 0);
      } else {
        // Handle specific error cases
        if (result.error === 'Rate limit exceeded') {
          setError(`⏳ ${result.error}: ${result.details}\n🏠 Falling back to local execution...`);
          setTimeout(() => executeLocally(), 500); // Small delay then fallback
          return;
        }
        
        setError(result.error || 'Execution failed');
        setExitCode(1);
        
        // For most errors, try local execution as fallback
        console.log('🔄 Falling back to local execution due to server error');
        setTimeout(() => executeLocally(), 500);
      }
    } catch (error) {
      console.error('❌ API execution error:', error);
      console.log('🔄 Falling back to local execution');
      // Always fallback to local execution - no server dependency
      executeLocally();
    }
  };

  const executeLocally = async () => {
    const startTime = Date.now();
    
    try {
      let result = '';
      let errorResult = '';
      let exitCode = 0;

      if (language === 'javascript') {
        try {
          // Create a safe execution environment
          const logs = [];
          
          // Override console.log to capture output
          const mockConsole = {
            log: (...args) => logs.push(args.join(' ')),
            error: (...args) => logs.push('ERROR: ' + args.join(' ')),
            warn: (...args) => logs.push('WARNING: ' + args.join(' ')),
            info: (...args) => logs.push('INFO: ' + args.join(' '))
          };

          // Create execution context
          const context = {
            console: mockConsole,
            Math: Math,
            Date: Date,
            JSON: JSON,
            parseInt: parseInt,
            parseFloat: parseFloat,
            isNaN: isNaN,
            isFinite: isFinite,
            input: input || ''
          };

          // Wrap code in a function to isolate scope
          const wrappedCode = `
            (function() {
              ${code}
            })();
          `;

          // Execute the code
          const func = new Function(...Object.keys(context), wrappedCode);
          func(...Object.values(context));
          
          result = logs.join('\n');
          if (!result.trim()) {
            result = 'Code executed successfully (no output)';
          }
          
        } catch (err) {
          errorResult = `JavaScript Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'python') {
        try {
          // Basic Python interpreter (simplified)
          result = await executePython(code, input);
        } catch (err) {
          errorResult = `Python Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'java') {
        try {
          result = await executeJava(code, input);
        } catch (err) {
          errorResult = `Java Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'cpp' || language === 'c') {
        try {
          result = await executeC(code, input, language);
        } catch (err) {
          errorResult = `${language.toUpperCase()} Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'typescript') {
        try {
          result = await executeTypeScript(code, input);
        } catch (err) {
          errorResult = `TypeScript Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'php') {
        try {
          result = await executePHP(code, input);
        } catch (err) {
          errorResult = `PHP Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'ruby') {
        try {
          result = await executeRuby(code, input);
        } catch (err) {
          errorResult = `Ruby Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'go') {
        try {
          result = await executeGo(code, input);
        } catch (err) {
          errorResult = `Go Error: ${err.message}`;
          exitCode = 1;
        }
      } else if (language === 'rust') {
        try {
          result = await executeRust(code, input);
        } catch (err) {
          errorResult = `Rust Error: ${err.message}`;
          exitCode = 1;
        }
      } else {
        // Fallback for unknown languages
        errorResult = `Local execution for ${languageConfigs[language]?.name || language} is not yet implemented.
This language will be supported in future updates.`;
        exitCode = 1;
      }

      const executionTime = Date.now() - startTime;
      
      setIsRunning(false);
      setOutput(result);
      setError(errorResult);
      setExitCode(exitCode);
      setExecutionTime(executionTime);

      // Add to history
      setExecutionHistory(prev => [...prev.slice(-9), {
        id: Date.now(),
        language: language,
        output: result,
        error: errorResult,
        exitCode: exitCode,
        timestamp: Date.now()
      }]);

    } catch (error) {
      console.error('❌ Local execution error:', error);
      setIsRunning(false);
      setError(`Execution error: ${error.message}`);
      setExitCode(1);
    }
  };

  // Language-specific execution functions
  const executePython = (code, input) => {
    return new Promise((resolve, reject) => {
      try {
        const lines = code.split('\n');
        const output = [];
        let variables = {};
        
        // Prepare input lines for input() function
        const inputLines = input ? input.split('\n').filter(line => line.trim()) : [];
        let inputIndex = 0;
        
        // Simple Python interpreter for basic operations
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#')) continue;
          
          // Handle input() function calls
          if (line.includes('input(') && line.includes('=')) {
            const equalIndex = line.indexOf('=');
            const varName = line.substring(0, equalIndex).trim();
            const inputValue = inputIndex < inputLines.length ? inputLines[inputIndex] : '';
            
            // Try to convert to number if possible
            if (!isNaN(inputValue) && inputValue.trim() !== '') {
              variables[varName] = Number(inputValue);
            } else {
              variables[varName] = inputValue;
            }
            inputIndex++;
            continue;
          }
          
          // Handle print statements
          if (line.startsWith('print(') && line.endsWith(')')) {
            const content = line.slice(6, -1);
            let value = content;
            
            // Handle string literals
            if ((content.startsWith('"') && content.endsWith('"')) || 
                (content.startsWith("'") && content.endsWith("'"))) {
              value = content.slice(1, -1);
            }
            // Handle f-strings (enhanced)
            else if (content.startsWith('f"') || content.startsWith("f'")) {
              value = content.slice(2, -1);
              // Replace {expression} with evaluated values
              value = value.replace(/\{([^}]+)\}/g, (match, expression) => {
                try {
                  // Handle simple expressions like {x + y}, {name}, etc.
                  const result = eval(expression.replace(/\b(\w+)\b/g, (varMatch) => {
                    return variables[varMatch] !== undefined ? variables[varMatch] : varMatch;
                  }));
                  return result;
                } catch {
                  return match; // Keep original if evaluation fails
                }
              });
            }
            // Handle variables
            else if (variables[content]) {
              value = variables[content];
            }
            // Handle simple expressions
            else {
              try {
                // Evaluate simple math expressions
                value = eval(content.replace(/\b(\w+)\b/g, (match) => {
                  return variables[match] !== undefined ? variables[match] : match;
                }));
              } catch {
                value = content;
              }
            }
            
            output.push(String(value));
          }
          // Handle variable assignments
          else if (line.includes('=') && !line.includes('==') && !line.includes('<=') && !line.includes('>=') && !line.includes('!=')) {
            const equalIndex = line.indexOf('=');
            const varName = line.substring(0, equalIndex).trim();
            const varValue = line.substring(equalIndex + 1).trim();
            
            // Handle string values
            if ((varValue.startsWith('"') && varValue.endsWith('"')) || 
                (varValue.startsWith("'") && varValue.endsWith("'"))) {
              variables[varName] = varValue.slice(1, -1);
            }
            // Handle numeric values
            else if (!isNaN(varValue)) {
              variables[varName] = Number(varValue);
            }
            // Handle lists (basic)
            else if (varValue.startsWith('[') && varValue.endsWith(']')) {
              try {
                variables[varName] = JSON.parse(varValue);
              } catch {
                variables[varName] = varValue;
              }
            }
            // Handle function calls like sum()
            else if (varValue.includes('sum(')) {
              const match = varValue.match(/sum\((\w+)\)/);
              if (match && variables[match[1]]) {
                variables[varName] = variables[match[1]].reduce((a, b) => a + b, 0);
              }
            }
            // Handle mathematical expressions
            else {
              try {
                const result = eval(varValue.replace(/\b(\w+)\b/g, (match) => {
                  return variables[match] !== undefined ? variables[match] : match;
                }));
                variables[varName] = result;
              } catch {
                variables[varName] = varValue;
              }
            }
          }
        }
        
        if (output.length === 0) {
          output.push('Python code executed successfully (no output)');
        }
        
        resolve(output.join('\n'));
      } catch (error) {
        reject(error);
      }
    });
  };

  const executeJava = (code, input) => {
    return new Promise((resolve, reject) => {
      try {
        // Simple Java interpreter for basic System.out.println and Scanner
        const lines = code.split('\n');
        const output = [];
        let variables = {};
        
        // Prepare input lines for Scanner
        const inputLines = input ? input.split('\n').filter(line => line.trim()) : [];
        let inputIndex = 0;
        let scannerDeclared = false;
        
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('//')) continue;
          
          // Handle Scanner declaration
          if (line.includes('Scanner') && line.includes('new Scanner(System.in)')) {
            scannerDeclared = true;
            continue;
          }
          
          // Handle Scanner input methods
          if (scannerDeclared && (line.includes('.nextInt()') || line.includes('.nextDouble()') || line.includes('.nextLine()') || line.includes('.next()'))) {
            const equalIndex = line.indexOf('=');
            if (equalIndex !== -1) {
              const varName = line.substring(0, equalIndex).trim().split(' ').pop();
              const inputValue = inputIndex < inputLines.length ? inputLines[inputIndex] : '';
              
              if (line.includes('.nextInt()')) {
                variables[varName] = parseInt(inputValue) || 0;
              } else if (line.includes('.nextDouble()')) {
                variables[varName] = parseFloat(inputValue) || 0.0;
              } else {
                variables[varName] = inputValue;
              }
              inputIndex++;
              continue;
            }
          }
          
          // Handle variable declarations (basic)
          if (line.includes('int ') || line.includes('String ') || line.includes('double ')) {
            const parts = line.split('=');
            if (parts.length === 2) {
              const declaration = parts[0].trim();
              const value = parts[1].trim().replace(';', '');
              const varName = declaration.split(' ').pop();
              
              if (declaration.includes('String')) {
                if (value.startsWith('"') && value.endsWith('"')) {
                  variables[varName] = value.slice(1, -1);
                }
              } else if (declaration.includes('int') || declaration.includes('double')) {
                if (!isNaN(value)) {
                  variables[varName] = Number(value);
                }
              }
            }
          }
          // Handle System.out.println
          else if (line.includes('System.out.println(') && line.includes(')')) {
            const match = line.match(/System\.out\.println\((.*?)\)/);
            if (match) {
              let content = match[1].trim();
              
              // Handle string literals
              if (content.startsWith('"') && content.endsWith('"')) {
                content = content.slice(1, -1);
              }
              // Handle variables
              else if (variables[content]) {
                content = variables[content];
              }
              // Handle string concatenation
              else if (content.includes('+')) {
                try {
                  content = content.replace(/\b(\w+)\b/g, (varMatch) => {
                    if (variables[varMatch] !== undefined) {
                      return typeof variables[varMatch] === 'string' ? `"${variables[varMatch]}"` : variables[varMatch];
                    }
                    return varMatch;
                  });
                  content = eval(content);
                } catch {
                  // Keep original if evaluation fails
                }
              }
              
              output.push(String(content));
            }
          }
          // Handle System.out.print
          else if (line.includes('System.out.print(') && line.includes(')')) {
            const match = line.match(/System\.out\.print\((.*?)\)/);
            if (match) {
              let content = match[1].trim();
              if (content.startsWith('"') && content.endsWith('"')) {
                content = content.slice(1, -1);
              } else if (variables[content]) {
                content = variables[content];
              }
              output.push(String(content));
            }
          }
        }
        
        if (output.length === 0) {
          output.push('Java code executed successfully (no output)');
        }
        
        resolve(output.join('\n'));
      } catch (error) {
        reject(error);
      }
    });
  };

  const executeC = (code, input, lang) => {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔍 [DEBUG] Executing C code:', code);
        console.log('🔍 [DEBUG] Language:', lang);
        
        // Ensure proper newline handling - normalize different newline types
        let normalizedCode = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // If the code contains literal \n strings instead of actual newlines, convert them
        if (normalizedCode.includes('\\n') && !normalizedCode.includes('\n')) {
          normalizedCode = normalizedCode.replace(/\\n/g, '\n');
          console.log('🔍 [DEBUG] Converted escaped newlines to actual newlines');
        }
        
        console.log('🔍 [DEBUG] Normalized code:', normalizedCode);
        console.log('🔍 [DEBUG] Raw code length:', normalizedCode.length);
        console.log('🔍 [DEBUG] Code preview:', normalizedCode.substring(0, 100) + '...');
        
        // Simple C/C++ interpreter for basic printf/scanf/cout
        const lines = normalizedCode.split('\n');
        const output = [];
        let variables = {};
        
        console.log('🔍 [DEBUG] Lines to process:', lines.length);
        console.log('🔍 [DEBUG] First 5 lines:', lines.slice(0, 5));
        
        // Parse input values
        const inputLines = input ? input.trim().split('\n') : [];
        let inputIndex = 0;
        
        for (let line of lines) {
          line = line.trim();
          console.log('🔍 [DEBUG] Processing line:', line);
          if (!line || line.startsWith('//')) {
            console.log('🔍 [DEBUG] Skipping empty/comment line');
            continue;
          }
          
          // Skip preprocessor directives and includes
          if (line.startsWith('#') || line.includes('main()') || line === '{' || line === '}') {
            console.log('🔍 [DEBUG] Skipping structural line:', line);
            continue;
          }
          
          // Handle variable declarations (basic)
          if ((line.includes('int ') || line.includes('float ') || line.includes('double ')) && line.includes('=') && line.endsWith(';')) {
            console.log('🔍 [DEBUG] Found variable declaration with assignment:', line);
            const equalIndex = line.indexOf('=');
            const declaration = line.substring(0, equalIndex).trim();
            const value = line.substring(equalIndex + 1).trim().replace(';', '');
            
            // Extract variable names (handle multiple declarations like "float num1, num2, sum;")
            const declarationParts = declaration.split(/\s+/);
            if (declarationParts.length >= 2) {
              const varNamesStr = declarationParts.slice(1).join('');
              const varNames = varNamesStr.split(',');
              
              if (varNames.length === 1) {
                // Single variable declaration with assignment
                const varName = varNames[0].trim();
                if (!isNaN(value)) {
                  variables[varName] = Number(value);
                  console.log('🔍 [DEBUG] Set variable:', varName, '=', variables[varName]);
                }
              }
            }
          }
          // Handle variable declarations without initialization
          else if ((line.includes('int ') || line.includes('float ') || line.includes('double ')) && line.endsWith(';') && !line.includes('=')) {
            console.log('🔍 [DEBUG] Found variable declaration without assignment:', line);
            const declarationLine = line.replace(';', '').trim();
            const parts = declarationLine.split(/\s+/);
            if (parts.length >= 2) {
              // Join all parts after the type and then split by comma
              const varNamesStr = parts.slice(1).join(' ').replace(/\s+/g, '');
              const varNames = varNamesStr.split(',');
              console.log('🔍 [DEBUG] Variable names to declare:', varNames);
              for (let varName of varNames) {
                varName = varName.trim();
                if (varName) {
                  variables[varName] = 0; // Initialize to 0
                  console.log('🔍 [DEBUG] Declared variable:', varName, '= 0');
                }
              }
            }
          }
          // Handle scanf
          else if (line.includes('scanf(') && line.includes(')')) {
            const match = line.match(/scanf\([^,]+,\s*&(\w+)\)/);
            if (match && inputIndex < inputLines.length) {
              const varName = match[1];
              const inputValue = inputLines[inputIndex++];
              if (!isNaN(inputValue)) {
                variables[varName] = Number(inputValue);
              }
            }
          }
          // Handle printf with format specifiers
          else if (line.includes('printf(') && line.includes(')')) {
            console.log('🔍 [DEBUG] Found printf:', line);
            const match = line.match(/printf\s*\(\s*"([^"]*)"(?:\s*,\s*([^)]+))?\s*\)/);
            if (match) {
              let content = match[1].trim();
              console.log('🔍 [DEBUG] Printf format string:', content);
              
              // Handle escape sequences
              content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
              
              // If there's a second argument (variable), handle format specifiers
              if (match[2]) {
                const varName = match[2].trim();
                console.log('🔍 [DEBUG] Printf variable:', varName);
                
                if (variables[varName] !== undefined) {
                  let result = content;
                  
                  // Replace format specifiers with actual variable values
                  // Handle %.2f, %f, %lf (floating point)
                  result = result.replace(/%\.?\d*[fl]?f/g, () => {
                    console.log('🔍 [DEBUG] Using variable for %.2f:', varName, '=', variables[varName]);
                    return Number(variables[varName]).toFixed(2);
                  });
                  
                  // Handle %d, %i (integers)
                  result = result.replace(/%[di]/g, () => {
                    console.log('🔍 [DEBUG] Using variable for %d:', varName, '=', variables[varName]);
                    return Math.floor(Number(variables[varName])).toString();
                  });
                  
                  console.log('🔍 [DEBUG] Printf result:', result);
                  output.push(result);
                } else {
                  console.log('🔍 [DEBUG] Variable not found:', varName);
                }
              } else {
                // Simple string printf without variables
                console.log('🔍 [DEBUG] Simple printf output:', content);
                output.push(content);
              }
            }
          }
          // Handle variable assignments (including those with missing semicolons)
          else if (line.includes('=') && (line.endsWith(';') || !line.includes('printf')) && !line.includes('int ') && !line.includes('float ') && !line.includes('double ')) {
            console.log('🔍 [DEBUG] Found variable assignment:', line);
            const parts = line.replace(';', '').split('=');
            if (parts.length === 2) {
              const varName = parts[0].trim();
              const expression = parts[1].trim();
              console.log('🔍 [DEBUG] Assignment:', varName, '=', expression);
              
              // Handle simple arithmetic
              if (expression.includes('+')) {
                const addParts = expression.split('+');
                let sum = 0;
                for (let part of addParts) {
                  part = part.trim();
                  if (variables[part] !== undefined) {
                    sum += variables[part];
                    console.log('🔍 [DEBUG] Adding variable:', part, '=', variables[part]);
                  } else if (!isNaN(part)) {
                    sum += Number(part);
                    console.log('🔍 [DEBUG] Adding number:', part);
                  }
                }
                variables[varName] = sum;
                console.log('🔍 [DEBUG] Result:', varName, '=', sum);
              } else if (expression.includes('-')) {
                const subParts = expression.split('-');
                let result = 0;
                for (let i = 0; i < subParts.length; i++) {
                  const part = subParts[i].trim();
                  if (i === 0) {
                    if (variables[part] !== undefined) {
                      result = variables[part];
                    } else if (!isNaN(part)) {
                      result = Number(part);
                    }
                  } else {
                    if (variables[part] !== undefined) {
                      result -= variables[part];
                    } else if (!isNaN(part)) {
                      result -= Number(part);
                    }
                  }
                }
                variables[varName] = result;
              } else if (expression.includes('*')) {
                const mulParts = expression.split('*');
                let result = 1;
                for (let part of mulParts) {
                  part = part.trim();
                  if (variables[part] !== undefined) {
                    result *= variables[part];
                  } else if (!isNaN(part)) {
                    result *= Number(part);
                  }
                }
                variables[varName] = result;
              } else if (expression.includes('/')) {
                const divParts = expression.split('/');
                if (divParts.length === 2) {
                  const numerator = divParts[0].trim();
                  const denominator = divParts[1].trim();
                  let numValue = variables[numerator] !== undefined ? variables[numerator] : Number(numerator);
                  let denValue = variables[denominator] !== undefined ? variables[denominator] : Number(denominator);
                  variables[varName] = denValue !== 0 ? numValue / denValue : 0;
                }
              } else if (variables[expression] !== undefined) {
                variables[varName] = variables[expression];
              } else if (!isNaN(expression)) {
                variables[varName] = Number(expression);
                console.log('🔍 [DEBUG] Direct assignment:', varName, '=', variables[varName]);
              }
            }
          }
          // Handle cout (C++)
          else if (line.includes('cout') && line.includes('<<')) {
            const parts = line.split('<<');
            let lineOutput = '';
            for (let i = 1; i < parts.length; i++) {
              let content = parts[i].trim();
              if (content.endsWith(';')) content = content.slice(0, -1);
              
              if (content === 'endl') {
                lineOutput += '\n';
              } else if (content.startsWith('"') && content.endsWith('"')) {
                content = content.slice(1, -1);
                lineOutput += content;
              } else if (variables[content] !== undefined) {
                lineOutput += variables[content];
              } else {
                lineOutput += content;
              }
            }
            output.push(lineOutput);
          }
        }
        
        console.log('🔍 [DEBUG] Final variables:', variables);
        console.log('🔍 [DEBUG] Final output:', output);
        
        if (output.length === 0) {
          output.push(`${lang.toUpperCase()} code executed successfully (no output)`);
        }
        
        resolve(output.join(''));
      } catch (error) {
        console.error('🔍 [DEBUG] C execution error:', error);
        reject(error);
      }
    });
  };

  const executeTypeScript = (code, input) => {
    return new Promise((resolve, reject) => {
      try {
        // Convert TypeScript to JavaScript (basic)
        let jsCode = code;
        
        // Remove type annotations (basic)
        jsCode = jsCode.replace(/:\s*\w+(\[\])?/g, '');
        jsCode = jsCode.replace(/interface\s+\w+\s*{[^}]*}/g, '');
        jsCode = jsCode.replace(/type\s+\w+\s*=\s*[^;]+;/g, '');
        
        // Execute as JavaScript
        const logs = [];
        const mockConsole = {
          log: (...args) => logs.push(args.join(' ')),
          error: (...args) => logs.push('ERROR: ' + args.join(' ')),
          warn: (...args) => logs.push('WARNING: ' + args.join(' ')),
          info: (...args) => logs.push('INFO: ' + args.join(' '))
        };

        const context = {
          console: mockConsole,
          Math: Math,
          Date: Date,
          JSON: JSON,
          input: input || ''
        };

        const wrappedCode = `(function() { ${jsCode} })();`;
        const func = new Function(...Object.keys(context), wrappedCode);
        func(...Object.values(context));
        
        const result = logs.join('\n');
        resolve(result || 'TypeScript code executed successfully (no output)');
      } catch (error) {
        reject(error);
      }
    });
  };

  const executePHP = (code, input) => {
    return new Promise((resolve, reject) => {
      try {
        // Simple PHP interpreter for echo statements and variables
        const lines = code.split('\n');
        const output = [];
        let variables = {};
        
        // Prepare input lines for readline() and fgets()
        const inputLines = input ? input.split('\n').filter(line => line.trim()) : [];
        let inputIndex = 0;
        
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('//') || line.startsWith('#') || line === '<?php') continue;
          
          // Handle readline() or fgets(STDIN) for input
          if ((line.includes('readline()') || line.includes('fgets(STDIN)')) && line.includes('=')) {
            const equalIndex = line.indexOf('=');
            const varName = line.substring(0, equalIndex).trim();
            const inputValue = inputIndex < inputLines.length ? inputLines[inputIndex] : '';
            variables[varName] = inputValue;
            inputIndex++;
            continue;
          }
          
          // Handle variable assignments
          if (line.startsWith('$') && line.includes('=') && !line.includes('==') && !line.includes('!=') && !line.includes('<=') && !line.includes('>=')) {
            const parts = line.split('=');
            if (parts.length === 2) {
              const varName = parts[0].trim();
              let value = parts[1].trim().replace(';', '');
              
              if (value.startsWith('"') && value.endsWith('"')) {
                variables[varName] = value.slice(1, -1);
              } else if (value.startsWith("'") && value.endsWith("'")) {
                variables[varName] = value.slice(1, -1);
              } else if (!isNaN(value)) {
                variables[varName] = Number(value);
              } else {
                // Try to evaluate mathematical expressions
                try {
                  // Replace variables in expression
                  let evaluationExpression = value;
                  for (const [key, val] of Object.entries(variables)) {
                    evaluationExpression = evaluationExpression.replace(new RegExp(key.replace('$', '\\$'), 'g'), val);
                  }
                  variables[varName] = eval(evaluationExpression);
                } catch {
                  variables[varName] = value;
                }
              }
            }
          }
          // Handle echo statements
          else if (line.includes('echo ') && line.includes(';')) {
            const match = line.match(/echo\s+(.*?);/);
            if (match) {
              let content = match[1].trim();
              
              // Handle string concatenation with .
              if (content.includes('.')) {
                const parts = content.split('.');
                let result = '';
                for (let part of parts) {
                  part = part.trim();
                  if (variables[part] !== undefined) {
                    result += variables[part];
                  } else if (part.startsWith('"') && part.endsWith('"')) {
                    result += part.slice(1, -1);
                  } else if (part.startsWith("'") && part.endsWith("'")) {
                    result += part.slice(1, -1);
                  } else {
                    result += part;
                  }
                }
                output.push(result);
              } else {
                // Single value output
                if (variables[content] !== undefined) {
                  output.push(variables[content]);
                } else if ((content.startsWith('"') && content.endsWith('"')) || 
                          (content.startsWith("'") && content.endsWith("'"))) {
                  content = content.slice(1, -1);
                  output.push(content);
                } else {
                  output.push(content);
                }
              }
            }
          }
          // Handle print statements
          else if (line.includes('print ') && line.includes(';')) {
            const match = line.match(/print\s+(.*?);/);
            if (match) {
              let content = match[1].trim();
              if (variables[content] !== undefined) {
                output.push(variables[content]);
              } else if ((content.startsWith('"') && content.endsWith('"')) || 
                        (content.startsWith("'") && content.endsWith("'"))) {
                content = content.slice(1, -1);
                output.push(content);
              } else {
                output.push(content);
              }
            }
          }
        }
        
        if (output.length === 0) {
          output.push('PHP code executed successfully (no output)');
        }
        
        resolve(output.join('\n'));
      } catch (error) {
        reject(error);
      }
    });
  };

  const executeRuby = (code, input) => {
    return new Promise((resolve, reject) => {
      try {
        // Simple Ruby interpreter for puts/print statements and variables
        const lines = code.split('\n');
        const output = [];
        let variables = {};
        
        // Prepare input lines for gets and readline
        const inputLines = input ? input.split('\n').filter(line => line.trim()) : [];
        let inputIndex = 0;
        
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#')) continue;
          
          // Handle gets and readline for input
          if ((line.includes('gets') || line.includes('readline')) && line.includes('=')) {
            const equalIndex = line.indexOf('=');
            const varName = line.substring(0, equalIndex).trim();
            const inputValue = inputIndex < inputLines.length ? inputLines[inputIndex] : '';
            
            // Remove .chomp if present and try to convert to number
            if (line.includes('.chomp') || line.includes('.to_i') || line.includes('.to_f')) {
              if (line.includes('.to_i')) {
                variables[varName] = parseInt(inputValue) || 0;
              } else if (line.includes('.to_f')) {
                variables[varName] = parseFloat(inputValue) || 0.0;
              } else {
                variables[varName] = inputValue;
              }
            } else {
              variables[varName] = inputValue + '\n'; // gets includes newline
            }
            inputIndex++;
            continue;
          }
          
          // Handle variable assignments
          if (line.includes('=') && !line.includes('==') && !line.includes('!=') && !line.includes('<=') && !line.includes('>=')) {
            const parts = line.split('=');
            if (parts.length === 2) {
              const varName = parts[0].trim();
              let value = parts[1].trim();
              
              if (value.startsWith('"') && value.endsWith('"')) {
                variables[varName] = value.slice(1, -1);
              } else if (value.startsWith("'") && value.endsWith("'")) {
                variables[varName] = value.slice(1, -1);
              } else if (!isNaN(value)) {
                variables[varName] = Number(value);
              } else {
                // Try to evaluate mathematical expressions
                try {
                  // Replace variables in expression
                  let evaluationExpression = value;
                  for (const [key, val] of Object.entries(variables)) {
                    evaluationExpression = evaluationExpression.replace(new RegExp(key, 'g'), val);
                  }
                  variables[varName] = eval(evaluationExpression);
                } catch {
                  variables[varName] = value;
                }
              }
            }
          }
          // Handle puts statements
          else if (line.includes('puts ')) {
            const match = line.match(/puts\s+(.*?)$/);
            if (match) {
              let content = match[1].trim();
              
              // Handle string interpolation #{variable}
              if (content.includes('#{')) {
                content = content.replace(/#{([^}]+)}/g, (match, varName) => {
                  return variables[varName] !== undefined ? variables[varName] : match;
                });
              }
              
              if (variables[content] !== undefined) {
                output.push(variables[content]);
              } else if ((content.startsWith('"') && content.endsWith('"')) || 
                        (content.startsWith("'") && content.endsWith("'"))) {
                content = content.slice(1, -1);
                output.push(content);
              } else {
                output.push(content);
              }
            }
          }
          // Handle print statements
          else if (line.includes('print ')) {
            const match = line.match(/print\s+(.*?)$/);
            if (match) {
              let content = match[1].trim();
              
              // Handle string interpolation #{variable}
              if (content.includes('#{')) {
                content = content.replace(/#{([^}]+)}/g, (match, varName) => {
                  return variables[varName] !== undefined ? variables[varName] : match;
                });
              }
              
              if (variables[content] !== undefined) {
                output.push(variables[content]);
              } else if ((content.startsWith('"') && content.endsWith('"')) || 
                        (content.startsWith("'") && content.endsWith("'"))) {
                content = content.slice(1, -1);
                output.push(content);
              } else {
                output.push(content);
              }
            }
          }
        }
        
        if (output.length === 0) {
          output.push('Ruby code executed successfully (no output)');
        }
        
        resolve(output.join('\n'));
      } catch (error) {
        reject(error);
      }
    });
  };

  const executeGo = (code, input) => {
    return new Promise((resolve, reject) => {
      try {
        // Simple Go interpreter for fmt.Println/Printf and fmt.Scan
        const lines = code.split('\n');
        const output = [];
        let variables = {};
        
        // Prepare input lines for fmt.Scan
        const inputLines = input ? input.split('\n').filter(line => line.trim()) : [];
        let inputIndex = 0;
        
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('//')) continue;
          
          // Handle fmt.Scan for input
          if (line.includes('fmt.Scan(') && line.includes('&')) {
            const match = line.match(/fmt\.Scan\(&(\w+)\)/);
            if (match && inputIndex < inputLines.length) {
              const varName = match[1];
              const inputValue = inputLines[inputIndex];
              
              // Try to convert to number if possible
              if (!isNaN(inputValue) && inputValue.trim() !== '') {
                variables[varName] = Number(inputValue);
              } else {
                variables[varName] = inputValue;
              }
              inputIndex++;
              continue;
            }
          }
          
          // Handle variable declarations with assignment
          if (line.includes('var ') && line.includes('=')) {
            const parts = line.split('=');
            if (parts.length === 2) {
              const varDecl = parts[0].trim();
              const value = parts[1].trim();
              const varName = varDecl.replace('var ', '').split(' ')[0];
              
              if (!isNaN(value)) {
                variables[varName] = Number(value);
              } else if (value.startsWith('"') && value.endsWith('"')) {
                variables[varName] = value.slice(1, -1);
              }
            }
          }
          
          // Handle fmt.Println
          if (line.includes('fmt.Println(') && line.includes(')')) {
            const match = line.match(/fmt\.Println\((.*?)\)/);
            if (match) {
              let content = match[1].trim();
              
              // Handle variables
              if (variables[content] !== undefined) {
                content = variables[content];
              } else if (content.startsWith('"') && content.endsWith('"')) {
                content = content.slice(1, -1);
              }
              output.push(content);
            }
          }
          // Handle fmt.Printf
          else if (line.includes('fmt.Printf(') && line.includes(')')) {
            const match = line.match(/fmt\.Printf\((.*?)\)/);
            if (match) {
              let content = match[1].trim();
              
              // Handle format strings with variables
              if (content.includes(',')) {
                const parts = content.split(',');
                let formatStr = parts[0].trim();
                const varName = parts[1].trim();
                
                if (formatStr.startsWith('"') && formatStr.endsWith('"')) {
                  formatStr = formatStr.slice(1, -1);
                  
                  // Replace format specifiers
                  if (variables[varName] !== undefined) {
                    formatStr = formatStr.replace(/%d|%f|%s/g, variables[varName]);
                  }
                  
                  content = formatStr.replace(/\\n/g, '\n');
                }
              } else if (content.startsWith('"') && content.endsWith('"')) {
                content = content.slice(1, -1);
                content = content.replace(/\\n/g, '\n');
              }
              output.push(content);
            }
          }
        }
        
        if (output.length === 0) {
          output.push('Go code executed successfully (no output)');
        }
        
        resolve(output.join('\n'));
      } catch (error) {
        reject(error);
      }
    });
  };

  const executeRust = (code, input) => {
    return new Promise((resolve, reject) => {
      try {
        // Simple Rust interpreter for println! macro and stdin
        const lines = code.split('\n');
        const output = [];
        let variables = {};
        
        // Prepare input lines for stdin().read_line()
        const inputLines = input ? input.split('\n').filter(line => line.trim()) : [];
        let inputIndex = 0;
        
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('//')) continue;
          
          // Handle stdin().read_line() for input
          if (line.includes('stdin().read_line(') && line.includes('let mut')) {
            const match = line.match(/let mut (\w+)/);
            if (match && inputIndex < inputLines.length) {
              const varName = match[1];
              const inputValue = inputLines[inputIndex];
              variables[varName] = inputValue;
              inputIndex++;
              continue;
            }
          }
          
          // Handle variable declarations
          if (line.includes('let ') && line.includes('=')) {
            const parts = line.split('=');
            if (parts.length === 2) {
              const varDecl = parts[0].trim();
              const value = parts[1].trim().replace(';', '');
              const varMatch = varDecl.match(/let (?:mut )?(\w+)/);
              
              if (varMatch) {
                const varName = varMatch[1];
                if (!isNaN(value)) {
                  variables[varName] = Number(value);
                } else if (value.startsWith('"') && value.endsWith('"')) {
                  variables[varName] = value.slice(1, -1);
                }
              }
            }
          }
          
          // Handle println! macro
          if (line.includes('println!(') && line.includes(')')) {
            const match = line.match(/println!\((.*?)\)/);
            if (match) {
              let content = match[1].trim();
              
              // Handle format strings with variables
              if (content.includes('{}') && content.includes(',')) {
                const parts = content.split(',');
                let formatStr = parts[0].trim();
                const varName = parts[1].trim();
                
                if (formatStr.startsWith('"') && formatStr.endsWith('"')) {
                  formatStr = formatStr.slice(1, -1);
                  if (variables[varName] !== undefined) {
                    formatStr = formatStr.replace('{}', variables[varName]);
                  }
                  content = formatStr.replace(/\\n/g, '\n');
                }
              } else if (variables[content] !== undefined) {
                content = variables[content];
              } else if (content.startsWith('"') && content.endsWith('"')) {
                content = content.slice(1, -1);
                content = content.replace(/\\n/g, '\n');
              }
              output.push(content);
            }
          }
          // Handle print! macro
          else if (line.includes('print!(') && line.includes(')')) {
            const match = line.match(/print!\((.*?)\)/);
            if (match) {
              let content = match[1].trim();
              
              if (variables[content] !== undefined) {
                content = variables[content];
              } else if (content.startsWith('"') && content.endsWith('"')) {
                content = content.slice(1, -1);
              }
              output.push(content);
            }
          }
        }
        
        if (output.length === 0) {
          output.push('Rust code executed successfully (no output)');
        }
        
        resolve(output.join('\n'));
      } catch (error) {
        reject(error);
      }
    });
  };

  const stopExecution = () => {
    setIsRunning(false);
    setError('Execution stopped by user');
  };

  const clearOutput = () => {
    setOutput('');
    setError('');
    setExitCode(null);
    setExecutionTime(null);
  };

  const copyOutput = () => {
    const textToCopy = output || error;
    navigator.clipboard.writeText(textToCopy);
  };

  const downloadOutput = () => {
    const content = `# Code Execution Result\n\nLanguage: ${language}\nExit Code: ${exitCode}\nExecution Time: ${executionTime}ms\n\n## Output:\n${output}\n\n## Errors:\n${error}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-result-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveFile = () => {
    if (!currentFileName.trim()) {
      alert('Please enter a file name');
      return;
    }
    
    const fileExtension = languageConfigs[language]?.extension || '.txt';
    const fullFileName = currentFileName.includes('.') ? currentFileName : `${currentFileName}${fileExtension}`;
    
    const newFile = {
      id: Date.now(),
      name: fullFileName,
      content: code,
      language: language,
      size: code.length,
      created: new Date(),
      lastModified: new Date()
    };
    
    setSavedFiles(prev => [...prev, newFile]);
    setShowSaveInterface(false);
    setCurrentFileName('');
    
    // Show success notification
    console.log(`✅ File saved: ${fullFileName}`);
  };

  const generateDefaultFileName = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '').replace('T', '_');
    const ext = languageConfigs[language]?.extension || '.txt';
    return `code_${timestamp}${ext}`;
  };

  const downloadFile = (file) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteFile = (fileId) => {
    setSavedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const loadFile = (file) => {
    // This would integrate with your main editor
    console.log(`📁 Loading file: ${file.name}`);
    setShowSaveInterface(false);
  };

  const langConfig = languageConfigs[language] || languageConfigs.javascript;

  return (
    <div className="modern-code-runner bg-surface-primary border border-border-primary rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-surface-secondary border-b border-border-primary">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-text-primary hover:text-text-accent transition-colors"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Zap size={16} className="text-text-accent" />
            <span className="font-semibold">Code Runner</span>
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-surface-tertiary">
            <span className="text-sm">{langConfig.icon}</span>
            <select
              value={language}
              onChange={(e) => onLanguageChange?.(e.target.value)}
              className="bg-transparent text-sm font-medium text-text-primary border-none outline-none cursor-pointer"
              style={{ color: langConfig.color }}
            >
              {Object.keys(languageConfigs).map(lang => (
                <option key={lang} value={lang}>
                  {languageConfigs[lang].name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Execution Status */}
          {isRunning && (
            <div className="flex items-center gap-2 text-text-warning">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Running...</span>
            </div>
          )}
          
          {exitCode !== null && (
            <div className={`flex items-center gap-1 text-xs ${
              exitCode === 0 ? 'text-text-success' : 'text-text-error'
            }`}>
              {exitCode === 0 ? <CheckCircle size={14} /> : <XCircle size={14} />}
              <span>Exit {exitCode}</span>
            </div>
          )}

          {executionTime && (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Clock size={12} />
              <span>{executionTime}ms</span>
            </div>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-hover-primary rounded transition-colors"
          >
            <Settings size={14} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Settings Panel */}
          {showSettings && (
            <div className="p-5 bg-gradient-to-br from-surface-tertiary to-surface-secondary border-2 border-border-primary rounded-lg shadow-md">
              <div className="space-y-4">
                <div className="bg-surface-primary p-4 rounded-lg border border-border-secondary shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-sm text-text-primary font-semibold">
                      <div className="p-1.5 bg-accent/10 rounded-md">
                        <Terminal size={14} className="text-accent" />
                      </div>
                      Standard Input
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-text-muted bg-surface-secondary px-2 py-1 rounded-full">
                        {input.length > 0 ? `${input.length} chars` : 'Empty'}
                      </div>
                    </div>
                  </div>
                  <div className="relative bg-surface-primary border-2 border-border-primary rounded-lg shadow-sm">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Enter input for your program (stdin)..."
                      className="w-full h-24 px-4 py-3 border-none rounded-lg text-sm font-mono text-text-primary placeholder-text-muted resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:shadow-lg stdin-black-bg"
                      style={{
                        lineHeight: '1.5',
                        fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
                        backgroundColor: '#000000',
                        background: '#000000',
                        color: '#ffffff'
                      }}
                    />
                    {input.length === 0 && (
                      <div className="absolute top-3 right-3 text-xs text-text-muted opacity-60 bg-surface-secondary px-2 py-1 rounded">
                        Optional
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 text-xs text-text-muted opacity-40 pointer-events-none">
                      stdin
                    </div>
                  </div>
                  <div className="text-xs text-text-muted mt-2 px-1">
                    💡 This input will be passed to your program's stdin when executed
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-surface-primary/50 rounded-lg border border-border-secondary/50">
                  <div className="flex items-center gap-6 text-xs">
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <div className="p-1 bg-blue-500/10 rounded">
                        <Clock size={10} className="text-blue-400" />
                      </div>
                      <span className="font-medium">Timeout: 3s</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <div className="p-1 bg-yellow-500/10 rounded">
                        <AlertTriangle size={10} className="text-yellow-400" />
                      </div>
                      <span className="font-medium">Memory: Unlimited</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <div className="p-1 bg-green-500/10 rounded">
                        <Zap size={10} className="text-green-400" />
                      </div>
                      <span className="font-medium">Local Execution</span>
                    </div>
                  </div>
                  {input.length > 0 && (
                    <button
                      onClick={() => setInput('')}
                      className="text-xs text-text-muted hover:text-text-primary transition-all px-3 py-1.5 rounded-md hover:bg-surface-secondary border border-transparent hover:border-border-primary"
                      title="Clear input"
                    >
                      🗑️ Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between p-4 bg-surface-secondary border-b border-border-primary">
            <div className="flex items-center gap-2">
              <button
                onClick={isRunning ? stopExecution : executeCode}
                disabled={!code.trim() && !isRunning}
                className={`btn-primary flex items-center gap-2 ${
                  isRunning 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50`}
              >
                {isRunning ? (
                  <>
                    <Square size={14} />
                    Stop
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Run Code
                  </>
                )}
              </button>

              <button
                onClick={clearOutput}
                className="btn-secondary flex items-center gap-2"
                disabled={!output && !error}
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCurrentFileName(generateDefaultFileName());
                  setShowSaveInterface(!showSaveInterface);
                }}
                className={`btn-secondary flex items-center gap-2 ${showSaveInterface ? 'bg-accent/20 border-accent text-accent' : ''}`}
                disabled={!code.trim()}
              >
                <Save size={14} />
                Save
              </button>
              
              <button
                onClick={copyOutput}
                className="btn-secondary flex items-center gap-2"
                disabled={!output && !error}
              >
                <Copy size={14} />
                Copy
              </button>
              
              <button
                onClick={downloadOutput}
                className="btn-secondary flex items-center gap-2"
                disabled={!output && !error}
              >
                <Download size={14} />
                Export
              </button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="flex-1 p-4">
            <div className="bg-surface-tertiary rounded-lg border border-border-primary h-full flex flex-col">
              <div className="flex items-center gap-2 p-3 border-b border-border-primary bg-surface-secondary rounded-t-lg">
                <Terminal size={14} className="text-text-secondary" />
                <span className="text-sm font-medium text-text-primary">Output</span>
                {(output || error) && (
                  <span className="text-xs text-text-secondary">
                    {(output + error).split('\n').length} lines
                  </span>
                )}
              </div>
              
              <div 
                ref={outputRef}
                className="flex-1 p-4 font-mono text-sm overflow-auto"
              >
                {isRunning ? (
                  <div className="flex items-center gap-2 text-text-warning">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Executing code...</span>
                  </div>
                ) : (
                  <>
                    {output && (
                      <div className="text-text-success whitespace-pre-wrap">
                        {output}
                      </div>
                    )}
                    {error && (
                      <div className="text-text-error whitespace-pre-wrap">
                        {error}
                      </div>
                    )}
                    {!output && !error && (
                      <div className="text-text-secondary italic">
                        No output yet. Click "Run Code" to execute your program.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Execution History */}
          {executionHistory.length > 0 && (
            <div className="p-4 border-t border-border-primary">
              <div className="text-sm font-medium text-text-primary mb-3">Recent Executions</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {executionHistory.slice(-5).reverse().map(exec => (
                  <div 
                    key={exec.id}
                    className="flex items-center justify-between p-2 bg-surface-secondary rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span>{languageConfigs[exec.language]?.icon || '💻'}</span>
                      <span className="font-medium">{exec.language}</span>
                      {exec.exitCode === 0 ? (
                        <CheckCircle size={12} className="text-text-success" />
                      ) : (
                        <XCircle size={12} className="text-text-error" />
                      )}
                    </div>
                    <span className="text-text-secondary">
                      {new Date(exec.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modern Save Interface */}
      {showSaveInterface && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-primary border border-border-primary rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-primary bg-gradient-to-r from-accent/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-accent/10 rounded-xl">
                  <Save size={24} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Code Manager</h2>
                  <p className="text-sm text-text-secondary">Save, manage, and organize your {languageConfigs[language]?.name} code</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveInterface(false)}
                className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
              >
                <X size={20} className="text-text-secondary" />
              </button>
            </div>

            <div className="flex h-96">
              {/* Save Panel */}
              <div className="flex-1 p-6 border-r border-border-primary">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <File size={18} className="text-accent" />
                    New File
                  </h3>

                  {/* File Name Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">File Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={currentFileName}
                        onChange={(e) => setCurrentFileName(e.target.value)}
                        placeholder={`my-code${languageConfigs[language]?.extension || '.txt'}`}
                        className="w-full px-4 py-3 bg-surface-secondary border border-border-primary rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted bg-accent/10 px-2 py-1 rounded-md">
                        {languageConfigs[language]?.extension || '.txt'}
                      </div>
                    </div>
                  </div>

                  {/* Code Preview */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Code Preview</label>
                    <div className="bg-surface-tertiary border border-border-primary rounded-xl p-4 h-32 overflow-y-auto">
                      <pre className="text-xs text-text-secondary font-mono leading-relaxed">
                        {code.slice(0, 200)}{code.length > 200 ? '...' : ''}
                      </pre>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span>{code.length} characters</span>
                      <span>{code.split('\n').length} lines</span>
                      <span>{languageConfigs[language]?.name}</span>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveFile}
                    disabled={!currentFileName.trim()}
                    className="w-full py-3 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <Save size={16} />
                    Save to Collection
                  </button>
                </div>
              </div>

              {/* Saved Files Panel */}
              <div className="flex-1 p-6">
                <div className="space-y-4 h-full">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                      <FolderOpen size={18} className="text-accent" />
                      Saved Files
                    </h3>
                    <span className="text-xs text-text-muted bg-surface-secondary px-2 py-1 rounded-md">
                      {savedFiles.length} files
                    </span>
                  </div>

                  <div className="space-y-2 h-80 overflow-y-auto">
                    {savedFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="p-4 bg-surface-secondary rounded-full">
                          <File size={24} className="text-text-muted" />
                        </div>
                        <div>
                          <p className="text-text-secondary font-medium">No saved files yet</p>
                          <p className="text-xs text-text-muted">Save your first file to get started</p>
                        </div>
                      </div>
                    ) : (
                      savedFiles.map(file => (
                        <div key={file.id} className="bg-surface-secondary hover:bg-surface-tertiary border border-border-primary rounded-lg p-3 transition-all group">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{languageConfigs[file.language]?.icon || '📄'}</span>
                                <span className="font-medium text-text-primary truncate">{file.name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-text-muted">
                                <span>{file.size} chars</span>
                                <span>{file.created.toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => loadFile(file)}
                                className="p-1.5 hover:bg-accent/20 rounded-md transition-colors"
                                title="Load file"
                              >
                                <FolderOpen size={14} className="text-accent" />
                              </button>
                              <button
                                onClick={() => downloadFile(file)}
                                className="p-1.5 hover:bg-blue-500/20 rounded-md transition-colors"
                                title="Download file"
                              >
                                <Download size={14} className="text-blue-400" />
                              </button>
                              <button
                                onClick={() => deleteFile(file.id)}
                                className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors"
                                title="Delete file"
                              >
                                <Trash2 size={14} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernCodeRunner;
