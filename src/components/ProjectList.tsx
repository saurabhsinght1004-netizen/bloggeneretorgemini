import React from 'react';
import { Project } from '../types/pipeline';
import {
  Layers,
  Sparkles,
  Trash2,
  Copy,
  Settings2,
  Plus,
  PlayCircle,
  BarChart2,
} from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onOpenStudio: (id: string) => void;
  onNewProject: () => void;
  onDuplicateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onEditSettings: (project: Project) => void;
  onOpenUsage?: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onSelectProject,
  onOpenStudio,
  onNewProject,
  onDuplicateProject,
  onDeleteProject,
  onEditSettings,
  onOpenUsage,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-10 border border-slate-800 shadow-xl">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-Step Process Pipeline Engine</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            Craft high-impact blogs through structured AI prompt pipelines.
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Create custom projects, define sequential steps (Angle &rarr; Outline &rarr; Deep Draft &rarr; SEO &rarr; Final Polish), chat interactively at any stage, and deliver ready-to-publish articles.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onNewProject}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Project</span>
            </button>

            {onOpenUsage && (
              <button
                onClick={onOpenUsage}
                className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-2"
                title="View API Token Usage & Analytics"
              >
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <span>API Usage</span>
              </button>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-400 pl-2">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                Customizable Prompt Steps
              </span>
              <span className="flex items-center gap-1.5">
                <PlayCircle className="w-4 h-4 text-emerald-400" />
                Interactive Chat Execution
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Your Blog Generation Projects</span>
            <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {projects.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select a project to configure its process steps or launch the generation studio.
          </p>
        </div>

        <button
          onClick={onNewProject}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid or Empty State */}
      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-12 text-center flex flex-col items-center justify-center space-y-5 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Layers className="w-8 h-8" />
          </div>

          <div className="max-w-md space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              No Projects Yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              You haven't created any blog generation pipelines yet. Click below to create your first custom project with customizable prompt steps.
            </p>
          </div>

          <button
            onClick={onNewProject}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600/60 transition-all overflow-hidden"
            >
              {/* Top decorative stripe */}
              <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600" />

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  {/* Header & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center space-x-1 shrink-0 text-slate-400">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSettings(project);
                        }}
                        title="Project Settings"
                        className="p-1.5 rounded-lg hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateProject(project);
                        }}
                        title="Duplicate Project"
                        className="p-1.5 rounded-lg hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        title="Delete Project"
                        className="p-1.5 rounded-lg hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {project.steps.length} sequential prompt steps to generate your blog.
                  </p>
                </div>

                {/* Steps overview & Primary CTA */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{project.steps.length} Pipeline Steps</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {project.steps.filter((s) => s.isEnabled).length} active
                    </span>
                  </div>

                  {/* Step mini pill trail */}
                  <div className="flex flex-wrap gap-1">
                    {project.steps.slice(0, 4).map((step, idx) => (
                      <span
                        key={step.id}
                        className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium truncate max-w-[130px]"
                      >
                        {idx + 1}. {step.title}
                      </span>
                    ))}
                    {project.steps.length > 4 && (
                      <span className="text-[10px] text-slate-400 py-0.5 px-1 font-mono">
                        +{project.steps.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => onSelectProject(project.id)}
                      className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Edit Steps</span>
                    </button>

                    <button
                      onClick={() => onOpenStudio(project.id)}
                      className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm flex items-center justify-center gap-1.5 group-hover:shadow"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Start Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
