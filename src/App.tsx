import React, { useState, useEffect, useRef } from 'react';
import { Project, RunSession, ProjectUsageRecord } from './types/pipeline';
import { createDefaultProjects } from './utils/pipeline';
import { Header } from './components/Header';
import { ProjectList } from './components/ProjectList';
import { PipelineBuilder } from './components/PipelineBuilder';
import { ExecutionStudio } from './components/ExecutionStudio';
import { FinalBlogView } from './components/FinalBlogView';
import { NewProjectModal } from './components/NewProjectModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { UsageDashboard } from './components/UsageDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { TenantSwitcherModal } from './components/TenantSwitcherModal';
import {
  loadUserProjects,
  saveAllUserProjects,
  deleteUserProject,
  loadUserSessions,
  saveUserSession,
  loadUserPreferences,
  saveUserPreferences,
  saveUserUsageRecord,
  filterUserOnlyProjects,
} from './services/dbPersistence';
import { Loader2, Sparkles, Database } from 'lucide-react';

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

function MainAppContent() {
  const { user, currentTenant, loading } = useAuth();
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const tenantId = currentTenant?.id || (user ? `tenant-${user.uid}` : 'workspace-guest');

  // Persistence and sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error' | 'guest'>('synced');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Projects & Sessions state - Only user-created projects are loaded and shown
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('blogcraft_user_projects');
      if (saved) {
        return filterUserOnlyProjects(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'studio' | 'output' | 'settings' | 'usage'>('pipeline');
  const [sessions, setSessions] = useState<Record<string, RunSession>>({});

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingSettingsProject, setEditingSettingsProject] = useState<Project | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Reference to track initial load completion for the current user
  const loadedUserIdRef = useRef<string | null>(null);

  // 1. AUTOMATIC LOAD for User ID on sign-in or tenant change
  useEffect(() => {
    let isMounted = true;

    const autoLoadUserData = async () => {
      if (!user) {
        setSyncStatus('guest');
        setIsInitialLoading(false);
        loadedUserIdRef.current = null;
        return;
      }

      setIsInitialLoading(true);
      setSyncStatus('saving');

      try {
        // Automatically load projects for this user ID (only user-created, no default template projects)
        const loadedProjects = await loadUserProjects(user.uid, tenantId);
        if (isMounted) {
          setProjects(loadedProjects);
        }

        // Automatically load generation sessions for this user ID
        const loadedSessions = await loadUserSessions(user.uid, tenantId);
        if (isMounted) {
          setSessions(loadedSessions || {});
        }

        // Automatically load user preferences
        await loadUserPreferences(user.uid);
        if (isMounted) {
          // As requested by user: opening the software always opens to the Home page (Projects Dashboard)
          setActiveProjectId(null);
          setActiveTab('pipeline');

          setSyncStatus('synced');
          setLastSavedTime(new Date());
          loadedUserIdRef.current = user.uid;
        }
      } catch (err) {
        console.error('Automatic database load failed:', err);
        if (isMounted) {
          setSyncStatus('error');
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    autoLoadUserData();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, tenantId]);

  // 2. AUTOMATIC SAVE of Projects for User ID (Debounced)
  useEffect(() => {
    // Only auto-save if authenticated and initial load has completed for this user
    if (!user || isInitialLoading || loadedUserIdRef.current !== user.uid) return;

    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveAllUserProjects(user.uid, tenantId, projects);
        setSyncStatus('synced');
        setLastSavedTime(new Date());
      } catch (err) {
        console.error('Automatic project save error:', err);
        setSyncStatus('error');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [projects, user?.uid, tenantId, isInitialLoading]);

  // 3. AUTOMATIC SAVE of Sessions for User ID (Debounced)
  useEffect(() => {
    if (!user || isInitialLoading || loadedUserIdRef.current !== user.uid || Object.keys(sessions).length === 0) {
      return;
    }

    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await Promise.all(
          Object.values(sessions).map((sess) => saveUserSession(user.uid, tenantId, sess))
        );
        setSyncStatus('synced');
        setLastSavedTime(new Date());
      } catch (err) {
        console.error('Automatic session save error:', err);
        setSyncStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessions, user?.uid, tenantId, isInitialLoading]);

  // 4. AUTOMATIC SAVE of User Preferences (active project)
  useEffect(() => {
    if (!user || isInitialLoading || loadedUserIdRef.current !== user.uid) return;
    saveUserPreferences(user.uid, { activeProjectId, activeTab });
  }, [activeProjectId, activeTab, user?.uid, isInitialLoading]);

  // 5. AUTOMATIC SAVE of API Usage Records dispatched from generation runs
  useEffect(() => {
    if (!user) return;

    const handleUsageRecordEvent = async (e: Event) => {
      const record = (e as CustomEvent).detail as ProjectUsageRecord;
      if (!record) return;

      try {
        await saveUserUsageRecord(user.uid, tenantId, record);
        setSyncStatus('synced');
        setLastSavedTime(new Date());
      } catch (err) {
        console.warn('Failed to auto-save usage record to database:', err);
      }
    };

    window.addEventListener('blogcraft-usage-record', handleUsageRecordEvent);
    return () => {
      window.removeEventListener('blogcraft-usage-record', handleUsageRecordEvent);
    };
  }, [user?.uid, tenantId]);

  // Backend health check
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(Boolean(data.hasApiKey));
      })
      .catch((err) => {
        console.warn('Backend health check note:', err);
      });
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const getOrCreateSession = (projId: string): RunSession => {
    if (sessions[projId]) return sessions[projId];

    const newSession: RunSession = {
      id: `session-${Date.now()}`,
      projectId: projId,
      userInput: '',
      status: 'idle',
      currentStepIndex: 0,
      stepOutputs: {},
      chatMessages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSessions((prev) => ({ ...prev, [projId]: newSession }));
    return newSession;
  };

  const handleUpdateSession = (updatedSession: RunSession) => {
    setSessions((prev) => ({
      ...prev,
      [updatedSession.projectId]: updatedSession,
    }));
  };

  const handleUpdateProject = (updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleCreateProject = (newProj: Project) => {
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setActiveTab('pipeline');
  };

  const handleDuplicateProject = (proj: Project) => {
    const copy: Project = {
      ...proj,
      id: `proj-${Date.now()}`,
      name: `${proj.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: proj.steps.map((s, idx) => ({ ...s, id: `step-${Date.now()}-${idx}` })),
    };
    setProjects((prev) => [copy, ...prev]);
  };

  const handleDeleteProject = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }

    if (user) {
      setSyncStatus('saving');
      try {
        await deleteUserProject(user.uid, tenantId, id);
        setSyncStatus('synced');
        setLastSavedTime(new Date());
      } catch (err) {
        console.error('Error deleting project from database:', err);
        setSyncStatus('error');
      }
    }
  };

  const handleOpenStudio = (projId: string) => {
    setActiveProjectId(projId);
    setActiveTab('studio');
  };

  const handleSelectProject = (projId: string | null) => {
    setActiveProjectId(projId);
    if (projId) {
      setActiveTab('pipeline');
    }
  };

  const handleTriggerManualSync = async () => {
    if (!user) return;
    setSyncStatus('saving');
    try {
      await saveAllUserProjects(user.uid, tenantId, projects);
      await Promise.all(
        Object.values(sessions).map((sess) => saveUserSession(user.uid, tenantId, sess))
      );
      setSyncStatus('synced');
      setLastSavedTime(new Date());
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
    }
  };

  // Auth loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span>Connecting to Multi-Tenant Workspace...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated and has not clicked "continue as guest", show Login & Registration screen
  if (!user && !isGuestMode) {
    return <AuthScreen onContinueAsGuest={() => setIsGuestMode(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navigation */}
      <Header
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onNewProject={() => setIsNewProjectModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasApiKey={hasApiKey}
        onOpenTenantModal={() => setIsTenantModalOpen(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        syncStatus={syncStatus}
        lastSavedTime={lastSavedTime}
        onTriggerSync={handleTriggerManualSync}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'usage' ? (
          <UsageDashboard
            projects={projects}
            sessions={sessions}
            activeProjectId={activeProjectId}
            onSelectProject={(id) => {
              setActiveProjectId(id);
            }}
            onBack={() => {
              if (activeProjectId) {
                setActiveTab('pipeline');
              } else {
                setActiveProjectId(null);
                setActiveTab('pipeline');
              }
            }}
          />
        ) : !activeProject ? (
          /* Projects Dashboard */
          <ProjectList
            projects={projects}
            onSelectProject={(id) => {
              setActiveProjectId(id);
              setActiveTab('pipeline');
            }}
            onOpenStudio={handleOpenStudio}
            onNewProject={() => setIsNewProjectModalOpen(true)}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onEditSettings={(p) => setEditingSettingsProject(p)}
            onOpenUsage={() => setActiveTab('usage')}
          />
        ) : (
          /* Active Project Workspace */
          <div>
            {activeTab === 'pipeline' && (
              <PipelineBuilder
                project={activeProject}
                onUpdateProject={handleUpdateProject}
                onLaunchStudio={() => setActiveTab('studio')}
                onBackToProjects={() => setActiveProjectId(null)}
              />
            )}

            {activeTab === 'studio' && (
              <ExecutionStudio
                project={activeProject}
                currentSession={getOrCreateSession(activeProject.id)}
                onUpdateSession={handleUpdateSession}
                onViewFinalBlog={() => setActiveTab('output')}
              />
            )}

            {activeTab === 'output' && (
              <FinalBlogView
                project={activeProject}
                session={getOrCreateSession(activeProject.id)}
                onBackToStudio={() => setActiveTab('studio')}
                onUpdateSessionBlog={(newBlog) => {
                  const currSession = getOrCreateSession(activeProject.id);
                  handleUpdateSession({
                    ...currSession,
                    finalBlog: newBlog,
                    updatedAt: new Date().toISOString(),
                  });
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        project={editingSettingsProject}
        isOpen={Boolean(editingSettingsProject)}
        onClose={() => setEditingSettingsProject(null)}
        onSave={handleUpdateProject}
      />

      {/* Multi-Tenant Workspace Switcher Modal */}
      <TenantSwitcherModal
        isOpen={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
      />

      {/* Modal overlay if guest wants to sign in */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <AuthScreen onContinueAsGuest={() => setShowAuthModal(false)} />
        </div>
      )}
    </div>
  );
}
