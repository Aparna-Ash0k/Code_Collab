import { virtualFileSystem } from './virtualFileSystem';

// Project Manager utility class for handling project operations
export class ProjectManager {
  constructor(userId) {
    this.userId = userId;
    this.projects = new Map();
    this.activeProject = null;
    this.listeners = new Set();
  }

  // Add change listener
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove change listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify listeners of changes
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.projects, this.activeProject));
  }

  // Create a new project
  createProject(name, description, template = 'blank') {
    const projectId = this.generateProjectId();
    const project = {
      id: projectId,
      name,
      description,
      type: template,
      created: Date.now(),
      lastModified: Date.now(),
      fileTree: new Map(),
      metadata: {
        dependencies: this.getTemplateDependencies(template),
        version: '1.0.0',
        author: this.userId
      }
    };

    // Initialize project structure based on template
    this.initializeProjectFromTemplate(project, template);
    
    this.projects.set(projectId, project);
    this.notifyListeners();
    
    console.log('📂 Created new project:', name, 'with template:', template);
    return project;
  }

  // Update existing project
  updateProject(projectId, updates) {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const updatedProject = {
      ...project,
      ...updates,
      lastModified: Date.now()
    };

    this.projects.set(projectId, updatedProject);
    this.notifyListeners();
    
    return updatedProject;
  }

  // Delete project
  deleteProject(projectId) {
    const success = this.projects.delete(projectId);
    if (success) {
      if (this.activeProject === projectId) {
        this.activeProject = null;
      }
      this.notifyListeners();
    }
    return success;
  }

  // Set active project (loads its file system into VFS)
  setActiveProject(projectId) {
    const project = this.projects.get(projectId);
    if (!project) return false;

    this.activeProject = projectId;
    
    // Load project's file system into VFS
    this.loadProjectIntoVFS(project);
    
    this.notifyListeners();
    console.log('📂 Switched to project:', project.name);
    return true;
  }

  // Get active project
  getActiveProject() {
    return this.activeProject ? this.projects.get(this.activeProject) : null;
  }

  // Get all projects
  getAllProjects() {
    return Array.from(this.projects.values());
  }

  // Save current VFS state to active project
  saveActiveProjectFromVFS() {
    if (!this.activeProject) return;

    const project = this.projects.get(this.activeProject);
    if (!project) return;

    // Save current VFS state to project
    const vfsData = virtualFileSystem.serialize();
    project.fileTree = new Map(Object.entries(vfsData.files));
    project.folders = new Set(vfsData.folders);
    project.lastModified = Date.now();

    this.projects.set(this.activeProject, project);
    console.log('💾 Saved project from VFS:', project.name);
  }

  // Load project's file system into VFS
  loadProjectIntoVFS(project) {
    if (!project) return;

    // Clear current VFS
    virtualFileSystem.files.clear();
    virtualFileSystem.folders.clear();

    // Load project files
    if (project.fileTree) {
      const filesData = {};
      if (project.fileTree instanceof Map) {
        project.fileTree.forEach((fileData, path) => {
          filesData[path] = fileData;
        });
      } else {
        Object.assign(filesData, project.fileTree);
      }

      virtualFileSystem.loadFromData({
        files: filesData,
        folders: Array.from(project.folders || [])
      });
    }

    console.log('📁 Loaded project into VFS:', project.name, 'Files:', virtualFileSystem.files.size);
  }

  // Initialize project from template
  initializeProjectFromTemplate(project, template) {
    const structure = this.createProjectStructure(template, project);
    
    // Convert structure to project format
    const fileTree = new Map();
    const folders = new Set();

    structure.forEach(({ path, content, type }) => {
      if (type === 'file') {
        fileTree.set(path, {
          content,
          type: 'file',
          lastModified: Date.now(),
          isDirty: false
        });
        
        // Add parent folders
        const parts = path.split('/');
        for (let i = 0; i < parts.length - 1; i++) {
          const folderPath = parts.slice(0, i + 1).join('/');
          folders.add(folderPath);
        }
      } else if (type === 'folder') {
        folders.add(path);
      }
    });

    project.fileTree = fileTree;
    project.folders = folders;
  }

  // Create project structure based on template
  createProjectStructure(template, projectData) {
    const structure = [];
    
    switch (template) {
      case 'javascript':
        structure.push(
          { path: 'index.html', type: 'file', content: this.getHTMLTemplate(projectData.name) },
          { path: 'script.js', type: 'file', content: this.getJavaScriptTemplate() },
          { path: 'style.css', type: 'file', content: this.getCSSTemplate() },
          { path: 'README.md', type: 'file', content: this.getReadmeTemplate(projectData) }
        );
        break;
        
      case 'nodejs':
        structure.push(
          { path: 'package.json', type: 'file', content: this.getPackageJsonTemplate(projectData, 'nodejs') },
          { path: 'index.js', type: 'file', content: this.getNodeJSTemplate(projectData) },
          { path: 'README.md', type: 'file', content: this.getReadmeTemplate(projectData) },
          { path: '.gitignore', type: 'file', content: 'node_modules/\n.env\n*.log\n' }
        );
        break;
        
      case 'react':
        structure.push(
          { path: 'package.json', type: 'file', content: this.getPackageJsonTemplate(projectData, 'react') },
          { path: 'public/index.html', type: 'file', content: this.getReactHTMLTemplate(projectData.name) },
          { path: 'src/App.js', type: 'file', content: this.getReactAppTemplate(projectData) },
          { path: 'src/index.js', type: 'file', content: this.getReactIndexTemplate() },
          { path: 'src/App.css', type: 'file', content: this.getReactCSSTemplate() },
          { path: 'src/index.css', type: 'file', content: this.getBaseCSSTemplate() },
          { path: 'README.md', type: 'file', content: this.getReadmeTemplate(projectData) },
          { path: '.gitignore', type: 'file', content: 'node_modules/\nbuild/\n.env\n*.log\n' }
        );
        break;
        
      case 'python':
        structure.push(
          { path: 'main.py', type: 'file', content: this.getPythonTemplate(projectData) },
          { path: 'requirements.txt', type: 'file', content: '# Add your dependencies here\nrequests>=2.28.0\n' },
          { path: 'README.md', type: 'file', content: this.getReadmeTemplate(projectData) },
          { path: '.gitignore', type: 'file', content: '__pycache__/\n*.pyc\n.env\nvenv/\n' }
        );
        break;
        
      case 'flask':
        structure.push(
          { path: 'app.py', type: 'file', content: this.getFlaskTemplate(projectData) },
          { path: 'requirements.txt', type: 'file', content: 'Flask>=2.3.0\nFlask-CORS>=4.0.0\npython-dotenv>=1.0.0\n' },
          { path: 'templates/index.html', type: 'file', content: this.getFlaskHTMLTemplate(projectData.name) },
          { path: 'static/style.css', type: 'file', content: this.getCSSTemplate() },
          { path: 'README.md', type: 'file', content: this.getReadmeTemplate(projectData) },
          { path: '.gitignore', type: 'file', content: '__pycache__/\n*.pyc\n.env\nvenv/\ninstance/\n' }
        );
        break;
        
      default: // blank
        structure.push(
          { path: 'README.md', type: 'file', content: this.getReadmeTemplate(projectData) }
        );
        break;
    }
    
    return structure;
  }

  // Template content generators
  getHTMLTemplate(projectName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to ${projectName}</h1>
        <p>This is your new JavaScript project!</p>
        <button id="clickMe">Click me!</button>
        <div id="output"></div>
    </div>
    <script src="script.js"></script>
</body>
</html>`;
  }

  getJavaScriptTemplate() {
    return `// Welcome to your new JavaScript project!
console.log('Project initialized successfully!');

// Example: Interactive button
document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('clickMe');
    const output = document.getElementById('output');
    let clickCount = 0;

    if (button && output) {
        button.addEventListener('click', function() {
            clickCount++;
            output.innerHTML = \`<p>Button clicked \${clickCount} time(s)!</p>\`;
            
            // Example: Create animated elements
            if (clickCount % 5 === 0) {
                output.innerHTML += '<p>🎉 Milestone reached!</p>';
            }
        });
    }
});

// Example: Utility functions
function getCurrentTime() {
    return new Date().toLocaleTimeString();
}

function greetUser(name = 'Developer') {
    return \`Hello, \${name}! Welcome to your project. Current time: \${getCurrentTime()}\`;
}

// Example usage
console.log(greetUser());`;
  }

  getCSSTemplate() {
    return `/* Modern CSS for your project */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-align: center;
    max-width: 500px;
    width: 90%;
}

h1 {
    color: #4a5568;
    margin-bottom: 1rem;
    font-size: 2rem;
}

p {
    margin-bottom: 1.5rem;
    color: #666;
}

button {
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    transition: transform 0.2s, box-shadow 0.2s;
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

#output {
    margin-top: 1rem;
    padding: 1rem;
    background: #f7fafc;
    border-radius: 8px;
    min-height: 50px;
}`;
  }

  getPackageJsonTemplate(projectData, type) {
    const templates = {
      nodejs: {
        main: 'index.js',
        scripts: {
          start: 'node index.js',
          dev: 'node --watch index.js'
        },
        dependencies: {
          express: '^4.18.0',
          cors: '^2.8.5'
        }
      },
      react: {
        main: 'src/index.js',
        scripts: {
          start: 'react-scripts start',
          build: 'react-scripts build',
          test: 'react-scripts test',
          eject: 'react-scripts eject'
        },
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
          'react-scripts': '5.0.1'
        }
      }
    };

    const template = templates[type] || templates.nodejs;
    
    return JSON.stringify({
      name: projectData.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: projectData.description,
      ...template,
      keywords: ['codecollab', 'project'],
      author: projectData.metadata?.author || 'CodeCollab User',
      license: 'MIT'
    }, null, 2);
  }

  getNodeJSTemplate(projectData) {
    return `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to ${projectData.name}!',
        description: '${projectData.description}',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime() });
});

app.post('/api/data', (req, res) => {
    const { data } = req.body;
    
    // Process your data here
    console.log('Received data:', data);
    
    res.json({ 
        success: true, 
        received: data,
        processedAt: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(\`🚀 ${projectData.name} server running on port \${PORT}\`);
    console.log(\`📝 Description: ${projectData.description}\`);
});`;
  }

  getReactHTMLTemplate(projectName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="${projectName} - Built with CodeCollab" />
    <title>${projectName}</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>`;
  }

  getReactAppTemplate(projectData) {
    return `import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
    const [count, setCount] = useState(0);
    const [message, setMessage] = useState('');

    useEffect(() => {
        setMessage(\`Welcome to ${projectData.name}!\`);
    }, []);

    const handleIncrement = () => {
        setCount(prev => prev + 1);
    };

    const handleReset = () => {
        setCount(0);
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>{message}</h1>
                <p>${projectData.description}</p>
                
                <div className="counter-section">
                    <h2>Interactive Counter</h2>
                    <div className="counter-display">
                        <span className="count-number">{count}</span>
                    </div>
                    
                    <div className="button-group">
                        <button 
                            className="btn btn-primary" 
                            onClick={handleIncrement}
                        >
                            Increment
                        </button>
                        <button 
                            className="btn btn-secondary" 
                            onClick={handleReset}
                        >
                            Reset
                        </button>
                    </div>
                    
                    {count > 0 && (
                        <p className="counter-message">
                            You've clicked {count} time{count !== 1 ? 's' : ''}!
                            {count >= 10 && ' 🎉 Great job!'}
                        </p>
                    )}
                </div>
                
                <div className="info-section">
                    <p>Edit <code>src/App.js</code> and save to reload.</p>
                    <p>Build amazing things with React!</p>
                </div>
            </header>
        </div>
    );
}

export default App;`;
  }

  getReactIndexTemplate() {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);`;
  }

  getReactCSSTemplate() {
    return `.App {
    text-align: center;
    min-height: 100vh;
}

.App-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 40px 20px;
    color: white;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: calc(10px + 2vmin);
}

.counter-section {
    margin: 2rem 0;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 15px;
    backdrop-filter: blur(10px);
    max-width: 400px;
}

.counter-display {
    margin: 1rem 0;
}

.count-number {
    font-size: 3rem;
    font-weight: bold;
    color: #ffd700;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.button-group {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin: 1rem 0;
}

.btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
}

.btn-primary {
    background: #4CAF50;
    color: white;
}

.btn-primary:hover {
    background: #45a049;
    transform: translateY(-2px);
}

.btn-secondary {
    background: #f44336;
    color: white;
}

.btn-secondary:hover {
    background: #da190b;
    transform: translateY(-2px);
}

.counter-message {
    margin-top: 1rem;
    font-size: 1rem;
    color: #e0e0e0;
}

.info-section {
    margin-top: 2rem;
    font-size: 0.9rem;
    opacity: 0.8;
}

code {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
}`;
  }

  getBaseCSSTemplate() {
    return `body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

code {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
        monospace;
}

* {
    box-sizing: border-box;
}`;
  }

  getPythonTemplate(projectData) {
    return `#!/usr/bin/env python3
"""
${projectData.name}
${projectData.description}

Created with CodeCollab
"""

import requests
import json
from datetime import datetime

def main():
    """Main function to run the application."""
    print(f"🐍 Welcome to ${projectData.name}!")
    print(f"📝 {projectData.description}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Example: Simple interactive menu
    while True:
        print("\\n" + "="*50)
        print("Choose an option:")
        print("1. Display current time")
        print("2. Make a test API request")
        print("3. Calculate factorial")
        print("4. Exit")
        
        choice = input("Enter your choice (1-4): ").strip()
        
        if choice == '1':
            display_current_time()
        elif choice == '2':
            test_api_request()
        elif choice == '3':
            calculate_factorial()
        elif choice == '4':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please try again.")

def display_current_time():
    """Display the current date and time."""
    now = datetime.now()
    print(f"🕒 Current time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📅 Day of week: {now.strftime('%A')}")

def test_api_request():
    """Make a test API request."""
    try:
        print("🌐 Making test API request...")
        response = requests.get("https://httpbin.org/json", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ API request successful!")
            print(f"📄 Response: {json.dumps(data, indent=2)}")
        else:
            print(f"❌ API request failed with status: {response.status_code}")
    except requests.RequestException as e:
        print(f"❌ API request error: {e}")

def calculate_factorial():
    """Calculate factorial of a number."""
    try:
        num = int(input("Enter a number for factorial calculation: "))
        if num < 0:
            print("❌ Factorial is not defined for negative numbers.")
            return
        
        result = 1
        for i in range(1, num + 1):
            result *= i
        
        print(f"✅ Factorial of {num} is: {result}")
    except ValueError:
        print("❌ Please enter a valid integer.")

if __name__ == "__main__":
    main()`;
  }

  getFlaskTemplate(projectData) {
    return `from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

# Configuration
app.config['DEBUG'] = True

@app.route('/')
def home():
    """Home page route."""
    return render_template('index.html', 
                         project_name='${projectData.name}',
                         description='${projectData.description}')

@app.route('/api/status')
def api_status():
    """API status endpoint."""
    return jsonify({
        'status': 'OK',
        'project': '${projectData.name}',
        'description': '${projectData.description}',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/data', methods=['GET', 'POST'])
def api_data():
    """Handle data requests."""
    if request.method == 'GET':
        # Return sample data
        return jsonify({
            'message': 'Welcome to ${projectData.name} API!',
            'sample_data': {
                'users': ['Alice', 'Bob', 'Charlie'],
                'count': 3,
                'generated_at': datetime.now().isoformat()
            }
        })
    
    elif request.method == 'POST':
        # Process posted data
        data = request.get_json()
        
        # Simple echo response with processing
        response = {
            'received': data,
            'processed_at': datetime.now().isoformat(),
            'message': 'Data received and processed successfully'
        }
        
        return jsonify(response)

@app.route('/api/calculate/<operation>')
def calculate(operation):
    """Simple calculator endpoint."""
    try:
        a = float(request.args.get('a', 0))
        b = float(request.args.get('b', 0))
        
        operations = {
            'add': a + b,
            'subtract': a - b,
            'multiply': a * b,
            'divide': a / b if b != 0 else 'Cannot divide by zero'
        }
        
        if operation in operations:
            result = operations[operation]
            return jsonify({
                'operation': operation,
                'operands': {'a': a, 'b': b},
                'result': result,
                'success': True
            })
        else:
            return jsonify({
                'error': 'Unsupported operation',
                'supported': list(operations.keys()),
                'success': False
            }), 400
            
    except ValueError:
        return jsonify({
            'error': 'Invalid number format',
            'success': False
        }), 400
    except ZeroDivisionError:
        return jsonify({
            'error': 'Division by zero',
            'success': False
        }), 400

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'error': 'Endpoint not found',
        'available_endpoints': [
            '/',
            '/api/status',
            '/api/data',
            '/api/calculate/<operation>'
        ]
    }), 404

if __name__ == '__main__':
    print(f"🚀 Starting ${projectData.name}")
    print(f"📝 Description: ${projectData.description}")
    print("🌐 Server will be available at: http://localhost:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=True)`;
  }

  getFlaskHTMLTemplate(projectName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ project_name }}</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
</head>
<body>
    <div class="container">
        <header>
            <h1>🐍 {{ project_name }}</h1>
            <p class="description">{{ description }}</p>
        </header>
        
        <main>
            <section class="api-demo">
                <h2>API Demo</h2>
                <div class="demo-buttons">
                    <button onclick="checkStatus()">Check Status</button>
                    <button onclick="getData()">Get Data</button>
                    <button onclick="postData()">Post Data</button>
                    <button onclick="calculate()">Calculate</button>
                </div>
                
                <div id="result" class="result"></div>
            </section>
            
            <section class="calculator">
                <h2>Simple Calculator</h2>
                <div class="calc-inputs">
                    <input type="number" id="num1" placeholder="Number 1" value="10">
                    <select id="operation">
                        <option value="add">+</option>
                        <option value="subtract">-</option>
                        <option value="multiply">×</option>
                        <option value="divide">÷</option>
                    </select>
                    <input type="number" id="num2" placeholder="Number 2" value="5">
                    <button onclick="performCalculation()">Calculate</button>
                </div>
                <div id="calc-result" class="calc-result"></div>
            </section>
        </main>
    </div>

    <script>
        async function checkStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<h3>Status Check:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<h3>Error:</h3><p>' + error.message + '</p>';
            }
        }

        async function getData() {
            try {
                const response = await fetch('/api/data');
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<h3>GET Data:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<h3>Error:</h3><p>' + error.message + '</p>';
            }
        }

        async function postData() {
            try {
                const testData = {
                    message: 'Hello from frontend!',
                    timestamp: new Date().toISOString(),
                    user: 'Test User'
                };
                
                const response = await fetch('/api/data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(testData)
                });
                
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<h3>POST Data:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<h3>Error:</h3><p>' + error.message + '</p>';
            }
        }

        async function performCalculation() {
            try {
                const num1 = document.getElementById('num1').value;
                const num2 = document.getElementById('num2').value;
                const operation = document.getElementById('operation').value;
                
                const response = await fetch(\`/api/calculate/\${operation}?a=\${num1}&b=\${num2}\`);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('calc-result').innerHTML = 
                        \`<p><strong>Result:</strong> \${num1} \${getOperationSymbol(operation)} \${num2} = \${data.result}</p>\`;
                } else {
                    document.getElementById('calc-result').innerHTML = 
                        \`<p class="error"><strong>Error:</strong> \${data.error}</p>\`;
                }
            } catch (error) {
                document.getElementById('calc-result').innerHTML = 
                    \`<p class="error"><strong>Error:</strong> \${error.message}</p>\`;
            }
        }

        function getOperationSymbol(op) {
            const symbols = { add: '+', subtract: '-', multiply: '×', divide: '÷' };
            return symbols[op] || op;
        }

        // Demo calculation on page load
        document.addEventListener('DOMContentLoaded', function() {
            performCalculation();
        });
    </script>
</body>
</html>`;
  }

  getReadmeTemplate(projectData) {
    return `# ${projectData.name}

${projectData.description}

## 🚀 Getting Started

This project was created with CodeCollab using the ${projectData.type} template.

### Prerequisites

- Modern web browser
- [Node.js](https://nodejs.org/) (for Node.js/React projects)
- [Python](https://python.org/) (for Python/Flask projects)

### Installation

1. **Clone or download this project**
2. **Install dependencies** (if applicable):
   ${this.getInstallInstructions(projectData.type)}

### Running the Project

${this.getRunInstructions(projectData.type)}

## 📁 Project Structure

\`\`\`
${this.getProjectStructure(projectData.type)}
\`\`\`

## 🛠️ Built With

- **Template:** ${projectData.type}
- **Created:** ${new Date().toLocaleDateString()}
- **Platform:** CodeCollab

## 🤝 Collaboration

This project supports real-time collaboration through CodeCollab:

- **Multiple editors** can work simultaneously
- **Live cursor tracking** shows where others are editing
- **Real-time file sync** keeps everyone in sync
- **Role-based permissions** (Owner/Editor/Viewer)

## 📝 Features

${this.getFeaturesList(projectData.type)}

## 🔄 Next Steps

1. Customize the code to fit your needs
2. Add new features and functionality
3. Invite collaborators to work together
4. Deploy your project when ready

---

**Happy coding!** 🎉

> Created with ❤️ using [CodeCollab](https://codecollab.dev)
`;
  }

  getInstallInstructions(type) {
    const instructions = {
      nodejs: '   ```bash\n   npm install\n   ```',
      react: '   ```bash\n   npm install\n   ```',
      python: '   ```bash\n   pip install -r requirements.txt\n   ```',
      flask: '   ```bash\n   pip install -r requirements.txt\n   ```',
      javascript: '   No installation required - open index.html in browser'
    };
    return instructions[type] || 'No installation required';
  }

  getRunInstructions(type) {
    const instructions = {
      nodejs: '```bash\nnpm start\n```\nServer will run on http://localhost:3000',
      react: '```bash\nnpm start\n```\nApp will open at http://localhost:3000',
      python: '```bash\npython main.py\n```',
      flask: '```bash\npython app.py\n```\nServer will run on http://localhost:5000',
      javascript: 'Open `index.html` in your web browser'
    };
    return instructions[type] || 'See template-specific instructions';
  }

  getProjectStructure(type) {
    const structures = {
      nodejs: `├── package.json\n├── index.js\n├── README.md\n└── .gitignore`,
      react: `├── package.json\n├── public/\n│   └── index.html\n├── src/\n│   ├── App.js\n│   ├── App.css\n│   ├── index.js\n│   └── index.css\n├── README.md\n└── .gitignore`,
      python: `├── main.py\n├── requirements.txt\n├── README.md\n└── .gitignore`,
      flask: `├── app.py\n├── requirements.txt\n├── templates/\n│   └── index.html\n├── static/\n│   └── style.css\n├── README.md\n└── .gitignore`,
      javascript: `├── index.html\n├── script.js\n├── style.css\n└── README.md`
    };
    return structures[type] || `├── README.md\n└── (custom structure)`;
  }

  getFeaturesList(type) {
    const features = {
      nodejs: '- Express.js server\n- CORS enabled\n- JSON API endpoints\n- Health check endpoint',
      react: '- Modern React with hooks\n- Interactive components\n- Responsive design\n- Development server',
      python: '- Interactive CLI menu\n- API request examples\n- Mathematical calculations\n- Error handling',
      flask: '- Flask web server\n- API endpoints\n- HTML templates\n- CORS support\n- Calculator demo',
      javascript: '- Interactive button demo\n- DOM manipulation\n- Modern CSS styling\n- Responsive design'
    };
    return features[type] || '- Customizable project structure\n- Ready for development';
  }

  // Get template dependencies
  getTemplateDependencies(template) {
    const deps = {
      nodejs: ['express', 'cors'],
      react: ['react', 'react-dom', 'react-scripts'],
      python: ['requests'],
      flask: ['flask', 'flask-cors', 'python-dotenv'],
      javascript: [],
      blank: []
    };
    return deps[template] || [];
  }

  // Generate unique project ID
  generateProjectId() {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Serialize projects for storage
  serialize() {
    const projectsData = {};
    this.projects.forEach((project, id) => {
      projectsData[id] = {
        ...project,
        fileTree: project.fileTree instanceof Map ? 
          Object.fromEntries(project.fileTree) : project.fileTree,
        folders: project.folders instanceof Set ? 
          Array.from(project.folders) : (project.folders || [])
      };
    });

    return {
      projects: projectsData,
      activeProject: this.activeProject,
      userId: this.userId
    };
  }

  // Load projects from serialized data
  loadFromData(data) {
    this.projects.clear();
    
    if (data.projects) {
      Object.entries(data.projects).forEach(([id, project]) => {
        const loadedProject = {
          ...project,
          fileTree: new Map(Object.entries(project.fileTree || {})),
          folders: new Set(project.folders || [])
        };
        this.projects.set(id, loadedProject);
      });
    }

    this.activeProject = data.activeProject || null;
    this.notifyListeners();
    
    console.log('📂 Loaded projects:', this.projects.size);
  }
}
