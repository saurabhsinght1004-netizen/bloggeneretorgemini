import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runResearch, researchContext, findUnverifiedUrls } from './server/research';
import { guidelinesContext, runQaReview, type GuidelineInput } from './server/guidelines';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const STEP_TIMEOUT_MS = Number(process.env.GEMINI_STEP_TIMEOUT_MS) || 60000;
const RESEARCH_TIMEOUT_MS = Number(process.env.GEMINI_RESEARCH_TIMEOUT_MS) || 90000;
const QA_TIMEOUT_MS = Number(process.env.GEMINI_QA_TIMEOUT_MS) || 150000;

app.use(express.json({ limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', hasApiKey: Boolean(ai), model: MODEL });
});

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutErrorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutErrorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/** Validates a guideline profile from the client and fills any missing optional fields. */
function toGuidelineInput(g: any): GuidelineInput | null {
  if (!g || typeof g.name !== 'string' || !g.name.trim()) return null;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    name: g.name.trim(),
    writingRules: text(g.writingRules),
    referenceRules: text(g.referenceRules),
    qaChecklist: text(g.qaChecklist),
    scoreScale: g.scoreScale === 10 ? 10 : 100,
    referenceStyle: g.referenceStyle === 'harvard_full' ? 'harvard_full' : 'harvard_short',
    referenceCount: Number.isInteger(g.referenceCount) && g.referenceCount > 0 ? g.referenceCount : 5,
    referenceMix: text(g.referenceMix),
    allowedDomains: Array.isArray(g.allowedDomains) ? g.allowedDomains.filter((d: unknown) => typeof d === 'string') : [],
    minWordCount: Number(g.minWordCount) > 0 ? Number(g.minWordCount) : 0,
    cta: text(g.cta),
    internalLinks: text(g.internalLinks),
  };
}

function requireAi(res: express.Response): GoogleGenAI | null {
  if (!ai) res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  return ai;
}

function sendModelError(res: express.Response, where: string, err: any) {
  const message = String(err?.message || err || 'unknown error');
  console.error(`Gemini call failed in ${where}:`, message);
  if (err?.status === 429 || /RESOURCE_EXHAUSTED|"code":\s*429/.test(message)) {
    res.status(429).json({
      error: 'Gemini quota exceeded for this API key. Check its limits and billing at https://ai.dev/rate-limit, then retry.',
    });
    return;
  }
  res.status(502).json({ error: `AI model request failed: ${message}` });
}

// Web research: Google Search grounding for facts, URL context for reference article style
app.post('/api/research', async (req, res) => {
  const { topic, audience, tone, referenceUrls, allowedDomains } = req.body;
  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ error: 'Missing topic parameter.' });
    return;
  }
  const client = requireAi(res);
  if (!client) return;

  try {
    const result = await runResearch(
      client,
      MODEL,
      {
        topic,
        audience,
        tone,
        referenceUrls: Array.isArray(referenceUrls) ? referenceUrls : [],
        allowedDomains: Array.isArray(allowedDomains) ? allowedDomains : [],
      },
      withTimeout,
      RESEARCH_TIMEOUT_MS
    );
    res.json({ ...result, model: MODEL });
  } catch (err: any) {
    sendModelError(res, '/api/research', err);
  }
});

app.post('/api/generate-step', async (req, res) => {
  const { prompt, systemInstruction, temperature = 0.7, research, guidelines, targetWordCount } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt parameter.' });
    return;
  }
  const client = requireAi(res);
  if (!client) return;

  const hasResearch = research && typeof research.brief === 'string' && Array.isArray(research.sources);
  const profile = toGuidelineInput(guidelines);
  const fullPrompt =
    prompt +
    (profile ? guidelinesContext(profile, Number(targetWordCount) || 0) : '') +
    (hasResearch ? researchContext(research) : '');

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: MODEL,
        contents: fullPrompt,
        config: {
          systemInstruction: systemInstruction || 'You are an expert content strategist and professional writer.',
          temperature: Math.min(Math.max(Number(temperature) || 0.7, 0.1), 1.0),
        },
      }),
      STEP_TIMEOUT_MS,
      `Gemini request timed out after ${STEP_TIMEOUT_MS / 1000} seconds`
    );

    const text = response.text || '';
    if (!text.trim()) {
      res.status(502).json({ error: 'The model returned an empty response. Please retry this step.' });
      return;
    }

    const promptTokens = response.usageMetadata?.promptTokenCount || Math.round(fullPrompt.length / 4);
    const candidatesTokens = response.usageMetadata?.candidatesTokenCount || Math.round(text.length / 4);
    res.json({
      text,
      mode: 'gemini',
      unverifiedUrls: hasResearch ? findUnverifiedUrls(text, research.sources) : [],
      usage: {
        promptTokens,
        candidatesTokens,
        totalTokens: response.usageMetadata?.totalTokenCount || promptTokens + candidatesTokens,
      },
    });
  } catch (err: any) {
    sendModelError(res, '/api/generate-step', err);
  }
});

// Full start-to-finish QA and reference check against the client's guideline profile
app.post('/api/qa-review', async (req, res) => {
  const { article, guidelines, sourceUrls } = req.body;
  if (!article || typeof article !== 'string') {
    res.status(400).json({ error: 'Missing article to review.' });
    return;
  }
  const profile = toGuidelineInput(guidelines);
  if (!profile) {
    res.status(400).json({ error: 'A guideline profile is required for QA review.' });
    return;
  }
  const client = requireAi(res);
  if (!client) return;

  try {
    const urls = Array.isArray(sourceUrls) ? sourceUrls.filter((u: unknown) => typeof u === 'string') : [];
    const result = await runQaReview(client, MODEL, article, profile, urls, withTimeout, QA_TIMEOUT_MS);
    res.json({ ...result, model: MODEL });
  } catch (err: any) {
    sendModelError(res, '/api/qa-review', err);
  }
});

app.post('/api/chat-refine', async (req, res) => {
  const { stepTitle, currentOutput, userMessage, systemRole } = req.body;
  if (!currentOutput || !userMessage) {
    res.status(400).json({ error: 'currentOutput and userMessage are required.' });
    return;
  }
  const client = requireAi(res);
  if (!client) return;

  const prompt = `You are an expert editor (${systemRole || 'Editor'}).
The user is working on step "${stepTitle}".
Here is the current draft/content for this step:
"""
${currentOutput}
"""

The user requested the following modification or refinement:
"${userMessage}"

Keep every existing reference and citation unless the user asks to remove it, and do not add new references.

Please provide:
1. A brief explanation of the modifications made.
2. The complete updated content for this step.

Format your response as:
REPLY: <your concise conversational response to the user>
---UPDATED_CONTENT---
<the revised full content here>`;

  try {
    const response = await withTimeout(
      client.models.generateContent({ model: MODEL, contents: prompt, config: { temperature: 0.6 } }),
      STEP_TIMEOUT_MS,
      `Gemini chat refinement timed out after ${STEP_TIMEOUT_MS / 1000} seconds`
    );

    const raw = response.text || '';
    if (raw.includes('---UPDATED_CONTENT---')) {
      const [replyPart, content] = raw.split('---UPDATED_CONTENT---');
      res.json({ reply: replyPart.replace(/^REPLY:\s*/i, '').trim(), updatedContent: content.trim() });
    } else {
      res.json({ reply: 'Updated the step according to your feedback.', updatedContent: raw.trim() });
    }
  } catch (err: any) {
    sendModelError(res, '/api/chat-refine', err);
  }
});

// Start dev or production server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
