import { useState } from 'react';
import { Toaster } from './components/ui/sonner';
import { AuthWrapper, useAuth } from './components/AuthWrapper';
import { ProjectProvider } from './hooks/useProject';
import { ThemeProvider } from './contexts/ThemeContext';
import { LandingPage } from './components/LandingPage';
import { ProjectSelector } from './components/ProjectSelector';
import { FileExplorer } from './components/FileExplorer';
import { CodeEditor } from './components/CodeEditor';
import { ChatPanel } from './components/ChatPanel';
import { UserPanel } from './components/UserPanel';
import { Toolbar } from './components/Toolbar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable';
import { Project, useProject } from './hooks/useProject';
import { usePresence } from './hooks/usePresence';

function CodeEditorApp({ project, onBackToLanding }: { project: Project; onBackToLanding?: () => void }) {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  // Use currentProject from context if available, otherwise fall back to prop
  // This ensures the UI updates when roles change
  const activeProject = currentProject || project;
  const { activeUsers, updatePresence } = usePresence(activeProject.id);

  console.log('CodeEditorApp: Rendering with project', activeProject.id, 'userRole:', activeProject.userRole);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    updatePresence(filePath);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Toolbar 
        project={activeProject}
        selectedFile={selectedFile}
        activeUsers={activeUsers}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
        onBackToLanding={onBackToLanding}
      />
      
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <div className="h-full flex flex-col border-r">
            <FileExplorer 
              project={activeProject}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
            />
            <UserPanel 
              users={activeUsers} 
              project={activeProject}
              projectId={activeProject.id}
              projectName={activeProject.name}
              isOwner={activeProject.owner_id === user?.id}
            />
          </div>
        </ResizablePanel>
        
        <ResizableHandle />
        
        <ResizablePanel defaultSize={isChatOpen ? 60 : 80}>
          <CodeEditor 
            project={activeProject}
            selectedFile={selectedFile}
            activeUsers={activeUsers}
            onPresenceUpdate={updatePresence}
          />
        </ResizablePanel>
        
        {isChatOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
              <ChatPanel project={activeProject} activeUsers={activeUsers} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

export default function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const isDevMode = import.meta.env?.VITE_DEV_MODE === 'true';

  console.log('App: selectedProject', selectedProject?.id);

  const handleGetStarted = () => {
    setShowLanding(false);
  };

  const handleBackToLanding = () => {
    setSelectedProject(null);
  };

  return (
    <ThemeProvider>
      {showLanding ? (
        <LandingPage onGetStarted={handleGetStarted} />
      ) : (
        <AuthWrapper>
          <ProjectProvider>
            <div className="h-screen">
              {isDevMode && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 text-sm font-medium text-center dark:bg-yellow-900 dark:border-yellow-600 dark:text-yellow-200">
                  🚧 DEVELOPMENT MODE - Authentication is simulated
                </div>
              )}
              {selectedProject ? (
                <CodeEditorApp project={selectedProject} onBackToLanding={handleBackToLanding} />
              ) : (
                <ProjectSelector onProjectSelect={setSelectedProject} onBackToLanding={handleBackToLanding} />
              )}
              <Toaster />
            </div>
          </ProjectProvider>
        </AuthWrapper>
      )}
    </ThemeProvider>
  );
}