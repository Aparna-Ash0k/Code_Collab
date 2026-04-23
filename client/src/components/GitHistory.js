import React, { useState } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  Clock, 
  User, 
  RotateCcw, 
  Eye,
  Download,
  GitMerge,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

const CommitItem = ({ commit, onRevert, onView, isExpanded, onToggle }) => (
  <div className="border-b border-vscode-border last:border-b-0">
    <div 
      className="p-3 hover:bg-vscode-hover cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center mt-1">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <GitCommit size={14} className="ml-1 text-vscode-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-vscode-text font-medium mb-1">
            {commit.message}
          </div>
          <div className="flex items-center gap-3 text-xs text-vscode-text-muted">
            <span className="flex items-center gap-1">
              <User size={10} />
              {commit.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {commit.timestamp}
            </span>
            <span className="font-mono text-vscode-accent">
              {commit.hash}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(commit);
            }}
            className="p-1 hover:bg-vscode-bg rounded text-vscode-text-secondary hover:text-vscode-text"
            title="View Changes"
          >
            <Eye size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRevert(commit);
            }}
            className="p-1 hover:bg-vscode-bg rounded text-vscode-text-secondary hover:text-vscode-text"
            title="Revert to this version"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
    
    {isExpanded && (
      <div className="px-6 pb-3">
        <div className="space-y-2">
          <div className="text-xs text-vscode-text-muted">
            <strong>Changes:</strong>
          </div>
          <div className="space-y-1">
            {commit.changes.map((change, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className={`w-1 h-1 rounded-full ${
                  change.type === 'added' ? 'bg-vscode-success' :
                  change.type === 'modified' ? 'bg-vscode-warning' :
                  'bg-vscode-error'
                }`}></span>
                <span className="text-vscode-text">{change.file}</span>
                <span className="text-vscode-text-muted">
                  {change.type === 'added' ? '+' : change.type === 'modified' ? '~' : '-'}{change.lines} lines
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);

const GitHistory = () => {
  const [commits, setCommits] = useState([
    {
      id: 1,
      hash: "a1b2c3d",
      message: "Add real-time chat functionality",
      author: "John Doe",
      timestamp: "2 hours ago",
      changes: [
        { file: "Chat.js", type: "added", lines: 145 },
        { file: "App.js", type: "modified", lines: 12 },
        { file: "index.css", type: "modified", lines: 23 }
      ]
    },
    {
      id: 2,
      hash: "e4f5g6h",
      message: "Implement live cursor tracking",
      author: "Jane Smith",
      timestamp: "4 hours ago", 
      changes: [
        { file: "LiveCursors.js", type: "added", lines: 89 },
        { file: "ActivityBar.js", type: "modified", lines: 5 }
      ]
    },
    {
      id: 3,
      hash: "i7j8k9l",
      message: "Enhanced file explorer with context menus",
      author: "You",
      timestamp: "1 day ago",
      changes: [
        { file: "Explorer.js", type: "modified", lines: 67 },
        { file: "FileSystemContext.js", type: "modified", lines: 34 }
      ]
    },
    {
      id: 4,
      hash: "m1n2o3p",
      message: "Initial project setup and basic editor",
      author: "You",
      timestamp: "3 days ago",
      changes: [
        { file: "App.js", type: "added", lines: 234 },
        { file: "SimpleEditor.js", type: "added", lines: 78 },
        { file: "TabBar.js", type: "added", lines: 45 }
      ]
    }
  ]);

  const [expandedCommits, setExpandedCommits] = useState(new Set([1]));
  const [selectedBranch, setSelectedBranch] = useState('main');

  const branches = ['main', 'feature/chat', 'feature/cursors', 'develop'];

  const handleToggleCommit = (commitId) => {
    setExpandedCommits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commitId)) {
        newSet.delete(commitId);
      } else {
        newSet.add(commitId);
      }
      return newSet;
    });
  };

  const handleRevert = (commit) => {
    if (window.confirm(`Are you sure you want to revert to "${commit.message}"? This will undo all changes made after this commit.`)) {
      console.log('Reverting to commit:', commit.hash);
      // Implement revert logic
    }
  };

  const handleViewChanges = (commit) => {
    console.log('Viewing changes for commit:', commit.hash);
    // Implement diff view
  };

  const handleCreateBranch = () => {
    const branchName = prompt('Enter branch name:');
    if (branchName && branchName.trim()) {
      console.log('Creating branch:', branchName);
      // Implement branch creation
    }
  };

  const handleExportHistory = () => {
    const historyData = JSON.stringify(commits, null, 2);
    const blob = new Blob([historyData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codecollab-history.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-vscode-panel h-full overflow-y-auto text-sm">
      {/* Header */}
      <div className="p-3 border-b border-vscode-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-vscode-text uppercase tracking-wide">
            Version History
          </h3>
          <div className="flex gap-1">
            <button
              onClick={handleCreateBranch}
              className="p-1 hover:bg-vscode-hover rounded text-vscode-text-secondary hover:text-vscode-text"
              title="Create Branch"
            >
              <GitBranch size={12} />
            </button>
            <button
              onClick={handleExportHistory}
              className="p-1 hover:bg-vscode-hover rounded text-vscode-text-secondary hover:text-vscode-text"
              title="Export History"
            >
              <Download size={12} />
            </button>
          </div>
        </div>

        {/* Branch Selector */}
        <div className="mb-3">
          <div className="text-xs text-vscode-text-muted mb-1">Current Branch:</div>
          <select 
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-2 py-1 bg-vscode-bg border border-vscode-border rounded text-vscode-text text-xs focus:outline-none focus:border-vscode-accent"
          >
            {branches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-vscode-bg rounded">
            <div className="text-vscode-accent font-medium">{commits.length}</div>
            <div className="text-vscode-text-muted">Commits</div>
          </div>
          <div className="text-center p-2 bg-vscode-bg rounded">
            <div className="text-vscode-success font-medium">3</div>
            <div className="text-vscode-text-muted">Contributors</div>
          </div>
        </div>
      </div>

      {/* Auto-save Status */}
      <div className="p-3 border-b border-vscode-border">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 bg-vscode-success rounded-full animate-pulse"></div>
          <span className="text-vscode-text">Auto-save enabled</span>
          <span className="text-vscode-text-muted">• Last saved 2 mins ago</span>
        </div>
      </div>

      {/* Commit Timeline */}
      <div className="divide-y divide-vscode-border">
        {commits.map((commit) => (
          <CommitItem
            key={commit.id}
            commit={commit}
            onRevert={handleRevert}
            onView={handleViewChanges}
            isExpanded={expandedCommits.has(commit.id)}
            onToggle={() => handleToggleCommit(commit.id)}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-t border-vscode-border">
        <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-2">
          Quick Actions
        </div>
        <div className="space-y-1">
          <button className="w-full text-left px-2 py-1 text-xs text-vscode-text hover:bg-vscode-hover rounded flex items-center gap-2">
            <GitMerge size={12} />
            Create Pull Request
          </button>
          <button className="w-full text-left px-2 py-1 text-xs text-vscode-text hover:bg-vscode-hover rounded flex items-center gap-2">
            <GitBranch size={12} />
            Switch Branch
          </button>
          <button className="w-full text-left px-2 py-1 text-xs text-vscode-text hover:bg-vscode-hover rounded flex items-center gap-2">
            <Download size={12} />
            Clone Repository
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitHistory;
