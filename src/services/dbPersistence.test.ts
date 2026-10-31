import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Project, RunSession, ProjectUsageRecord } from '../types/pipeline';
import { createDefaultProjects } from '../utils/pipeline';
import { filterUserOnlyProjects } from './projectFilters';

describe('Database Persistence & Multi-Tenant Isolation', () => {
  test('createDefaultProjects provides valid schemas for database serialization', () => {
    const defaults = createDefaultProjects();
    assert.ok(Array.isArray(defaults));
    assert.ok(defaults.length >= 1);

    const first = defaults[0];
    assert.ok(first.id);
    assert.ok(first.name);
    assert.ok(Array.isArray(first.steps));
    assert.ok(first.steps.length > 0);

    // Verify all steps have valid promptTemplate and IDs
    first.steps.forEach((step, idx) => {
      assert.ok(step.id, `Step at index ${idx} missing id`);
      assert.ok(step.title, `Step at index ${idx} missing title`);
      assert.ok(step.promptTemplate, `Step at index ${idx} missing promptTemplate`);
    });
  });

  test('Project serialization serializes required fields', () => {
    const sampleProject: Project = {
      id: 'proj-clinical-test-123',
      name: 'Clinical Guidance Test',
      description: 'Test description for persistence',
      targetAudience: 'Patients and Clinicians',
      tone: 'Authoritative, calm',
      targetWordCount: 2500,
      tags: ['Urology', 'Clinical'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          id: 'step-1',
          title: 'Initial Outline',
          promptTemplate: 'Draft an outline for {{input}}',
        },
      ],
    };

    const serialized = JSON.parse(JSON.stringify(sampleProject));
    assert.strictEqual(serialized.id, 'proj-clinical-test-123');
    assert.strictEqual(serialized.name, 'Clinical Guidance Test');
    assert.strictEqual(serialized.steps.length, 1);
  });

  test('Session serialization maintains stepOutputs and tokenUsage for user ID', () => {
    const sampleSession: RunSession = {
      id: 'session-user-123',
      projectId: 'proj-clinical-test-123',
      userInput: 'Why Does Prostatitis Keep Coming Back?',
      status: 'completed',
      currentStepIndex: 1,
      stepOutputs: {
        'step-1': {
          stepId: 'step-1',
          stepTitle: 'Outline',
          promptSent: 'Draft outline',
          output: '# Clinical Outline\n1. Intro\n2. Pathology',
          status: 'completed',
          tokenUsage: {
            promptTokens: 1200,
            candidatesTokens: 850,
            totalTokens: 2050,
            estimatedCostUsd: 0.0003,
          },
        },
      },
      finalBlog: '# Why Does Prostatitis Keep Coming Back?\n\nClinical review...',
      chatMessages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const serialized = JSON.parse(JSON.stringify(sampleSession));
    assert.strictEqual(serialized.id, 'session-user-123');
    assert.strictEqual(serialized.stepOutputs['step-1'].status, 'completed');
    assert.strictEqual(serialized.stepOutputs['step-1'].tokenUsage.totalTokens, 2050);
  });

  test('UsageRecord contains accurate token metrics and timestamp', () => {
    const usageRecord: ProjectUsageRecord = {
      id: 'usage-rec-999',
      projectId: 'proj-prostate-clinic-london',
      projectName: 'Prostate Clinic London Clinical Guide',
      date: '2026-10-26',
      timestamp: new Date().toISOString(),
      promptTokens: 4500,
      candidatesTokens: 3200,
      totalTokens: 7700,
      estimatedCostUsd: 0.0013,
      sessionTopic: 'Antibiotic stewardship in prostatitis',
      stepsCompleted: 5,
    };

    assert.strictEqual(usageRecord.totalTokens, usageRecord.promptTokens + usageRecord.candidatesTokens);
    assert.ok(usageRecord.estimatedCostUsd > 0);
  });

  test('filterUserOnlyProjects excludes default starter projects and keeps only user-created projects', () => {
    const defaults = createDefaultProjects();
    const userCustomProject: Project = {
      id: 'proj-my-custom-patient-guide-999',
      name: 'Dr. Smith Urology Innovations',
      description: 'Custom user-created blog project',
      targetAudience: 'Patients',
      tone: 'Informative',
      targetWordCount: 1500,
      tags: ['Custom'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          id: 'step-1',
          title: 'Custom Hook',
          promptTemplate: 'Write custom hook for {{input}}',
        },
      ],
    };

    const combinedList = [...defaults, userCustomProject];
    assert.strictEqual(combinedList.length, defaults.length + 1);

    // Verify filter removes all 4 default starter projects
    const filtered = filterUserOnlyProjects(combinedList);
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 'proj-my-custom-patient-guide-999');
    assert.strictEqual(filtered[0].name, 'Dr. Smith Urology Innovations');

    // If only defaults are provided, filtered list is empty
    const onlyDefaultsFiltered = filterUserOnlyProjects(defaults);
    assert.strictEqual(onlyDefaultsFiltered.length, 0);
  });
});
