import { PistonLanguage } from '../services/pistonApi';

export interface LanguageConfig {
  id: string;
  name: string;
  pistonLanguage: string;
  version: string;
  fileExtensions: string[];
  defaultCode: string;
  monacoLanguage?: string;
  icon?: string;
  color?: string;
}

// Popular programming languages configuration
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    id: 'javascript',
    name: 'JavaScript',
    pistonLanguage: 'javascript',
    version: '18.15.0',
    fileExtensions: ['.js', '.mjs'],
    monacoLanguage: 'javascript',
    icon: '🟨',
    color: '#f7df1e',
    defaultCode: `// JavaScript Example
console.log("Hello, World!");

function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,
  },
  {
    id: 'python',
    name: 'Python',
    pistonLanguage: 'python',
    version: '3.10.0',
    fileExtensions: ['.py'],
    monacoLanguage: 'python',
    icon: '🐍',
    color: '#3776ab',
    defaultCode: `# Python Example
print("Hello, World!")

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print("Fibonacci sequence:")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`,
  },
  {
    id: 'java',
    name: 'Java',
    pistonLanguage: 'java',
    version: '15.0.2',
    fileExtensions: ['.java'],
    monacoLanguage: 'java',
    icon: '☕',
    color: '#ed8b00',
    defaultCode: `// Java Example
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        System.out.println("Fibonacci sequence:");
        for (int i = 0; i < 10; i++) {
            System.out.println("F(" + i + ") = " + fibonacci(i));
        }
    }
    
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}`,
  },
  {
    id: 'cpp',
    name: 'C++',
    pistonLanguage: 'cpp',
    version: '10.2.0',
    fileExtensions: ['.cpp', '.cc', '.cxx'],
    monacoLanguage: 'cpp',
    icon: '⚡',
    color: '#00599c',
    defaultCode: `// C++ Example
#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "Hello, World!" << endl;
    
    cout << "Fibonacci sequence:" << endl;
    for (int i = 0; i < 10; i++) {
        cout << "F(" << i << ") = " << fibonacci(i) << endl;
    }
    
    return 0;
}`,
  },
  {
    id: 'c',
    name: 'C',
    pistonLanguage: 'c',
    version: '10.2.0',
    fileExtensions: ['.c'],
    monacoLanguage: 'c',
    icon: '🔧',
    color: '#a8b9cc',
    defaultCode: `// C Example
#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    printf("Hello, World!\\n");
    
    printf("Fibonacci sequence:\\n");
    for (int i = 0; i < 10; i++) {
        printf("F(%d) = %d\\n", i, fibonacci(i));
    }
    
    return 0;
}`,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    pistonLanguage: 'typescript',
    version: '4.9.4',
    fileExtensions: ['.ts'],
    monacoLanguage: 'typescript',
    icon: '🔷',
    color: '#3178c6',
    defaultCode: `// TypeScript Example
console.log("Hello, World!");

function fibonacci(n: number): number {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,
  },
  {
    id: 'rust',
    name: 'Rust',
    pistonLanguage: 'rust',
    version: '1.68.2',
    fileExtensions: ['.rs'],
    monacoLanguage: 'rust',
    icon: '🦀',
    color: '#ce422b',
    defaultCode: `// Rust Example
fn main() {
    println!("Hello, World!");
    
    println!("Fibonacci sequence:");
    for i in 0..10 {
        println!("F({}) = {}", i, fibonacci(i));
    }
}

fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}`,
  },
  {
    id: 'go',
    name: 'Go',
    pistonLanguage: 'go',
    version: '1.19.9',
    fileExtensions: ['.go'],
    monacoLanguage: 'go',
    icon: '🐹',
    color: '#00add8',
    defaultCode: `// Go Example
package main

import "fmt"

func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}

func main() {
    fmt.Println("Hello, World!")
    
    fmt.Println("Fibonacci sequence:")
    for i := 0; i < 10; i++ {
        fmt.Printf("F(%d) = %d\\n", i, fibonacci(i))
    }
}`,
  },
  {
    id: 'php',
    name: 'PHP',
    pistonLanguage: 'php',
    version: '8.2.3',
    fileExtensions: ['.php'],
    monacoLanguage: 'php',
    icon: '🐘',
    color: '#777bb4',
    defaultCode: `<?php
// PHP Example
echo "Hello, World!\\n";

function fibonacci($n) {
    if ($n <= 1) return $n;
    return fibonacci($n - 1) + fibonacci($n - 2);
}

echo "Fibonacci sequence:\\n";
for ($i = 0; $i < 10; $i++) {
    echo "F($i) = " . fibonacci($i) . "\\n";
}
?>`,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    pistonLanguage: 'ruby',
    version: '3.0.1',
    fileExtensions: ['.rb'],
    monacoLanguage: 'ruby',
    icon: '💎',
    color: '#cc342d',
    defaultCode: `# Ruby Example
puts "Hello, World!"

def fibonacci(n)
  return n if n <= 1
  fibonacci(n - 1) + fibonacci(n - 2)
end

puts "Fibonacci sequence:"
(0..9).each do |i|
  puts "F(#{i}) = #{fibonacci(i)}"
end`,
  },
];

/**
 * Get language configuration by file extension
 */
export function getLanguageFromExtension(filename: string): LanguageConfig | null {
  const extension = filename.substring(filename.lastIndexOf('.'));
  return SUPPORTED_LANGUAGES.find(lang => 
    lang.fileExtensions.includes(extension)
  ) || null;
}

/**
 * Get language configuration by language ID
 */
export function getLanguageById(id: string): LanguageConfig | null {
  return SUPPORTED_LANGUAGES.find(lang => lang.id === id) || null;
}

/**
 * Update language configurations with actual Piston runtime versions
 */
export function updateLanguageVersions(runtimes: PistonLanguage[]): LanguageConfig[] {
  return SUPPORTED_LANGUAGES.map(lang => {
    const runtime = runtimes.find(r => 
      r.language === lang.pistonLanguage || 
      r.aliases?.includes(lang.pistonLanguage)
    );
    
    if (runtime) {
      return {
        ...lang,
        version: runtime.version,
      };
    }
    
    return lang;
  });
}

/**
 * Get default language (JavaScript)
 */
export function getDefaultLanguage(): LanguageConfig {
  return SUPPORTED_LANGUAGES[0]; // JavaScript
}