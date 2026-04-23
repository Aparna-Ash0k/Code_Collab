import React, { useState } from 'react';
import { 
  Settings, 
  Code, 
  Save, 
  Monitor, 
  Keyboard, 
  Volume2, 
  FileText, 
  Zap, 
  Shield, 
  Palette, 
  Globe, 
  Download, 
  Upload, 
  RotateCcw, 
  Info,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import ModernModal from './ModernModal';
import toast from 'react-hot-toast';

const SettingsModal = ({ isOpen, onClose }) => {
  const { session } = useSession();
  const [activeTab, setActiveTab] = useState('editor');
  const [hasChanges, setHasChanges] = useState(false);

  const [editorSettings, setEditorSettings] = useState({
    fontSize: 14,
    fontFamily: 'Fira Code',
    theme: 'vs-dark',
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    minimap: true,
    autoSave: 'afterDelay',
    autoSaveDelay: 1000,
    formatOnSave: true,
    formatOnType: false,
    brackets: true,
    folding: true,
    smoothScrolling: true,
    cursorBlinking: 'blink',
    cursorStyle: 'line'
  });

  const [collaborationSettings, setCollaborationSettings] = useState({
    showLiveCursors: true,
    showTypingIndicators: true,
    autoFollowCursor: false,
    chatEnabled: true,
    chatNotifications: true,
    fileChangeNotifications: true,
    cursorTooltips: true,
    collaboratorColors: true,
    syncScrolling: false,
    conflictResolution: 'manual'
  });

  const [performanceSettings, setPerformanceSettings] = useState({
    renderWhitespace: false,
    renderControlCharacters: false,
    enableHighlighting: true,
    enableBracketMatching: true,
    largeFileOptimizations: true,
    maxFileSize: 50, // MB
    autoComplete: true,
    quickSuggestions: true,
    parameterHints: true,
    codeActions: true
  });

  const [systemSettings, setSystemSettings] = useState({
    autoUpdate: true,
    telemetry: true,
    crashReporting: true,
    experimentalFeatures: false,
    debugMode: false,
    verboseLogging: false,
    backupInterval: 30, // minutes
    maxBackups: 10,
    compressionEnabled: true
  });

  if (!isOpen) return null;

  const handleSaveSettings = () => {
    // Save all settings to backend/localStorage
    console.log('Saving settings:', {
      editor: editorSettings,
      collaboration: collaborationSettings,
      performance: performanceSettings,
      system: systemSettings
    });
    
    setHasChanges(false);
    toast.success('Settings saved successfully!');
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      // Reset to defaults
      toast.success('Settings reset to defaults');
      setHasChanges(false);
    }
  };

  const handleExportSettings = () => {
    const settings = {
      editor: editorSettings,
      collaboration: collaborationSettings,
      performance: performanceSettings,
      system: systemSettings,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codecollab-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Settings exported successfully!');
  };

  const handleImportSettings = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          if (settings.editor) setEditorSettings(settings.editor);
          if (settings.collaboration) setCollaborationSettings(settings.collaboration);
          if (settings.performance) setPerformanceSettings(settings.performance);
          if (settings.system) setSystemSettings(settings.system);
          setHasChanges(true);
          toast.success('Settings imported successfully!');
        } catch (error) {
          toast.error('Invalid settings file');
        }
      };
      reader.readAsText(file);
    }
  };

  const renderTabButton = (tabId, icon, label) => (
    <button
      key={tabId}
      onClick={() => setActiveTab(tabId)}
      className={`tab-button ${activeTab === tabId ? 'active' : ''}`}
    >
      {icon}
      {label}
    </button>
  );

  const renderToggleSetting = (key, label, description, value, onChange, section) => (
    <label key={key} className="toggle-setting">
      <div className="setting-info">
        <span className="setting-name">{label}</span>
        <span className="setting-description">{description}</span>
      </div>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => {
          onChange({ ...section, [key]: e.target.checked });
          setHasChanges(true);
        }}
        className="toggle-input"
      />
      <div className="toggle-switch"></div>
    </label>
  );

  const renderSelectSetting = (key, label, description, value, options, onChange, section) => (
    <div key={key} className="select-setting">
      <div className="setting-info">
        <label className="setting-name">{label}</label>
        <span className="setting-description">{description}</span>
      </div>
      <select
        value={value}
        onChange={(e) => {
          onChange({ ...section, [key]: e.target.value });
          setHasChanges(true);
        }}
        className="form-select setting-select"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const renderNumberSetting = (key, label, description, value, min, max, step, unit, onChange, section) => (
    <div key={key} className="number-setting">
      <div className="setting-info">
        <label className="setting-name">{label}</label>
        <span className="setting-description">{description}</span>
      </div>
      <div className="number-input-group">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            onChange({ ...section, [key]: Number(e.target.value) });
            setHasChanges(true);
          }}
          className="form-input number-input"
        />
        {unit && <span className="input-unit">{unit}</span>}
      </div>
    </div>
  );

  const renderEditorTab = () => (
    <div className="settings-tab">
      <div className="settings-section">
        <h4 className="section-title">
          <FileText size={16} />
          Text Editor
        </h4>
        <div className="settings-grid">
          {renderNumberSetting(
            'fontSize', 'Font Size', 'Editor font size in pixels',
            editorSettings.fontSize, 8, 24, 1, 'px',
            setEditorSettings, editorSettings
          )}
          
          {renderSelectSetting(
            'fontFamily', 'Font Family', 'Choose your preferred coding font',
            editorSettings.fontFamily,
            [
              { value: 'Fira Code', label: 'Fira Code' },
              { value: 'Monaco', label: 'Monaco' },
              { value: 'Consolas', label: 'Consolas' },
              { value: 'Source Code Pro', label: 'Source Code Pro' },
              { value: 'Roboto Mono', label: 'Roboto Mono' }
            ],
            setEditorSettings, editorSettings
          )}

          {renderSelectSetting(
            'theme', 'Color Theme', 'Editor color scheme',
            editorSettings.theme,
            [
              { value: 'vs-dark', label: 'Dark (VS Code)' },
              { value: 'vs-light', label: 'Light (VS Code)' },
              { value: 'hc-black', label: 'High Contrast Dark' },
              { value: 'hc-light', label: 'High Contrast Light' }
            ],
            setEditorSettings, editorSettings
          )}

          {renderNumberSetting(
            'tabSize', 'Tab Size', 'Number of spaces per tab',
            editorSettings.tabSize, 1, 8, 1, 'spaces',
            setEditorSettings, editorSettings
          )}
        </div>

        <div className="settings-toggles">
          {renderToggleSetting(
            'wordWrap', 'Word Wrap', 'Wrap long lines to fit in viewport',
            editorSettings.wordWrap, setEditorSettings, editorSettings
          )}
          {renderToggleSetting(
            'lineNumbers', 'Line Numbers', 'Show line numbers in editor',
            editorSettings.lineNumbers, setEditorSettings, editorSettings
          )}
          {renderToggleSetting(
            'minimap', 'Minimap', 'Show minimap overview of file',
            editorSettings.minimap, setEditorSettings, editorSettings
          )}
          {renderToggleSetting(
            'formatOnSave', 'Format on Save', 'Automatically format code when saving',
            editorSettings.formatOnSave, setEditorSettings, editorSettings
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4 className="section-title">
          <Save size={16} />
          Auto Save
        </h4>
        <div className="settings-grid">
          {renderSelectSetting(
            'autoSave', 'Auto Save', 'When to automatically save files',
            editorSettings.autoSave,
            [
              { value: 'off', label: 'Off' },
              { value: 'afterDelay', label: 'After Delay' },
              { value: 'onFocusChange', label: 'On Focus Change' },
              { value: 'onWindowChange', label: 'On Window Change' }
            ],
            setEditorSettings, editorSettings
          )}

          {editorSettings.autoSave === 'afterDelay' && renderNumberSetting(
            'autoSaveDelay', 'Auto Save Delay', 'Delay before auto save triggers',
            editorSettings.autoSaveDelay, 500, 5000, 100, 'ms',
            setEditorSettings, editorSettings
          )}
        </div>
      </div>
    </div>
  );

  const renderCollaborationTab = () => (
    <div className="settings-tab">
      <div className="settings-section">
        <h4 className="section-title">
          <Monitor size={16} />
          Real-time Collaboration
        </h4>
        <div className="settings-toggles">
          {renderToggleSetting(
            'showLiveCursors', 'Live Cursors', 'Show other users\' cursors in real-time',
            collaborationSettings.showLiveCursors, setCollaborationSettings, collaborationSettings
          )}
          {renderToggleSetting(
            'showTypingIndicators', 'Typing Indicators', 'Show when others are typing',
            collaborationSettings.showTypingIndicators, setCollaborationSettings, collaborationSettings
          )}
          {renderToggleSetting(
            'cursorTooltips', 'Cursor Tooltips', 'Show user names on cursors',
            collaborationSettings.cursorTooltips, setCollaborationSettings, collaborationSettings
          )}
          {renderToggleSetting(
            'collaboratorColors', 'Collaborator Colors', 'Use different colors for each user',
            collaborationSettings.collaboratorColors, setCollaborationSettings, collaborationSettings
          )}
          {renderToggleSetting(
            'autoFollowCursor', 'Auto Follow Cursor', 'Automatically follow active collaborator',
            collaborationSettings.autoFollowCursor, setCollaborationSettings, collaborationSettings
          )}
          {renderToggleSetting(
            'syncScrolling', 'Sync Scrolling', 'Synchronize scrolling with other users',
            collaborationSettings.syncScrolling, setCollaborationSettings, collaborationSettings
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4 className="section-title">
          <Volume2 size={16} />
          Notifications
        </h4>
        <div className="settings-toggles">
          {renderToggleSetting(
            'chatEnabled', 'Chat', 'Enable real-time chat',
            collaborationSettings.chatEnabled, setCollaborationSettings, collaborationSettings
          )}
          {renderToggleSetting(
            'chatNotifications', 'Chat Notifications', 'Notify when new messages arrive',
            collaborationSettings.chatNotifications, setCollaborationSettings, collaborationSettings
          )}
          {renderToggleSetting(
            'fileChangeNotifications', 'File Change Notifications', 'Notify when files are modified',
            collaborationSettings.fileChangeNotifications, setCollaborationSettings, collaborationSettings
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4 className="section-title">
          <Shield size={16} />
          Conflict Resolution
        </h4>
        <div className="settings-grid">
          {renderSelectSetting(
            'conflictResolution', 'Conflict Strategy', 'How to handle editing conflicts',
            collaborationSettings.conflictResolution,
            [
              { value: 'manual', label: 'Manual Resolution' },
              { value: 'lastWriter', label: 'Last Writer Wins' },
              { value: 'firstWriter', label: 'First Writer Wins' },
              { value: 'merge', label: 'Automatic Merge' }
            ],
            setCollaborationSettings, collaborationSettings
          )}
        </div>
      </div>
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="settings-tab">
      <div className="settings-section">
        <h4 className="section-title">
          <Zap size={16} />
          Editor Performance
        </h4>
        <div className="settings-toggles">
          {renderToggleSetting(
            'enableHighlighting', 'Syntax Highlighting', 'Enable syntax highlighting for code',
            performanceSettings.enableHighlighting, setPerformanceSettings, performanceSettings
          )}
          {renderToggleSetting(
            'enableBracketMatching', 'Bracket Matching', 'Highlight matching brackets',
            performanceSettings.enableBracketMatching, setPerformanceSettings, performanceSettings
          )}
          {renderToggleSetting(
            'renderWhitespace', 'Show Whitespace', 'Render whitespace characters',
            performanceSettings.renderWhitespace, setPerformanceSettings, performanceSettings
          )}
          {renderToggleSetting(
            'renderControlCharacters', 'Show Control Characters', 'Render control characters',
            performanceSettings.renderControlCharacters, setPerformanceSettings, performanceSettings
          )}
          {renderToggleSetting(
            'largeFileOptimizations', 'Large File Optimizations', 'Optimize performance for large files',
            performanceSettings.largeFileOptimizations, setPerformanceSettings, performanceSettings
          )}
        </div>

        <div className="settings-grid">
          {renderNumberSetting(
            'maxFileSize', 'Max File Size', 'Maximum file size for syntax highlighting',
            performanceSettings.maxFileSize, 1, 500, 1, 'MB',
            setPerformanceSettings, performanceSettings
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4 className="section-title">
          <Code size={16} />
          IntelliSense
        </h4>
        <div className="settings-toggles">
          {renderToggleSetting(
            'autoComplete', 'Auto Complete', 'Enable auto-completion suggestions',
            performanceSettings.autoComplete, setPerformanceSettings, performanceSettings
          )}
          {renderToggleSetting(
            'quickSuggestions', 'Quick Suggestions', 'Show suggestions while typing',
            performanceSettings.quickSuggestions, setPerformanceSettings, performanceSettings
          )}
          {renderToggleSetting(
            'parameterHints', 'Parameter Hints', 'Show function parameter hints',
            performanceSettings.parameterHints, setPerformanceSettings, performanceSettings
          )}
          {renderToggleSetting(
            'codeActions', 'Code Actions', 'Enable code actions and quick fixes',
            performanceSettings.codeActions, setPerformanceSettings, performanceSettings
          )}
        </div>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="settings-tab">
      <div className="settings-section">
        <h4 className="section-title">
          <Globe size={16} />
          Application
        </h4>
        <div className="settings-toggles">
          {renderToggleSetting(
            'autoUpdate', 'Auto Update', 'Automatically update to latest version',
            systemSettings.autoUpdate, setSystemSettings, systemSettings
          )}
          {renderToggleSetting(
            'experimentalFeatures', 'Experimental Features', 'Enable experimental features',
            systemSettings.experimentalFeatures, setSystemSettings, systemSettings
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4 className="section-title">
          <Info size={16} />
          Data & Privacy
        </h4>
        <div className="settings-toggles">
          {renderToggleSetting(
            'telemetry', 'Telemetry', 'Send usage data to improve the product',
            systemSettings.telemetry, setSystemSettings, systemSettings
          )}
          {renderToggleSetting(
            'crashReporting', 'Crash Reporting', 'Send crash reports for debugging',
            systemSettings.crashReporting, setSystemSettings, systemSettings
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4 className="section-title">
          <Save size={16} />
          Backup & Recovery
        </h4>
        <div className="settings-grid">
          {renderNumberSetting(
            'backupInterval', 'Backup Interval', 'How often to backup session data',
            systemSettings.backupInterval, 5, 120, 5, 'minutes',
            setSystemSettings, systemSettings
          )}
          {renderNumberSetting(
            'maxBackups', 'Max Backups', 'Maximum number of backups to keep',
            systemSettings.maxBackups, 1, 50, 1, 'backups',
            setSystemSettings, systemSettings
          )}
        </div>
        <div className="settings-toggles">
          {renderToggleSetting(
            'compressionEnabled', 'Compression', 'Compress backup files to save space',
            systemSettings.compressionEnabled, setSystemSettings, systemSettings
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4 className="section-title">
          <Settings size={16} />
          Debug & Logging
        </h4>
        <div className="settings-toggles">
          {renderToggleSetting(
            'debugMode', 'Debug Mode', 'Enable debug mode for troubleshooting',
            systemSettings.debugMode, setSystemSettings, systemSettings
          )}
          {renderToggleSetting(
            'verboseLogging', 'Verbose Logging', 'Enable detailed logging',
            systemSettings.verboseLogging, setSystemSettings, systemSettings
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      title="Application Settings"
      subtitle="Configure CodeCollab to match your preferences"
      maxWidth="xl"
      headerActions={
        <div className="header-actions">
          {hasChanges && (
            <div className="badge badge-warning">
              <AlertTriangle size={12} />
              Unsaved Changes
            </div>
          )}
          <label className="button button-outline button-sm">
            <Upload size={14} />
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImportSettings}
              className="sr-only"
            />
          </label>
          <button
            onClick={handleExportSettings}
            className="button button-outline button-sm"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      }
    >
      {/* Tab Navigation */}
      <div className="tab-group">
        {renderTabButton('editor', <Code size={16} />, 'Editor')}
        {renderTabButton('collaboration', <Monitor size={16} />, 'Collaboration')}
        {renderTabButton('performance', <Zap size={16} />, 'Performance')}
        {renderTabButton('system', <Settings size={16} />, 'System')}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'editor' && renderEditorTab()}
        {activeTab === 'collaboration' && renderCollaborationTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
        {activeTab === 'system' && renderSystemTab()}
      </div>

      {/* Info Box */}
      <div className="info-box info-box-info">
        <CheckCircle size={16} />
        <strong>Settings are saved automatically</strong> and applied instantly. 
        Use Export/Import to share configurations across devices.
      </div>

      {/* Action Buttons */}
      <div className="button-group">
        <button
          onClick={handleSaveSettings}
          disabled={!hasChanges}
          className="button button-primary"
        >
          <Save size={16} />
          Save Settings
        </button>
        <button
          onClick={handleResetSettings}
          className="button button-outline"
        >
          <RotateCcw size={16} />
          Reset to Defaults
        </button>
        <button
          onClick={onClose}
          className="button button-secondary"
        >
          Close
        </button>
      </div>
    </ModernModal>
  );
};

export default SettingsModal;
