export interface PipelineStep {
  id: string;
  title: string;
  promptTemplate: string;
  description?: string;
  systemRole?: string;
  temperature?: number;
  isEnabled?: boolean;
  isFinalBlogStep?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  tone: string;
  targetWordCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  steps: PipelineStep[];
}

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface StepOutputRecord {
  stepId: string;
  stepTitle: string;
  promptSent: string;
  output: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startedAt?: string;
  completedAt?: string;
  tokenUsage?: TokenUsage;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  stepId?: string;
}

export interface RunSession {
  id: string;
  projectId: string;
  userInput: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentStepIndex: number;
  stepOutputs: Record<string, StepOutputRecord>;
  finalBlog?: string;
  chatMessages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  totalTokens?: TokenUsage;
}

export interface ProjectUsageRecord {
  id: string;
  projectId: string;
  projectName: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  sessionTopic?: string;
  stepsCompleted?: number;
}

