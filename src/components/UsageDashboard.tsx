import React, { useState, useMemo, useEffect } from 'react';
import { Project, RunSession, ProjectUsageRecord } from '../types/pipeline';
import { getProjectUsageHistory } from '../utils/pipeline';
import { loadUserUsageRecords } from '../services/dbPersistence';
import {
  TrendingUp,
  Calendar,
  Layers,
  Coins,
  Zap,
  ArrowLeft,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart2,
  FileSpreadsheet,
  Building2,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UsageDashboardProps {
  projects: Project[];
  sessions: Record<string, RunSession>;
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onBack: () => void;
}

// Distinct, accessible palette for project lines
const PROJECT_COLORS: Record<string, { stroke: string; bg: string; fill: string; border: string }> = {
  'proj-prostate-clinic-london': {
    stroke: '#0d9488', // teal-600
    bg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300',
    fill: 'rgba(13, 148, 136, 0.12)',
    border: 'border-teal-500',
  },
  'proj-seo-guide': {
    stroke: '#6366f1', // indigo-500
    bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
    fill: 'rgba(99, 102, 241, 0.12)',
    border: 'border-indigo-500',
  },
  'proj-thought-leadership': {
    stroke: '#f59e0b', // amber-500
    bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    fill: 'rgba(245, 158, 11, 0.12)',
    border: 'border-amber-500',
  },
  'proj-technical-breakdown': {
    stroke: '#8b5cf6', // violet-500
    bg: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300',
    fill: 'rgba(139, 92, 246, 0.12)',
    border: 'border-violet-500',
  },
};

const DEFAULT_COLOR = {
  stroke: '#3b82f6', // blue-500
  bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  fill: 'rgba(59, 130, 246, 0.12)',
  border: 'border-blue-500',
};

export const UsageDashboard: React.FC<UsageDashboardProps> = ({
  projects,
  sessions,
  activeProjectId,
  onSelectProject,
  onBack,
}) => {
  const { user, currentTenant } = useAuth();
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>(activeProjectId || 'all');
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
  const [metricMode, setMetricMode] = useState<'total' | 'prompt' | 'candidates' | 'cost'>('total');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [dbRecords, setDbRecords] = useState<ProjectUsageRecord[]>([]);

  // Automatically load usage records from Firestore for this user ID & tenant
  useEffect(() => {
    if (user) {
      const tenantId = currentTenant?.id || `tenant-${user.uid}`;
      loadUserUsageRecords(user.uid, tenantId)
        .then((recs) => {
          if (recs && recs.length > 0) {
            setDbRecords(recs);
          }
        })
        .catch((err) => {
          console.warn('Could not load user usage records from DB:', err);
        });
    }
  }, [user?.uid, currentTenant?.id]);

  // Retrieve raw usage records (merging Firestore database records with active memory)
  const allRecords = useMemo(() => {
    const local = getProjectUsageHistory(projects, sessions);
    if (dbRecords.length === 0) return local;

    const map = new Map<string, ProjectUsageRecord>();
    local.forEach((r) => map.set(r.id, r));
    dbRecords.forEach((r) => map.set(r.id, r));

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [projects, sessions, dbRecords]);

  // Generate date array for the chosen range [startDate ... today]
  const dateList = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      list.push(d.toISOString().slice(0, 10));
    }
    return list;
  }, [rangeDays]);

  // Filtered records by project if selected
  const activeRecords = useMemo(() => {
    if (selectedProjectFilter === 'all') return allRecords;
    return allRecords.filter((r) => r.projectId === selectedProjectFilter);
  }, [allRecords, selectedProjectFilter]);

  // Aggregate daily totals per project
  // Structure: { [date]: { [projectId]: { totalTokens, promptTokens, candidatesTokens, cost } } }
  const dailyMatrix = useMemo(() => {
    const matrix: Record<
      string,
      Record<string, { totalTokens: number; promptTokens: number; candidatesTokens: number; cost: number }>
    > = {};

    dateList.forEach((d) => {
      matrix[d] = {};
    });

    allRecords.forEach((r) => {
      if (matrix[r.date]) {
        if (!matrix[r.date][r.projectId]) {
          matrix[r.date][r.projectId] = { totalTokens: 0, promptTokens: 0, candidatesTokens: 0, cost: 0 };
        }
        matrix[r.date][r.projectId].totalTokens += r.totalTokens;
        matrix[r.date][r.projectId].promptTokens += r.promptTokens;
        matrix[r.date][r.projectId].candidatesTokens += r.candidatesTokens;
        matrix[r.date][r.projectId].cost += r.estimatedCostUsd;
      }
    });

    return matrix;
  }, [dateList, allRecords]);

  // Calculate overall metrics
  const summaryStats = useMemo(() => {
    let totalTokens = 0;
    let promptTokens = 0;
    let candidatesTokens = 0;
    let totalCost = 0;
    let peakDay = { date: '', tokens: 0 };

    dateList.forEach((dateStr) => {
      let dayTokens = 0;
      const dayData = dailyMatrix[dateStr] || {};

      Object.entries(dayData).forEach(([projId, stats]) => {
        if (selectedProjectFilter === 'all' || selectedProjectFilter === projId) {
          totalTokens += stats.totalTokens;
          promptTokens += stats.promptTokens;
          candidatesTokens += stats.candidatesTokens;
          totalCost += stats.cost;
          dayTokens += stats.totalTokens;
        }
      });

      if (dayTokens > peakDay.tokens) {
        peakDay = { date: dateStr, tokens: dayTokens };
      }
    });

    return {
      totalTokens,
      promptTokens,
      candidatesTokens,
      totalCost,
      peakDay,
    };
  }, [dateList, dailyMatrix, selectedProjectFilter]);

  // Chart dimension constants
  const chartHeight = 280;
  const chartWidth = 900;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  // Compute maximum Y value for scale
  const maxMetricValue = useMemo(() => {
    let maxVal = 0;
    dateList.forEach((dateStr) => {
      const dayData = dailyMatrix[dateStr] || {};
      if (selectedProjectFilter === 'all') {
        // Find individual project max or sum
        Object.values(dayData).forEach((item) => {
          const val =
            metricMode === 'total'
              ? item.totalTokens
              : metricMode === 'prompt'
              ? item.promptTokens
              : metricMode === 'candidates'
              ? item.candidatesTokens
              : item.cost;
          if (val > maxVal) maxVal = val;
        });
      } else {
        const item = dayData[selectedProjectFilter];
        if (item) {
          const val =
            metricMode === 'total'
              ? item.totalTokens
              : metricMode === 'prompt'
              ? item.promptTokens
              : metricMode === 'candidates'
              ? item.candidatesTokens
              : item.cost;
          if (val > maxVal) maxVal = val;
        }
      }
    });

    return maxVal > 0 ? maxVal * 1.15 : metricMode === 'cost' ? 0.05 : 10000;
  }, [dateList, dailyMatrix, selectedProjectFilter, metricMode]);

  // Coordinate conversion helpers
  const getX = (index: number) => {
    if (dateList.length <= 1) return paddingLeft;
    return paddingLeft + (index / (dateList.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const normalized = Math.min(Math.max(val / maxMetricValue, 0), 1);
    return paddingTop + plotHeight - normalized * plotHeight;
  };

  // Build SVG path lines for projects
  const lineSeries = useMemo(() => {
    const projectsToRender =
      selectedProjectFilter === 'all'
        ? projects
        : projects.filter((p) => p.id === selectedProjectFilter);

    return projectsToRender.map((proj) => {
      const points = dateList.map((dateStr, idx) => {
        const data = dailyMatrix[dateStr]?.[proj.id];
        const val = data
          ? metricMode === 'total'
            ? data.totalTokens
            : metricMode === 'prompt'
            ? data.promptTokens
            : metricMode === 'candidates'
            ? data.candidatesTokens
            : data.cost
          : 0;
        return {
          x: getX(idx),
          y: getY(val),
          date: dateStr,
          value: val,
          data,
        };
      });

      // SVG path definition
      const pathD = points.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
      }, '');

      // Gradient area under curve
      const areaD =
        points.length > 0
          ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${
              paddingTop + plotHeight
            } Z`
          : '';

      const style = PROJECT_COLORS[proj.id] || DEFAULT_COLOR;

      return {
        project: proj,
        points,
        pathD,
        areaD,
        style,
      };
    });
  }, [projects, selectedProjectFilter, dateList, dailyMatrix, metricMode, maxMetricValue]);

  // Y-axis tick intervals
  const yTicks = useMemo(() => {
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    return ticks.map((t) => {
      const val = maxMetricValue * t;
      const y = paddingTop + plotHeight - t * plotHeight;
      const label =
        metricMode === 'cost'
          ? `$${val.toFixed(3)}`
          : val >= 1000
          ? `${(val / 1000).toFixed(0)}k`
          : String(Math.round(val));
      return { y, label, val };
    });
  }, [maxMetricValue, metricMode]);

  // Hover point data for tooltip
  const hoverTooltipData = useMemo(() => {
    if (!hoveredDate) return null;
    const dateIdx = dateList.indexOf(hoveredDate);
    if (dateIdx === -1) return null;

    const x = getX(dateIdx);
    const dayStats = dailyMatrix[hoveredDate] || {};

    let dayTotal = 0;
    let dayCost = 0;
    const projectBreakdown = projects
      .filter((p) => selectedProjectFilter === 'all' || selectedProjectFilter === p.id)
      .map((p) => {
        const stats = dayStats[p.id] || { totalTokens: 0, promptTokens: 0, candidatesTokens: 0, cost: 0 };
        dayTotal += stats.totalTokens;
        dayCost += stats.cost;
        return {
          project: p,
          stats,
          color: PROJECT_COLORS[p.id] || DEFAULT_COLOR,
        };
      })
      .filter((item) => item.stats.totalTokens > 0 || selectedProjectFilter === item.project.id);

    return {
      date: hoveredDate,
      x,
      dayTotal,
      dayCost,
      projectBreakdown,
    };
  }, [hoveredDate, dateList, dailyMatrix, projects, selectedProjectFilter]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Date', 'Project Name', 'Topic', 'Prompt Tokens', 'Candidate Tokens', 'Total Tokens', 'Est Cost (USD)'];
    const rows = activeRecords.map((r) => [
      r.date,
      `"${r.projectName.replace(/"/g, '""')}"`,
      `"${(r.sessionTopic || '').replace(/"/g, '""')}"`,
      r.promptTokens,
      r.candidatesTokens,
      r.totalTokens,
      r.estimatedCostUsd.toFixed(6),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api-token-usage-${selectedProjectFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Analytics
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">
              <Building2 className="w-3 h-3 text-indigo-500" />
              <span>{currentTenant?.name || 'Workspace'}</span>
            </span>
            {user && (
              <span
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold"
                title={`Automatically saved to database for User ID: ${user.uid}`}
              >
                <Database className="w-3 h-3 text-emerald-500" />
                <span>Saved for: {user.email?.split('@')[0] || user.uid.slice(0, 8)}</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <BarChart2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>API Usage Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitor daily API token consumption, prompt inputs, completion outputs, and estimated costs across all your projects.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs flex items-center gap-1.5 transition-all"
            title="Export usage records to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {/* Project Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Filter by Project"
              value={selectedProjectFilter}
              onChange={(e) => {
                setSelectedProjectFilter(e.target.value);
                if (e.target.value !== 'all') {
                  onSelectProject(e.target.value);
                }
              }}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Projects (Overview)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tokens */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total API Tokens</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {summaryStats.totalTokens.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">tokens</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {summaryStats.promptTokens.toLocaleString()} in &bull; {summaryStats.candidatesTokens.toLocaleString()} out
          </p>
        </div>

        {/* Estimated API Cost */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated Cost</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ${summaryStats.totalCost.toFixed(4)}
            </span>
            <span className="text-xs text-slate-400">USD</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Ultra-efficient low cost tier
          </p>
        </div>

        {/* Active Projects */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Projects</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {selectedProjectFilter === 'all' ? projects.length : 1}
            </span>
            <span className="text-xs text-slate-400">of {projects.length} configured</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeRecords.length} recorded generations
          </p>
        </div>

        {/* Peak Daily Usage */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Peak Daily Usage</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {summaryStats.peakDay.tokens.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">tokens</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {summaryStats.peakDay.date || 'Today'}
          </p>
        </div>
      </div>

      {/* Main Interactive Line Chart Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>Daily API Token Consumption Timeline</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hover over points to inspect specific daily totals and project breakdowns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Metric Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setMetricMode('total')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  metricMode === 'total'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Total Tokens
              </button>
              <button
                onClick={() => setMetricMode('prompt')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  metricMode === 'prompt'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Inputs
              </button>
              <button
                onClick={() => setMetricMode('candidates')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  metricMode === 'candidates'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Outputs
              </button>
              <button
                onClick={() => setMetricMode('cost')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  metricMode === 'cost'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Cost ($)
              </button>
            </div>

            {/* Range Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setRangeDays(7)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  rangeDays === 7
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                7d
              </button>
              <button
                onClick={() => setRangeDays(14)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  rangeDays === 14
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                14d
              </button>
              <button
                onClick={() => setRangeDays(30)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  rangeDays === 30
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                30d
              </button>
            </div>
          </div>
        </div>

        {/* Project Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Projects:</span>
          {projects.map((proj) => {
            const isSelected = selectedProjectFilter === 'all' || selectedProjectFilter === proj.id;
            const style = PROJECT_COLORS[proj.id] || DEFAULT_COLOR;
            return (
              <button
                key={proj.id}
                onClick={() =>
                  setSelectedProjectFilter(selectedProjectFilter === proj.id ? 'all' : proj.id)
                }
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  isSelected
                    ? `${style.bg} border-slate-300 dark:border-slate-700 font-bold shadow-xs`
                    : 'opacity-40 grayscale border-transparent hover:opacity-75'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.stroke }} />
                <span>{proj.name.split('(')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* SVG Responsive Line Chart */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto overflow-visible select-none"
            onMouseLeave={() => setHoveredDate(null)}
          >
            <defs>
              {lineSeries.map((s) => (
                <linearGradient key={`grad-${s.project.id}`} id={`grad-${s.project.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.style.stroke} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={s.style.stroke} stopOpacity="0.0" />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal Grid lines */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={chartWidth - paddingRight}
                  y2={tick.y}
                  stroke="currentColor"
                  className="text-slate-100 dark:text-slate-800/80"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono font-medium"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Vertical Dates (X-axis) */}
            {dateList.map((dateStr, idx) => {
              // Show label every N dates depending on range
              const showLabel =
                rangeDays <= 7 ? true : rangeDays <= 14 ? idx % 2 === 0 : idx % 4 === 0 || idx === dateList.length - 1;
              const x = getX(idx);
              const labelDate = new Date(dateStr + 'T00:00:00');
              const formatted = labelDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

              return (
                <g key={dateStr}>
                  {showLabel && (
                    <text
                      x={x}
                      y={chartHeight - 12}
                      textAnchor="middle"
                      className={`text-[10px] font-mono transition-colors ${
                        hoveredDate === dateStr
                          ? 'fill-indigo-600 dark:fill-indigo-400 font-bold'
                          : 'fill-slate-400 dark:fill-slate-500'
                      }`}
                    >
                      {idx === dateList.length - 1 ? 'Today' : formatted}
                    </text>
                  )}

                  {/* Invisible hover column for easy scrubbing */}
                  <rect
                    x={x - (plotWidth / dateList.length) / 2}
                    y={paddingTop}
                    width={plotWidth / dateList.length}
                    height={plotHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDate(dateStr)}
                  />
                </g>
              );
            })}

            {/* Area fills */}
            {lineSeries.map((s) => (
              <path
                key={`area-${s.project.id}`}
                d={s.areaD}
                fill={`url(#grad-${s.project.id})`}
                className="transition-opacity duration-300"
              />
            ))}

            {/* Lines */}
            {lineSeries.map((s) => (
              <path
                key={`path-${s.project.id}`}
                d={s.pathD}
                fill="none"
                stroke={s.style.stroke}
                strokeWidth={selectedProjectFilter === s.project.id ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
            ))}

            {/* Points / Dots */}
            {lineSeries.map((s) =>
              s.points.map((pt, pIdx) => {
                const isHovered = hoveredDate === pt.date;
                return (
                  <circle
                    key={`pt-${s.project.id}-${pIdx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5.5 : 3.5}
                    fill={isHovered ? '#ffffff' : s.style.stroke}
                    stroke={s.style.stroke}
                    strokeWidth={isHovered ? 3 : 1.5}
                    className="transition-all duration-150 cursor-pointer pointer-events-none"
                  />
                );
              })
            )}

            {/* Hover vertical crosshair */}
            {hoverTooltipData && (
              <line
                x1={hoverTooltipData.x}
                y1={paddingTop}
                x2={hoverTooltipData.x}
                y2={paddingTop + plotHeight}
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                className="pointer-events-none"
              />
            )}
          </svg>

          {/* Interactive Tooltip Card */}
          {hoverTooltipData && (
            <div
              className="absolute pointer-events-none z-20 bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-md text-xs space-y-2 min-w-[210px] transform -translate-x-1/2 transition-transform duration-75"
              style={{
                left: `${(hoverTooltipData.x / chartWidth) * 100}%`,
                top: '15px',
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 font-mono">
                <span className="font-semibold text-slate-300">
                  {new Date(hoverTooltipData.date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                  {metricMode === 'cost' ? 'Daily Cost' : 'Daily Tokens'}
                </span>
              </div>

              <div className="space-y-1.5 pt-0.5">
                {hoverTooltipData.projectBreakdown.map((item) => (
                  <div key={item.project.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color.stroke }} />
                      <span className="text-slate-300 truncate">{item.project.name.split('(')[0].trim()}</span>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">
                      {metricMode === 'cost'
                        ? `$${item.stats.cost.toFixed(4)}`
                        : metricMode === 'prompt'
                        ? `${item.stats.promptTokens.toLocaleString()} in`
                        : metricMode === 'candidates'
                        ? `${item.stats.candidatesTokens.toLocaleString()} out`
                        : `${item.stats.totalTokens.toLocaleString()}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-700/80 pt-1.5 flex items-center justify-between font-bold text-[11px]">
                <span className="text-slate-400">Total:</span>
                <span className="font-mono text-emerald-400">
                  {hoverTooltipData.dayTotal.toLocaleString()} tokens (~${hoverTooltipData.dayCost.toFixed(4)})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historical Generation Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Session Generation History</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detailed log of token consumption per generation session from localStorage.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Showing {activeRecords.length} records
          </span>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Project</th>
                <th className="py-3 px-3">Topic / Subject</th>
                <th className="py-3 px-3 text-right">Prompt Tokens</th>
                <th className="py-3 px-3 text-right">Output Tokens</th>
                <th className="py-3 px-3 text-right">Total Tokens</th>
                <th className="py-3 px-3 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
              {activeRecords.map((record) => {
                const color = PROJECT_COLORS[record.projectId] || DEFAULT_COLOR;
                return (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {record.date}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${color.bg}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                        {record.projectName.split('(')[0].trim()}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-[280px] truncate" title={record.sessionTopic}>
                      {record.sessionTopic || 'Clinical Article Generation'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {record.promptTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {record.candidatesTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {record.totalTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      ${record.estimatedCostUsd.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
