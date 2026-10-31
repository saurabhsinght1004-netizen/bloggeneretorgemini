import { GuidelineProfile } from '../types/pipeline';

// Defaults for a new profile, condensed from the agency's UK medical blog guidelines,
// reference-checking instructions, proofreading rules, QA checklist and client feedback.
// Every field is editable per client in the Guidelines screen.

export const DEFAULT_WRITING_RULES = `ORIGINALITY
- 100% original. Never copy or closely paraphrase any online source, including the reference articles.
- Must not read as templated, repetitive or AI-generated. Do not repeat the same point in several sections.

VOICE AND TONE (client feedback: this is the most important rule)
- Write as if talking to one reader. Use "you" and "your" throughout, and "we" for the clinic where natural.
- Be genuinely personal and conversational, not just pronoun-swapped textbook text. Acknowledge how the reader may feel, use everyday comparisons, and make the article enjoyable to read.
- Professional, empathetic, reassuring and trustworthy. No fear-based, sensational, exaggerated or promotional wording.
- Explain every medical term simply the first time it appears. Do not diagnose the reader.

OPENING
- Open with the reader's real concern or question, warmly. Example of the expected style:
  "If you're due to have a colposcopy, it's completely understandable to wonder whether it will hurt. A colposcopy is generally well tolerated, and most women experience little more than mild discomfort."
- Never open with a dry definition, a generic statement or a bullet-point summary.

STRUCTURE
- One H1, then H2 and H3. Do not number headings.
- Subheadings must be engaging, easy to follow and reader-focused, ideally the question the reader is asking (e.g. "Will a colposcopy hurt?"), never impersonal labels.
- Short paragraphs: about 2 to 3 moderate sentences.
- Key Takeaways, if used, go at the END of the article (before FAQs/Final Thoughts). NEVER at the start.
- Include at least one table or data element that adds real depth (comparison, recovery timeline, risk factors, history timeline for history topics). Place tables in the middle of the article next to the section they support, never near the end, and never two tables back to back. Tables must not make stronger claims than the body text.
- Include useful elevated features where they add value: Evidence Note, Research Insight, Clinical Tip, UK Guidance Note, Myth vs Fact. Never add them as decoration.
- Include FAQs that answer genuine patient questions without repeating the article.
- End with Final Thoughts: summarise the main message, reassure, no new topics, include the CTA naturally.

LANGUAGE
- UK English only, British spelling and grammar (tumour, prioritised, signalling, programmes, anaesthetist, da Vinci).
- Use pre-operative, peri-operative, post-operative consistently.
- Avoid repetitive stock phrases such as "If this applies to you", "Your healthcare team", "It is important for you", "can help support", "natural-looking results", "safe and effective".

MEDICAL CLAIM SAFETY
- Balanced, evidence-based, realistic wording: "may improve", "may reduce", "in suitable patients", "may be associated with".
- Never use: cure, guaranteed, permanent, instant, risk-free, harmless, no side effects, best, leading.
- Be especially careful with success rates, recovery time, hospital stay, catheter duration, pain, continence, erectile function, cosmetic results and long-term outcomes.
- Explain when routine advice is fine, when urgent assessment is needed and when to seek emergency help. Tell readers not to change medication themselves.
- For new or emerging treatments, clearly separate established care, specialist-only options, research-stage treatments, UK regulatory status and actual UK availability. US approval or trial success does not mean UK availability.
- Do not assume clinic-specific or surgeon-specific techniques unless they are confirmed in the brief.

EVIDENCE IN THE BODY
- Explain at least one strong study or recognised guideline in the body in patient-friendly language, including what it means for the reader, without overstating it.
- Statistics must come from credible sources and be presented as population-level findings, never as guaranteed individual outcomes.
- If the body names an organisation or guideline ("NICE recommends..."), that source must be in the reference list. Otherwise rephrase.`;

export const DEFAULT_REFERENCE_RULES = `- Every reference must exist, be accessible and directly support the claim it is attached to. Never invent references or guess missing details.
- Five real, relevant references are enough. Do not pad the list.
- Prioritise UK sources: NICE, NHS, GOV.UK, UKHSA, MHRA, GMC, CQC, RCOG, BAUS, Royal Colleges, UK specialist societies, Cancer Research UK, Prostate Cancer UK, BMJ.
- Peer-reviewed evidence may come from PubMed, PMC, MDPI, ScienceDirect and academic.oup.com, but each article is judged on its own quality, date and relevance, never on the platform.
- Prefer current guidelines, systematic reviews, meta-analyses, major trials and strong cohort studies. Avoid case reports, commercial clinic pages, blogs, news, Wikipedia, forums, preprints and manufacturer pages for important clinical claims.
- Do not use an overseas guideline where UK guidance exists, an old study where newer evidence exists, a patient leaflet for a complex specialist claim, an observational study to imply causation, or lab/animal research for firm patient-outcome claims.
- No duplicate references. Prefer fresh topic-specific sources.
- NICE: "National Institute for Health and Care Excellence (year) Full title. NICE guideline NGxx." Technology appraisals: "Technology appraisal guidance TAxxxx". Only give numbers that are verified.
- NHS: "NHS (review year) Exact page title." Use the last-reviewed date when shown.
- Use "no date" only when the source shows no date. Never "n.d.".
- URLs: direct page (not a homepage or search results), complete, on one line, https://, no tracking parameters, no stray punctuation.`;

export const DEFAULT_QA_CHECKLIST = `Check the whole blog start to finish before giving a verdict:
- Medical and factual accuracy, including numbers (doses, fluid amounts, timings, risk figures).
- Current UK guidance where relevant (verify online when guidance may have changed).
- Evidence quality, and whether each reference truly supports the claim it is attached to. Do not say a reference supports something unless its content was checked.
- Client-specific reference limits and allowed domains.
- Reader-friendly "you/your" language that is genuinely personal and conversational, not just pronoun counting.
- An engaging opening that speaks to the reader's concern. No generic or impersonal opening.
- Engaging, easy-to-follow subheadings. No impersonal or hard-to-understand headings.
- No generic, templated or AI-sounding text. No "copy-paste" feel. Originality and no duplication with other sites.
- Key Takeaways must NOT appear at the start. If present, they belong at the end.
- Tables or data that add depth, placed mid-article, not back to back.
- Repetition of ideas or stock phrases.
- UK English, British spelling and grammar, consistent terminology.
- Medical claim safety: no absolute or promotional wording; urgent and emergency warning signs where the topic needs them.
- Named organisations or guidelines in the body are present in the reference list.
- Internal links and anchor text as required, CTA relevant to the topic and not over-promotional.
- FAQs useful; Final Thoughts relevant to the actual topic.
- Distinguish essential factual corrections from optional editorial improvements.`;

export const DEFAULT_REFERENCE_MIX = '2 MDPI, 2 PMC, 2 PubMed, 2 ScienceDirect';

export function createDefaultGuidelineProfile(name: string): Omit<GuidelineProfile, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    writingRules: DEFAULT_WRITING_RULES,
    referenceRules: DEFAULT_REFERENCE_RULES,
    qaChecklist: DEFAULT_QA_CHECKLIST,
    scoreScale: 100,
    referenceStyle: 'harvard_short',
    referenceCount: 5,
    referenceMix: DEFAULT_REFERENCE_MIX,
    allowedDomains: [],
    minWordCount: 2400,
    cta: '',
    internalLinks: '',
  };
}
