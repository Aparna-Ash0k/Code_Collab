/**
 * Utility functions for clipboard operations with fallbacks for non-secure contexts
 */

/**
 * Copies text to clipboard with fallback for non-HTTPS contexts
 * @param text - The text to copy
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  console.log('🔄 Attempting to copy text:', text.substring(0, 50) + '...');
  console.log('📋 Secure context:', window.isSecureContext);
  console.log('📋 Clipboard API available:', !!(navigator.clipboard));
  
  try {
    // Try the modern clipboard API first (requires HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      console.log('📋 Using modern clipboard API...');
      await navigator.clipboard.writeText(text);
      console.log('✅ Modern clipboard API successful');
      return true;
    }
    
    // Fallback for non-secure contexts (HTTP on network IPs)
    console.log('📋 Using fallback clipboard method...');
    return fallbackCopyToClipboard(text);
  } catch (error) {
    console.error('❌ Clipboard operation failed:', error);
    // Try fallback method
    console.log('📋 Trying fallback method after error...');
    return fallbackCopyToClipboard(text);
  }
}

/**
 * Fallback clipboard method using document.execCommand (deprecated but widely supported)
 * @param text - The text to copy
 * @returns boolean - true if successful, false otherwise
 */
function fallbackCopyToClipboard(text: string): boolean {
  console.log('📋 Attempting fallback clipboard copy...');
  
  // Try multiple methods in sequence
  return (
    tryTextareaMethod(text) ||
    tryInputMethod(text) ||
    tryRangeMethod(text) ||
    false
  );
}

/**
 * Method 1: Textarea approach with better focus handling
 */
function tryTextareaMethod(text: string): boolean {
  try {
    console.log('📋 Trying textarea method...');
    
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the element actually visible and properly styled for copying
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.style.width = '1px';
    textArea.style.height = '1px';
    textArea.style.opacity = '1'; // Keep visible for some browsers
    textArea.style.pointerEvents = 'none';
    textArea.tabIndex = -1;
    textArea.setAttribute('readonly', '');
    
    document.body.appendChild(textArea);
    
    // Force focus and selection
    textArea.focus({ preventScroll: true });
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    
    // Double-check selection worked
    const selectionStart = textArea.selectionStart ?? 0;
    const selectionEnd = textArea.selectionEnd ?? 0;
    const selectionLength = selectionEnd - selectionStart;
    if (selectionLength !== text.length) {
      console.warn('⚠️ Textarea selection failed');
      document.body.removeChild(textArea);
      return false;
    }
    
    // Attempt copy immediately while in user gesture
    const successful = document.execCommand('copy');
    console.log('📋 execCommand result:', successful);
    
    // Cleanup
    document.body.removeChild(textArea);
    
    if (successful) {
      console.log('✅ Textarea method successful');
      return true;
    } else {
      console.warn('⚠️ Textarea method: execCommand returned false');
      return false;
    }
  } catch (error) {
    console.error('❌ Textarea method error:', error);
    return false;
  }
}

/**
 * Method 2: Input element approach
 */
function tryInputMethod(text: string): boolean {
  try {
    console.log('📋 Trying input method...');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = text;
    input.setAttribute('readonly', '');
    
    // Position off-screen but keep accessible
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '1';
    input.style.pointerEvents = 'none';
    input.tabIndex = -1;
    
    document.body.appendChild(input);
    
    // Focus and select
    input.focus({ preventScroll: true });
    input.select();
    input.setSelectionRange(0, text.length);
    
    // Verify selection
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;
    const selectionLength = selectionEnd - selectionStart;
    if (selectionLength !== text.length) {
      console.warn('⚠️ Input selection failed');
      document.body.removeChild(input);
      return false;
    }
    
    const successful = document.execCommand('copy');
    document.body.removeChild(input);
    
    if (successful) {
      console.log('✅ Input method successful');
      return true;
    } else {
      console.warn('⚠️ Input method: execCommand returned false');
      return false;
    }
  } catch (error) {
    console.error('❌ Input method error:', error);
    return false;
  }
}

/**
 * Method 3: Range/Selection approach
 */
