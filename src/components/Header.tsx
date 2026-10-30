import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Plus,
  BookOpen,
  Bot,
  BarChart2,
  Building2,
  LogOut,
  ChevronDown,
  Database,
  Cloud,
  Check,
  Loader2,
  RefreshCw,
  User as UserIcon,
  Home,
} from 'lucide-react';
import { Project } from '../types/pipeline';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onNewProject: () => void;
  activeTab: 'pipeline' | 'studio' | 'output' | 'settings' | 'usage';
  setActiveTab: (tab: 'pipeline' | 'studio' | 'output' | 'settings' | 'usage') => void;
  hasApiKey: boolean;
  onOpenTenantModal: () => void;
  onOpenAuth?: () => void;
  syncStatus?: 'synced' | 'saving' | 'error' | 'guest';
  lastSavedTime?: Date | null;
  onTriggerSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  activeTab,
  setActiveTab,
  hasApiKey: _hasApiKey,
  onOpenTenantModal,
  onOpenAuth,
  syncStatus = 'synced',
  lastSavedTime,
  onTriggerSync,
}) => {
  const { user, currentTenant, logout } = useAuth();
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const currentProject = projects.find((p) => p.id === activeProjectId);

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectProject(null)}
              className="flex items-center space-x-2.5 text-left group focus:outline-none"
              title="Return to Projects Dashboard"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  BlogCraft <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/60">Pipelines</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block -mt-0.5">
                  Multi-Stage Prompt Chaining Studio
                </p>
              </div>
            </button>

            {/* Breadcrumb Separator & Project Switcher */}
            {currentProject && (
              <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-medium">/</span>
                <select
                  aria-label="Active Project"
                  value={currentProject.id}
                  onChange={(e) => onSelectProject(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Center Tabs: Home is always accessible; Project-specific steps visible when inside a project */}
          <nav className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs font-medium">
            <button
              onClick={() => onSelectProject(null)}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeProjectId === null && activeTab !== 'usage'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Return to Home / Projects Dashboard"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            {currentProject && (
              <>
                <button
                  onClick={() => setActiveTab('pipeline')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'pipeline'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Process Steps ({currentProject.steps.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('studio')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'studio'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Chat & Studio</span>
                </button>

                <button
                  onClick={() => setActiveTab('output')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'output'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Final Blog</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('usage')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'usage'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>API Usage</span>
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-2">
            {/* Database Auto-Save & Sync Status Badge */}
            <div className="relative">
              <button
                onClick={() => setShowSyncDetails(!showSyncDetails)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                  user
                    ? syncStatus === 'saving'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                      : syncStatus === 'error'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
                title="Click to view database persistence details"
              >
                {user ? (
                  <>
                    {syncStatus === 'saving' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                    ) : syncStatus === 'error' ? (
                      <Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                    <span className="hidden sm:inline">
                      {syncStatus === 'saving'
                        ? 'Saving to DB...'
                        : syncStatus === 'error'
                        ? 'Local Cache'
                        : 'DB Auto-Saved'}
                    </span>
                    <span className="sm:hidden text-[10px]">
                      {syncStatus === 'saving' ? 'Saving' : 'DB'}
                    </span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="hidden sm:inline">Guest Preview</span>
                  </>
                )}
              </button>

              {/* Sync Details Dropdown */}
              {showSyncDetails && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-indigo-500" />
                      Database Persistence
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        user
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {user ? 'Auto-Sync Active' : 'Local Only'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
                    {user ? (
                      <>
                        <div className="flex justify-between">
                          <span>User ID:</span>
                          <span
                            className="font-mono text-slate-900 dark:text-slate-200 truncate max-w-[140px]"
                            title={user.uid}
                          >
                            {user.uid}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Email:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[140px]">
                            {user.email || 'Manual ID'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Workspace:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[140px]">
                            {currentTenant?.name || 'Default'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Auto-Save:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-200">
                            {lastSavedTime ? lastSavedTime.toLocaleTimeString() : 'Just now'}
                          </span>
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              onTriggerSync?.();
                              setShowSyncDetails(false);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Sync All to Database Now
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-500">
                          You are using Guest Preview. Data is cached locally in this browser.
                        </p>
                        <button
                          onClick={() => {
                            setShowSyncDetails(false);
                            onOpenAuth?.();
                          }}
                          className="w-full mt-2 py-1.5 px-3 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors"
                        >
                          Sign In / Create ID to Persist in DB
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Workspace / Tenant Switcher */}
            <button
              onClick={onOpenTenantModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-indigo-400 transition-all max-w-[150px] sm:max-w-[200px]"
              title="Switch Workspace / Multi-Tenant Organization"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">{currentTenant?.name || 'Workspace'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Global API Usage Button (Always accessible) */}
            <button
              onClick={() => setActiveTab('usage')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all shadow-xs ${
                activeTab === 'usage'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
              title="Open API Usage Dashboard"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">API Usage</span>
            </button>

            {/* Create Project Button */}
            <button
              onClick={onNewProject}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm shadow-indigo-600/30 flex items-center gap-1.5 transition-all hover:shadow active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Project</span>
            </button>

            {/* User Profile / Logout */}
            {user ? (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div
                  className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-teal-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs uppercase"
                  title={`${user.displayName || user.email}`}
                >
                  {(user.displayName || user.email || 'U')[0]}
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              onOpenAuth && (
                <button
                  onClick={onOpenAuth}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2"
                >
                  Sign In
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
