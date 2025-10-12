import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Send, Paperclip, Code, Bot, Sparkles, X, FileText, Download } from 'lucide-react';
import { Project } from '../hooks/useProject';
import { useChat } from '../hooks/useChat';
import { useAuth } from './AuthWrapper';
import { AIModal } from './AIModal';
import { aiService } from '../services/aiService';
import { CodeBlock } from './ui/code-block';
import { toast } from 'sonner';

interface ChatPanelProps {
  project: Project;
}

export function ChatPanel({ project }: ChatPanelProps) {
  const { user } = useAuth();
  const { messages, sendMessage } = useChat(project.id);
  const [newMessage, setNewMessage] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [showCodeBlockDialog, setShowCodeBlockDialog] = useState(false);
  const [codeBlockContent, setCodeBlockContent] = useState('');
  const [codeBlockLanguage, setCodeBlockLanguage] = useState('javascript');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() || attachedFile) {
      try {
        // Handle file attachment
        if (attachedFile) {
          setIsUploading(true);
          toast.info('Processing file...');
          
          try {
            // Convert file to base64
            const downloadURL = await uploadFileToStorage(attachedFile);
            
            // Check base64 size before sending
            const base64Size = new Blob([downloadURL]).size;
            const maxSize = 900 * 1024; // 900KB (leave room for other message data)
            
            if (base64Size > maxSize) {
              throw new Error(`File too large after encoding (${(base64Size / 1024).toFixed(0)}KB). Please use a smaller file (< 500KB).`);
            }
            
            // Send as a special file message
            const formattedMessage = `📎 **${attachedFile.name}** (${(attachedFile.size / 1024).toFixed(1)} KB)\n🔗 [Download File](${downloadURL})`;
            await sendMessage(formattedMessage, 'file');
            
            handleRemoveAttachment();
            toast.success('File shared successfully!');
          } catch (uploadError) {
            console.error('File processing failed:', uploadError);
            
            // Show user-friendly error message
            const errorMessage = uploadError instanceof Error 
              ? uploadError.message 
              : 'Failed to process file. Please try a smaller file (< 500KB).';
            
            toast.error(errorMessage);
            setIsUploading(false);
            return; // Don't send message if processing fails
          }
        }

        // Handle text message
        if (newMessage.trim()) {
          // Check if this is an AI query
          const aiQuery = aiService.parseAIQuery(newMessage);
          
          if (aiQuery) {
            setIsAIProcessing(true);
            
            // Send the user's query first
            await sendMessage(newMessage, 'text');
            
            try {
              // Get AI response
              const aiResponse = await aiService.queryAI(aiQuery.modelId, aiQuery.query);
              
              // Send AI response as a separate message
              await sendMessage(
                `🤖 **${aiResponse.model}**: ${aiResponse.content}`,
                'text'
              );
            } catch (aiError) {
              console.error('AI query failed:', aiError);
              await sendMessage(
                `🤖 **AI Error**: Failed to get response from ${aiQuery.modelId}. ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
                'text'
              );
            } finally {
              setIsAIProcessing(false);
            }
          } else {
            // Regular message
            await sendMessage(newMessage, 'text');
          }
        }
        
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
        setIsAIProcessing(false);
        setIsUploading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // File attachment handlers
  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Base64 encoding adds ~33% overhead, and Firestore has 1MB document limit
      // Safe limit: 500KB file → ~665KB base64 → stays under 1MB with message metadata
      const MAX_SIZE = 500 * 1024; // 500KB
      
      if (file.size > MAX_SIZE) {
        toast.error('File size must be less than 500KB (Firestore limit)');
        return;
      }
      setAttachedFile(file);
      toast.success(`File attached: ${file.name}`);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload file to base64 data URL
  const uploadFileToStorage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        setIsUploading(false);
        setUploadProgress(100);
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        setIsUploading(false);
        setUploadProgress(0);
        reject(reader.error);
      };
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(progress));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Code block handlers
  const handleCodeBlockInsert = () => {
    setShowCodeBlockDialog(true);
  };

  const handleCodeBlockSend = async () => {
    if (codeBlockContent.trim()) {
      const formattedCode = `\`\`\`${codeBlockLanguage}\n${codeBlockContent}\n\`\`\``;
      await sendMessage(formattedCode, 'code');
      setCodeBlockContent('');
      setCodeBlockLanguage('javascript');
      setShowCodeBlockDialog(false);
      toast.success('Code block sent');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getRandomColor = (userId: string) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Parse AI response content to extract code blocks and regular text
  const parseAIResponse = (content: string) => {
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    
    // Extract AI model prefix if present
    const modelMatch = content.match(/🤖 \*\*(.*?)\*\*:\s*/);
    const modelPrefix = modelMatch ? `🤖 **${modelMatch[1]}**: ` : '';
    const cleanContent = content.replace(/🤖 \*\*(.*?)\*\*:\s*/, '');
    
    // Split by code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let isFirstPart = true;
    
    while ((match = codeBlockRegex.exec(cleanContent)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        let textContent = cleanContent.slice(lastIndex, match.index).trim();
        if (textContent) {
          // Add model prefix to the first text part
          if (isFirstPart && modelPrefix) {
            textContent = modelPrefix + textContent;
            isFirstPart = false;
          }
          parts.push({ type: 'text', content: textContent });
        }
      }
      
      // Add code block
      const language = match[1] || undefined;
      const code = match[2].trim();
      parts.push({ type: 'code', content: code, language });
      
      lastIndex = match.index + match[0].length;
      isFirstPart = false;
    }
    
    // Add remaining text after last code block
    if (lastIndex < cleanContent.length) {
      let textContent = cleanContent.slice(lastIndex).trim();
      if (textContent) {
        // Add model prefix if this is the only text part
        if (isFirstPart && modelPrefix) {
          textContent = modelPrefix + textContent;
        }
        parts.push({ type: 'text', content: textContent });
      }
    }
    
    // If no code blocks found, return the entire content as text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: content });
    }
    
    return parts;
  };

  // Format text content with basic markdown-like formatting
  const formatTextContent = (content: string) => {
    return content
      .replace(/🤖 \*\*(.*?)\*\*:/, '<strong>🤖 $1:</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-black/10 px-1 rounded">$1</code>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="h-full flex flex-col border-l">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Team Chat</h3>
          <div className="flex items-center gap-2">
            <AIModal />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-3">
            {messages.map((message) => {
            const isCurrentUser = message.user_id === user?.id;
            const userColor = getRandomColor(message.user_id);
            const userInitials = message.user_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const isAIResponse = message.content.startsWith('🤖');
            const isAIQuery = aiService.parseAIQuery(message.content) !== null;
            
            // AI responses should always be left-aligned for better readability
            const shouldRightAlign = isCurrentUser && !isAIResponse;
            
            return (
              <div key={message.id} className={`flex gap-3 ${shouldRightAlign ? 'flex-row-reverse' : ''}`}>
                <Avatar className="w-6 h-6">
                  <AvatarFallback 
                    className="text-xs"
                    style={{ 
                      backgroundColor: isAIResponse ? '#10b981' : userColor, 
                      color: 'white' 
                    }}
                  >
                    {isAIResponse ? '🤖' : userInitials}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex-1 ${shouldRightAlign ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-2 mb-1 ${shouldRightAlign ? 'justify-end' : ''}`}>
                    <span className="text-xs font-medium">
                      {isAIResponse ? 'AI Assistant' : message.user_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
                    {isAIQuery && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI Query
                      </Badge>
                    )}
                  </div>
                  
                  <div className={`inline-block max-w-lg rounded-lg p-2 ${
                    isAIResponse
                      ? 'bg-green-100 dark:bg-green-900 border-l-4 border-green-500'
                      : shouldRightAlign 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                  }`}>
                    {message.type === 'code' ? (
                      <div className="!text-left" style={{ textAlign: 'left' }}>
                        <CodeBlock 
                          code={message.content.replace(/```[\w]*\n?/, '').replace(/```$/, '').trim()} 
                          language={message.content.match(/```(\w+)/)?.[1]}
                          className="rounded border"
                        />
                      </div>
                    ) : message.type === 'file' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <div className="flex-1">
                            {/* Extract filename and size from message */}
                            <div className="text-sm font-medium">
                              {message.content.match(/\*\*(.*?)\*\*/)?.[1] || 'File'}
                            </div>
                            <div className="text-xs opacity-75">
                              {message.content.match(/\((.*?)\)/)?.[1] || ''}
                            </div>
                          </div>
                        </div>
                        {/* Extract download URL and create download button */}
                        {(() => {
                          const urlMatch = message.content.match(/\[Download File\]\((.*?)\)/);
                          const downloadUrl = urlMatch?.[1];
                          const filename = message.content.match(/\*\*(.*?)\*\*/)?.[1] || 'file';
                          return downloadUrl ? (
                            <a
                              href={downloadUrl}
                              download={filename}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              Download File
                            </a>
                          ) : null;
                        })()}
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {isAIResponse ? (
                          <div className="space-y-3">
                            {parseAIResponse(message.content).map((part, index) => (
                              <div key={index}>
                                {part.type === 'code' ? (
                                  <div className="!text-left" style={{ textAlign: 'left' }}>
                                    <CodeBlock 
                                      code={part.content} 
                                      language={part.language}
                                      className="rounded border"
                                    />
                                  </div>
                                ) : (
                                  <div 
                                    dangerouslySetInnerHTML={{
                                      __html: formatTextContent(part.content)
                                    }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        </ScrollArea>
      </div>

      <div className="p-3 border-t">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.zip,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.h,.css,.html,.json,.xml,.md"
        />

        {/* File size limit reminder */}
        {!attachedFile && (
          <div className="mb-2 px-2 py-1 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span>
              📎 File limit: <strong>500 KB max</strong> • Tip: Compress images before uploading
            </span>
          </div>
        )}

        {/* File attachment preview */}
        {attachedFile && (
          <div className="mb-2 p-2 bg-muted rounded flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <FileText className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs truncate">{attachedFile.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    ({(attachedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                {isUploading && (
                  <div className="mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Uploading... {uploadProgress}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleRemoveAttachment}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}

        {/* Code block dialog */}
        {showCodeBlockDialog && (
          <div className="mb-2 p-3 bg-muted rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Insert Code Block</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowCodeBlockDialog(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <select
              value={codeBlockLanguage}
              onChange={(e) => setCodeBlockLanguage(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded bg-background text-foreground"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
              <option value="csharp">C#</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="sql">SQL</option>
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
              <option value="bash">Bash</option>
            </select>
            <textarea
              value={codeBlockContent}
              onChange={(e) => setCodeBlockContent(e.target.value)}
              placeholder="Paste your code here..."
              className="w-full px-2 py-1 text-sm border rounded font-mono h-32 resize-none bg-background text-foreground"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCodeBlockDialog(false);
                  setCodeBlockContent('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCodeBlockSend}
                disabled={!codeBlockContent.trim()}
              >
                <Send className="w-3 h-3 mr-1" />
                Send Code
              </Button>
            </div>
          </div>
        )}

        {/* AI Query Helper */}
        {newMessage.startsWith('?') && (
          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs">
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
              <Bot className="w-3 h-3" />
              AI Query Mode
            </div>
            <p className="text-blue-600 dark:text-blue-400">
              Format: <code>?model query</code> • Available: gpt-mini, gpt-4, gpt-4o
            </p>
            {aiService.parseAIQuery(newMessage) && (
              <p className="text-green-600 dark:text-green-400 mt-1">
                ✓ Valid AI query detected
              </p>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message... (use ?model query for AI)"
              className="pr-20"
              disabled={isAIProcessing}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              {/* File attachment button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleFileAttach}
                title="Attach file"
              >
                <Paperclip className="w-3 h-3" />
              </Button>

              {/* Code block button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleCodeBlockInsert}
                title="Insert code block"
              >
                <Code className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <Button 
            onClick={handleSendMessage} 
            size="sm"
            disabled={isAIProcessing || isUploading}
          >
            {isAIProcessing ? (
              <Sparkles className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}