import React from 'react';
import { Sun, Moon, Type, Monitor } from 'lucide-react';

const ThemeSelector = ({ theme, setTheme, fontSize, setFontSize }) => {
  const themes = [
    { id: 'dark', name: 'Dark', icon: Moon },
    { id: 'light', name: 'Light', icon: Sun },
    { id: 'auto', name: 'Auto', icon: Monitor }
  ];

  const fontSizes = [12, 14, 16, 18, 20];

  return (
    <div className="bg-vscode-panel border-b border-vscode-border p-4">
      <h3 className="text-sm font-semibold text-vscode-text mb-4 border-b border-vscode-border pb-2">
        Theme & Settings
      </h3>
      
      <div className="mb-6">
        <label className="block text-xs text-vscode-text-muted mb-3 uppercase tracking-wide">
          Color Theme
        </label>
        <div className="space-y-2">
          {themes.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-3 px-3 py-2 rounded w-full text-left text-sm transition-all ${
                theme === id 
                  ? 'bg-vscode-accent text-white' 
                  : 'bg-vscode-bg text-vscode-text hover:bg-vscode-hover'
              }`}
              onClick={() => setTheme(id)}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-vscode-text-muted mb-3 uppercase tracking-wide">
          Font Size
        </label>
        <div className="flex items-center gap-3">
          <Type size={16} className="text-vscode-text-secondary" />
          <select 
            value={fontSize} 
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="bg-vscode-bg border border-vscode-border text-vscode-text text-sm px-3 py-2 rounded focus:outline-none focus:border-vscode-accent flex-1"
          >
            {fontSizes.map(size => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ThemeSelector;