function tryRangeMethod(text: string): boolean {
  try {
    console.log('📋 Trying range/selection method...');
    
    // Create a contenteditable div for better compatibility
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.textContent = text;
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.style.width = '1px';
    div.style.height = '1px';
    div.style.opacity = '0';
    div.style.pointerEvents = 'none';
    div.style.whiteSpace = 'pre';
    
    document.body.appendChild(div);
    
    // Focus the div and select all content
    div.focus();
    
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(div);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    const successful = document.execCommand('copy');
    
    // Cleanup
    selection?.removeAllRanges();
    document.body.removeChild(div);
    
    if (successful) {
      console.log('✅ Range method successful');
      return true;
    } else {
      console.warn('⚠️ Range method: execCommand returned false');
      return false;
    }
  } catch (error) {
    console.error('❌ Range method error:', error);
    return false;
  }
}

/**
 * Method 4: Aggressive clipboard approach using multiple techniques
 */
function tryAggressiveMethod(text: string): boolean {
  try {
    console.log('📋 Trying aggressive method...');
    
    // Create multiple elements and try different approaches
    const approaches = [
      () => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '0';
        textarea.style.top = '0';
        textarea.style.width = '1em';
        textarea.style.height = '1em';
        textarea.style.opacity = '0.01'; // Barely visible but not completely hidden
        textarea.style.zIndex = '1000';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textarea);
        return result;
      },
      () => {
        // Try creating and selecting text in an input
        const input = document.createElement('input');
        input.value = text;
        input.style.position = 'fixed';
        input.style.left = '0';
        input.style.top = '0';
        input.style.opacity = '0.01';
        input.style.zIndex = '1000';
        document.body.appendChild(input);
        input.focus();
        input.setSelectionRange(0, text.length);
        const result = document.execCommand('copy');
        document.body.removeChild(input);
        return result;
      }
    ];
    
    for (const approach of approaches) {
      try {
        if (approach()) {
          console.log('✅ Aggressive method successful');
          return true;
        }
      } catch (error) {
        console.warn('⚠️ Aggressive approach failed:', error);
      }
    }
    
    console.warn('⚠️ All aggressive approaches failed');
    return false;
  } catch (error) {
    console.error('❌ Aggressive method error:', error);
    return false;
  }
}

/**
 * Last resort: Show user a dialog with the text to copy manually
 */
