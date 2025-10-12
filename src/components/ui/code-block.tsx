import { useState } from 'react';
import { Button } from './button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { copyWithFallback } from '../../utils/clipboardUtils';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      const success = await copyWithFallback(code, true);
      if (success) {
        setCopied(true);
        toast.success('Code copied to clipboard!');
        
        // Reset the copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('Failed to copy code to clipboard');
      }
    } catch (error) {
      console.error('Copy code error:', error);
      toast.error('Failed to copy code to clipboard');
    }
  };

  return (
    <div className={`relative group !text-left ${className}`} style={{ textAlign: 'left' }}>
      {/* Language label and copy button */}
      <div className="flex items-center justify-between bg-muted px-3 py-2 text-xs border-b">
        <span className="text-muted-foreground">
          {language || 'Code'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      
      {/* Code content */}
      <pre className="bg-black/10 dark:bg-white/5 p-3 overflow-x-auto text-sm !text-left" style={{ textAlign: 'left' }}>
        <code className="!text-left" style={{ textAlign: 'left' }}>{code}</code>
      </pre>
    </div>
  );
}