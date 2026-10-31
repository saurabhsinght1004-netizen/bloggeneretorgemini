import type { GoogleGenAI, GenerateContentResponse } from '@google/genai';

export interface ResearchSource {
  id: number;
  title: string;
  url: string;
  domain: string;
}

export interface ResearchInput {
  topic: string;
  audience?: string;
  tone?: string;
  referenceUrls?: string[];
  /** Client's allowed reference domains; research favours these. */
  allowedDomains?: string[];
}

export interface ResearchResult {
  topic: string;
  brief: string;
  styleNotes?: string;
  sources: ResearchSource[];
  searchQueries: string[];
  createdAt: string;
  tokenUsage: { promptTokens: number; candidatesTokens: number; totalTokens: number };
}

const RESOLVE_TIMEOUT_MS = 5000;

/** Google Search grounding returns short-lived redirect links; follow one hop to get the publisher URL. */
async function resolveRedirect(uri: string): Promise<string> {
  if (!uri.includes('grounding-api-redirect')) return uri;
  try {
    const res = await fetch(uri, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS) });
    return res.headers.get('location') || uri;
  } catch {
    return uri;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Turns grounding chunks into a numbered, de-duplicated source list and inserts [n] markers into the text. */
async function buildCitedBrief(response: GenerateContentResponse): Promise<{ brief: string; sources: ResearchSource[] }> {
  const text = response.text || '';
  const meta = response.candidates?.[0]?.groundingMetadata;
  const chunks = meta?.groundingChunks || [];

  const resolved = await Promise.all(chunks.map((c) => (c.web?.uri ? resolveRedirect(c.web.uri) : Promise.resolve(''))));

  const sources: ResearchSource[] = [];
  const chunkToSource = new Map<number, number>();
  resolved.forEach((url, i) => {
    if (!url) return;
    let source = sources.find((s) => s.url === url);
    if (!source) {
      const domain = hostOf(url) || chunks[i].web?.title || '';
      source = { id: sources.length + 1, url, domain, title: chunks[i].web?.title || domain };
      sources.push(source);
    }
    chunkToSource.set(i, source.id);
  });

  // Insert from the end so earlier positions stay valid.
  let brief = text;
  const supports = [...(meta?.groundingSupports || [])].sort(
    (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
  );
  for (const support of supports) {
    const segmentText = support.segment?.text;
    if (!segmentText) continue;
    const ids = [...new Set((support.groundingChunkIndices || []).map((i) => chunkToSource.get(i)).filter(Boolean))];
    if (ids.length === 0) continue;
    const at = brief.lastIndexOf(segmentText);
    if (at < 0) continue;
    const end = at + segmentText.length;
    brief = brief.slice(0, end) + ids.map((id) => `[${id}]`).join('') + brief.slice(end);
  }

  return { brief, sources };
}

function researchPrompt({ topic, audience, tone, allowedDomains }: ResearchInput): string {
  const domainRule = allowedDomains?.length
    ? `
The client only accepts references from: ${allowedDomains.join(', ')}. Find evidence on those sites wherever possible.`
    : '';
  return `Research this blog topic using Google Search before answering: "${topic}"
Readers: ${audience || 'general readers'}. Tone of the final article: ${tone || 'clear and practical'}.

Produce a research brief in Markdown that a writer will rely on. Use only what you find in search results.

## What readers are really asking
The 6 to 10 concrete questions people search for on this topic, phrased as a reader would ask them.

## Key facts and figures
Bullet points. Each one states a specific finding with its number, who was studied (sample size, population), the source type (trial, review, guideline, manufacturer data) and the year. Include the limitation when the source states one, e.g. "only 5 of 60 participants were men".

## Official guidance
What named national or professional bodies relevant to the readers' country say (for UK readers: NHS, NICE, MHRA, GMC or the relevant royal college). Name the body and document.

## Where evidence is weak or disputed
Claims that are commonly made but poorly supported, and genuine disagreements.

## Common myths
Misconceptions with the evidence-based correction.

Rules: prefer primary and authoritative sources (peer-reviewed journals, PubMed, government and professional bodies) over blogs and forums. Prefer sources from the last 5 years. Never state a statistic you did not find. If you could not find solid evidence for a section, say so plainly.${domainRule}`;
}

function stylePrompt(urls: string[]): string {
  return `Read these example articles:
${urls.map((u) => `- ${u}`).join('\n')}

Describe their house style so another writer can match it without copying any text:
- heading style (e.g. every H2 is a reader question) and typical section order
- named callout boxes and recurring blocks (e.g. "Evidence Note", "Myth vs Fact" table, Key Takeaways, FAQs)
- how evidence is introduced in the prose and how references are formatted
- paragraph length, reading level, point of view (second person?) and hedging language
- byline, disclaimers and calls to action
- approximate length
Be concrete and brief. Bullet points only.`;
}

export async function runResearch(
  ai: GoogleGenAI,
  model: string,
  input: ResearchInput,
  withTimeout: <T>(p: Promise<T>, ms: number, msg: string) => Promise<T>,
  timeoutMs: number
): Promise<ResearchResult> {
  const referenceUrls = (input.referenceUrls || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 10);

  const searchCall = withTimeout(
    ai.models.generateContent({
      model,
      contents: researchPrompt(input),
      config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
    }),
    timeoutMs,
    `Web research timed out after ${timeoutMs / 1000} seconds`
  );

  const styleCall = referenceUrls.length
    ? withTimeout(
        ai.models.generateContent({
          model,
          contents: stylePrompt(referenceUrls),
          config: { tools: [{ urlContext: {} }], temperature: 0.2 },
        }),
        timeoutMs,
        `Reading reference articles timed out after ${timeoutMs / 1000} seconds`
      )
    : Promise.resolve(null);

  const [searchRes, styleRes] = await Promise.all([searchCall, styleCall]);
  const { brief, sources } = await buildCitedBrief(searchRes);

  if (!brief.trim()) throw new Error('Web research returned an empty brief.');
  if (sources.length === 0) throw new Error('Web research found no sources for this topic. Try rephrasing it.');

  const usage = [searchRes, styleRes].reduce(
    (acc, r) => {
      if (!r?.usageMetadata) return acc;
      acc.promptTokens += r.usageMetadata.promptTokenCount || 0;
      acc.candidatesTokens += r.usageMetadata.candidatesTokenCount || 0;
      acc.totalTokens += r.usageMetadata.totalTokenCount || 0;
      return acc;
    },
    { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 }
  );

  return {
    topic: input.topic,
    brief,
    styleNotes: styleRes?.text?.trim() || undefined,
    sources,
    searchQueries: searchRes.candidates?.[0]?.groundingMetadata?.webSearchQueries || [],
    createdAt: new Date().toISOString(),
    tokenUsage: usage,
  };
}

/** Appended to every pipeline step prompt once research exists for the session. */
export function researchContext(pack: Pick<ResearchResult, 'brief' | 'sources' | 'styleNotes' | 'createdAt'>): string {
  const sourceList = pack.sources.map((s) => `[${s.id}] ${s.title}. ${s.url}`).join('\n');
  const style = pack.styleNotes ? `\n\n## House style to follow (learned from reference articles)\n${pack.styleNotes}` : '';
  return `

---
## Research source pack (from web search, ${pack.createdAt.slice(0, 10)})
${pack.brief}

### Sources
${sourceList}${style}

## Evidence rules
- Base factual claims, statistics, study findings and guidance on the source pack above.
- Any reference you list must be one of the Sources above, with its exact URL. Never invent studies, authors, journals, figures or links.
- If a point needs evidence the pack does not contain, write it without a specific figure or citation.
- Do not show the [n] markers in reader-facing prose unless the article format calls for numbered citations.`;
}

function normaliseUrl(url: string): string {
  return url.replace(/[)\].,;:'"]+$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
}

/** URLs in generated text that did not come from research: likely hallucinated references. */
export function findUnverifiedUrls(text: string, sources: { url: string }[]): string[] {
  const known = new Set(sources.map((s) => normaliseUrl(s.url)));
  const found = text.match(/https?:\/\/[^\s<>()\]]+/g) || [];
  return [...new Set(found.filter((u) => !known.has(normaliseUrl(u))))];
}