function showCopyDialog(text: string): boolean {
  try {
    console.log('📋 Showing manual copy dialog...');
    
    // Create a modal-like dialog
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    dialog.style.maxWidth = '90%';
    dialog.style.maxHeight = '80%';
    dialog.style.overflow = 'auto';
    
    dialog.innerHTML = `
      <h3 style="margin-top: 0; color: #333;">Copy Link</h3>
      <p style="color: #666; margin-bottom: 15px;">Please manually copy the link below:</p>
      <textarea readonly style="width: 100%; min-height: 100px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 14px; resize: vertical;" 
                onclick="this.select()" 
                onfocus="this.select()">${text}</textarea>
      <div style="margin-top: 15px; text-align: right;">
        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Done
        </button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Focus the textarea and select the text
    const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement;
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 100);
    
    // Remove overlay when clicking outside the dialog
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
    console.log('📋 Manual copy dialog shown');
    return true; // We showed the dialog, user can copy manually
  } catch (error) {
    console.error('❌ Could not show manual copy dialog:', error);
    return false;
  }
}

/**
 * Alternative method: Prompts user to manually copy if all else fails
 * @param text - The text to copy
 */
export function promptUserToCopy(text: string): void {
  console.log('📋 Showing manual copy prompt to user...');
  
  // Create a more user-friendly prompt
  const message = `Automatic copying failed. Please copy this link manually:

${text}

Instructions:
1. Select all the text above
2. Press Ctrl+C (or Cmd+C on Mac) to copy
3. The link is now ready to paste!`;
  
  // Use a confirm dialog instead of prompt for better UX
  if (window.confirm(`${message}

Click OK to see the link in a text box for easy copying, or Cancel to dismiss.`)) {
    // Show the text in a prompt for easy selection
    window.prompt('Copy this link (it should be pre-selected):', text);
  }
}

/**
 * Comprehensive copy function with user feedback
 * @param text - The text to copy
 * @param fallbackToPrompt - Whether to show a prompt if copy fails
 * @returns Promise<boolean> - true if copied successfully
 */
export async function copyWithFallback(text: string, fallbackToPrompt: boolean = true): Promise<boolean> {
  console.log('🚀 Starting copyWithFallback...');
  
  // Method 1: Try modern Clipboard API first (most reliable)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      console.log('📋 Trying Clipboard API...');
      await navigator.clipboard.writeText(text);
      console.log('✅ Clipboard API successful');
      
      // Verify the copy worked
      try {
        const clipboardContent = await navigator.clipboard.readText();
        if (clipboardContent === text) {
          console.log('✅ Verified: Clipboard content matches');
          return true;
        } else {
          console.warn('⚠️ Clipboard verification failed: content mismatch');
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify clipboard content:', verifyError);
        return true; // Assume it worked since writeText succeeded
      }
      
      return true;
    } catch (error) {
      console.warn('⚠️ Clipboard API failed:', error);
    }
  } else {
    console.warn('⚠️ Clipboard API not available (non-secure context)');
  }
  
  // Method 2: Try synchronous fallback methods (must be called from user gesture)
  console.log('📋 Trying synchronous fallback methods...');
  const fallbackSuccess = trySynchronousCopy(text);
  
  if (fallbackSuccess) {
    console.log('✅ Synchronous fallback copy successful');
    
    // Try to verify if possible (but don't await in non-secure context)
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        const clipboardContent = await navigator.clipboard.readText();
        if (clipboardContent === text) {
          console.log('✅ Verified: Synchronous copy actually worked');
          return true;
        } else {
          console.warn('⚠️ Synchronous copy verification failed: content mismatch');
          console.warn('Expected:', text.substring(0, 50));
          console.warn('Got:', clipboardContent.substring(0, 50));
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify synchronous copy:', verifyError);
        return true; // Can't verify but method said it worked
      }
    } else {
      console.log('✅ Synchronous copy completed (verification unavailable)');
      return true;
    }
  }
  
  console.log('❌ All automatic copy methods failed');
  
  if (fallbackToPrompt) {
    console.log('📋 Showing manual copy dialog...');
    return showCopyDialog(text);
  }
  
  console.log('❌ Copy failed and no fallback prompt requested');
  return false;
}

/**
 * Synchronous copy methods that must be called directly from user event
 */
function trySynchronousCopy(text: string): boolean {
  console.log('📋 Attempting synchronous copy methods...');
  
  // Try the most reliable methods first
  return (
    tryDirectExecCommand(text) ||
    tryTextareaMethod(text) ||
    tryInputMethod(text) ||
    tryRangeMethod(text) ||
    tryAggressiveMethod(text) ||
    false
  );
}

/**
 * Method 0: Direct execCommand approach (sometimes works better)
 */
function tryDirectExecCommand(text: string): boolean {
  try {
    console.log('📋 Trying direct execCommand...');
    
    // Create a simple span with the text
    const span = document.createElement('span');
    span.textContent = text;
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.whiteSpace = 'nowrap';
    
    document.body.appendChild(span);
    
    // Select the text
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(span);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    // Try copy immediately
    const successful = document.execCommand('copy');
    
    // Cleanup
    selection?.removeAllRanges();
    document.body.removeChild(span);
    
    if (successful) {
      console.log('✅ Direct execCommand successful');
      return true;
    } else {
      console.warn('⚠️ Direct execCommand returned false');
      return false;
    }
  } catch (error) {
    console.error('❌ Direct execCommand error:', error);
    return false;
  }
}

/**
 * Checks if clipboard API is available
 * @returns boolean
 */
export function isClipboardAPIAvailable(): boolean {
  return !!(navigator.clipboard && window.isSecureContext);
}

/**
 * Gets the clipboard method that will be used
 * @returns string - description of the method
 */
export function getClipboardMethod(): string {
  if (navigator.clipboard && window.isSecureContext) {
    return 'Modern Clipboard API (secure context)';
  } else {
    return 'Fallback execCommand (non-secure context)';
  }
}