import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Terminal, 
  AlertTriangle,
  Copy,
  Trash2
} from 'lucide-react';
import { PistonExecuteResponse } from '../services/pistonApi';
import { toast } from 'sonner';

export interface ExecutionResult {
  id: string;
  timestamp: Date;
  language: string;
  version: string;
  code: string;
  response: PistonExecuteResponse;
  duration?: number;
}

interface ExecutionResultsProps {
  results: ExecutionResult[];
  isExecuting: boolean;
  onClearResults: () => void;
}

export function ExecutionResults({ results, isExecuting, onClearResults }: ExecutionResultsProps) {
  const [selectedResult, setSelectedResult] = useState<ExecutionResult | null>(null);

  // Auto-select the latest result
  useEffect(() => {
    if (results.length > 0 && !selectedResult) {
      setSelectedResult(results[results.length - 1]);
    }
  }, [results, selectedResult]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getStatusIcon = (result: ExecutionResult) => {
    const hasCompileError = result.response.compile && result.response.compile.code !== 0;
    const hasRuntimeError = result.response.run.code !== 0;
    
    if (hasCompileError || hasRuntimeError) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = (result: ExecutionResult) => {
    const hasCompileError = result.response.compile && result.response.compile.code !== 0;
    const hasRuntimeError = result.response.run.code !== 0;
    
    if (hasCompileError) return 'Compilation Error';
    if (hasRuntimeError) return 'Runtime Error';
    return 'Success';
  };

  const formatOutput = (output: string) => {
    if (!output || output.trim() === '') {
      return '(No output)';
    }
    return output;
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;
  };

  if (results.length === 0 && !isExecuting) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No execution results</h3>
            <p>Run some code to see the output here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Execution Results
            {isExecuting && (
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Clock className="h-4 w-4 animate-spin" />
                Running...
              </div>
            )}
          </CardTitle>
          {results.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearResults}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        {results.length > 0 && (
          <div className="flex flex-col h-full gap-4">
            {/* Results History */}
            <div className="flex-shrink-0">
              <h4 className="text-sm font-medium mb-2">Recent Executions</h4>
              <ScrollArea className="max-h-32">
                <div className="space-y-1">
                  {results.slice(-5).reverse().map((result) => (
                    <button
                      key={result.id}
                      onClick={() => setSelectedResult(result)}
                      className={`w-full flex items-center justify-between p-2 rounded text-left text-sm transition-colors ${
                        selectedResult?.id === result.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result)}
                        <span>{result.language}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.timestamp.toLocaleTimeString()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {formatDuration(result.duration)}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Selected Result Details */}
            {selectedResult && (
              <div className="flex-1 min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedResult)}
                    <span className="font-medium">{getStatusText(selectedResult)}</span>
                    <Badge variant="secondary">
                      {selectedResult.language} {selectedResult.version}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedResult.timestamp.toLocaleString()}
                  </div>
                </div>

                <Tabs defaultValue="output" className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="output">Output</TabsTrigger>
                    <TabsTrigger value="errors">Errors</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                  </TabsList>

                  <TabsContent value="output" className="flex-1 mt-4">
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium">Standard Output</h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedResult.response.run.stdout)}
                          className="h-6 px-2"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <ScrollArea className="flex-1 border rounded">
                        <pre className="p-3 text-sm font-mono whitespace-pre-wrap">
                          {formatOutput(selectedResult.response.run.stdout)}
                        </pre>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="errors" className="flex-1 mt-4">
                    <div className="h-full flex flex-col space-y-4">
                      {/* Compilation Errors */}
                      {selectedResult.response.compile && (
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-medium flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Compilation Errors
                            </h5>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(selectedResult.response.compile?.stderr || '')}
                              className="h-6 px-2"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <ScrollArea className="border rounded max-h-32">
                            <pre className="p-3 text-sm font-mono whitespace-pre-wrap text-red-600">
                              {formatOutput(selectedResult.response.compile.stderr)}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Runtime Errors */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium flex items-center gap-1">
                            <XCircle className="h-4 w-4" />
                            Runtime Errors
                          </h5>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedResult.response.run.stderr)}
                            className="h-6 px-2"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <ScrollArea className="border rounded flex-1">
                          <pre className="p-3 text-sm font-mono whitespace-pre-wrap text-red-600">
                            {formatOutput(selectedResult.response.run.stderr)}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="details" className="flex-1 mt-4">
                    <ScrollArea className="h-full">
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-sm font-medium mb-2">Execution Details</h5>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Exit Code: <Badge variant="outline">{selectedResult.response.run.code}</Badge></div>
                            <div>Signal: <Badge variant="outline">{selectedResult.response.run.signal || 'None'}</Badge></div>
                            {selectedResult.duration && (
                              <div>Duration: <Badge variant="outline">{formatDuration(selectedResult.duration)}</Badge></div>
                            )}
                          </div>
                        </div>

                        {selectedResult.response.compile && (
                          <div>
                            <h5 className="text-sm font-medium mb-2">Compilation Details</h5>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>Exit Code: <Badge variant="outline">{selectedResult.response.compile.code}</Badge></div>
                              <div>Signal: <Badge variant="outline">{selectedResult.response.compile.signal || 'None'}</Badge></div>
                            </div>
                          </div>
                        )}

                        <div>
                          <h5 className="text-sm font-medium mb-2">Code Executed</h5>
                          <ScrollArea className="border rounded max-h-48">
                            <pre className="p-3 text-sm font-mono whitespace-pre-wrap bg-muted/50">
                              {selectedResult.code}
                            </pre>
                          </ScrollArea>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}