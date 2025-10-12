// Piston API service for executing code in multiple programming languages
export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: Array<{
    name?: string;
    content: string;
  }>;
  stdin?: string;
  args?: string[];
  compile_timeout?: number;
  run_timeout?: number;
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
}

export interface PistonLanguage {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
}

export interface PistonError {
  message: string;
}

class PistonApiService {
  private baseUrl = 'https://emkc.org/api/v2/piston';

  /**
   * Get list of available programming languages and their versions
   */
  async getRuntimes(): Promise<PistonLanguage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/runtimes`);
      if (!response.ok) {
        throw new Error(`Failed to fetch runtimes: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching Piston runtimes:', error);
      throw new Error('Unable to fetch available programming languages');
    }
  }

  /**
   * Execute code using the Piston API
   */
  async executeCode(request: PistonExecuteRequest): Promise<PistonExecuteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          compile_timeout: request.compile_timeout || 10000, // 10 seconds
          run_timeout: request.run_timeout || 3000, // 3 seconds
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Validate the response structure
      if (!result.run) {
        throw new Error('Invalid response from Piston API');
      }

      return result;
    } catch (error) {
      console.error('Error executing code:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to execute code');
    }
  }

  /**
   * Convenience method to execute a single file
   */
  async executeFile(
    language: string,
    version: string,
    content: string,
    options?: {
      stdin?: string;
      args?: string[];
      filename?: string;
      compileTimeout?: number;
      runTimeout?: number;
    }
  ): Promise<PistonExecuteResponse> {
    return this.executeCode({
      language,
      version,
      files: [
        {
          name: options?.filename,
          content,
        },
      ],
      stdin: options?.stdin,
      args: options?.args,
      compile_timeout: options?.compileTimeout,
      run_timeout: options?.runTimeout,
    });
  }
}

// Export singleton instance
export const pistonApi = new PistonApiService();