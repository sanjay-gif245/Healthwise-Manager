// LLM integration layer.
//
// Two responsibilities kept deliberately separate:
//  1. Building the exact prompts required by the spec.
//  2. Calling a provider (Anthropic's Messages API) with a timeout + one
//     retry, and falling back to a deterministic, rule-based "simulated"
//     generator whenever no API key is configured OR the provider call
//     fails/returns something we can't parse. A patient/doctor should never
//     see a broken page because the LLM had a bad day — worst case they see
//     a clearly-labelled simulated summary and the failure is logged.

import type { PrescriptionItem, UrgencyLevel } from '@/types/models';

export interface PreVisitResult {
  urgency_level: UrgencyLevel;
  chief_complaint: string;
  suggested_questions: string[];
  status: 'ready' | 'simulated' | 'failed';
  error?: string;
}

export interface PostVisitResult {
  summary_text: string;
  status: 'ready' | 'simulated' | 'failed';
  error?: string;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const REQUEST_TIMEOUT_MS = 15_000;

function apiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || DEFAULT_MODEL,
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === 'text')?.text;
    if (!text) throw new Error('Empty response from LLM');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function extractJson(text: string): unknown {
  // Models sometimes wrap JSON in prose or code fences despite instructions;
  // pull out the first {...} block defensively.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in LLM response');
  return JSON.parse(match[0]);
}

// --- Pre-visit summary -------------------------------------------------

const PRE_VISIT_SYSTEM = `You are a clinical intake assistant helping a doctor triage a patient before a visit.
Respond with ONLY a JSON object (no prose, no markdown fences) matching this exact shape:
{"urgency_level": "Low" | "Medium" | "High", "chief_complaint": string, "suggested_questions": [string, string, string]}
"suggested_questions" must contain exactly three concise questions the doctor could ask the patient.
Be conservative: if symptoms could indicate a serious or emergent condition, prefer a higher urgency level.`;

function buildPreVisitPrompt(symptoms: string): string {
  return `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}`;
}

function simulatePreVisit(symptoms: string): PreVisitResult {
  const s = symptoms.toLowerCase();
  const highFlags = [
    'chest pain', 'difficulty breathing', 'can\'t breathe', 'cannot breathe', 'severe bleeding',
    'unconscious', 'stroke', 'numbness on one side', 'suicidal', 'severe allergic', 'anaphylaxis',
    'coughing blood', 'blue lips', 'seizure',
  ];
  const mediumFlags = [
    'fever', 'vomiting', 'persistent', 'infection', 'severe pain', 'dehydrat', 'high temperature',
    'worsening', 'rash spreading', 'dizziness',
  ];
  let urgency: UrgencyLevel = 'Low';
  if (highFlags.some((f) => s.includes(f))) urgency = 'High';
  else if (mediumFlags.some((f) => s.includes(f))) urgency = 'Medium';

  const chief = symptoms.trim().split(/[.\n]/)[0]?.slice(0, 140) || 'Patient-reported symptoms';

  return {
    urgency_level: urgency,
    chief_complaint: chief,
    suggested_questions: [
      'When did the symptoms first start, and have they changed since then?',
      'Have you tried any medication or home remedies, and did they help?',
      'Do you have any relevant medical history, allergies, or current medications?',
    ],
    status: 'simulated',
  };
}

export async function generatePreVisitSummary(symptoms: string): Promise<PreVisitResult> {
  if (!apiKey()) {
    return simulatePreVisit(symptoms);
  }
  try {
    const raw = await withRetry(() => callAnthropic(PRE_VISIT_SYSTEM, buildPreVisitPrompt(symptoms)));
    const parsed = extractJson(raw) as Partial<PreVisitResult>;
    if (
      !parsed.urgency_level ||
      !['Low', 'Medium', 'High'].includes(parsed.urgency_level) ||
      !parsed.chief_complaint ||
      !Array.isArray(parsed.suggested_questions)
    ) {
      throw new Error('LLM response failed schema validation');
    }
    return {
      urgency_level: parsed.urgency_level as UrgencyLevel,
      chief_complaint: String(parsed.chief_complaint),
      suggested_questions: parsed.suggested_questions.slice(0, 3).map(String),
      status: 'ready',
    };
  } catch (err) {
    const fallback = simulatePreVisit(symptoms);
    return { ...fallback, status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Post-visit summary -------------------------------------------------

const POST_VISIT_SYSTEM = `You are a clinical communication assistant that translates a doctor's notes into a warm,
plain-language summary a patient can understand. Respond with ONLY a JSON object (no prose, no markdown fences)
matching this exact shape:
{"summary": string}
The "summary" should be 3-6 short sentences or short bullet-style lines (use "\\n" for line breaks), written in
plain language, including what was found, the medication schedule if any, and clear follow-up steps. Do not
invent information that is not present in the notes.`;

function buildPostVisitPrompt(notes: string): string {
  return `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}`;
}

function simulatePostVisit(notes: string, prescription: PrescriptionItem[]): PostVisitResult {
  const lines: string[] = [];
  lines.push(`Here's a summary of your visit: ${notes.trim().slice(0, 300)}`);
  if (prescription.length) {
    lines.push('Medication schedule:');
    for (const p of prescription) {
      lines.push(
        `- ${p.drug}${p.dosage ? ` (${p.dosage})` : ''}: ${p.frequency_per_day}x/day for ${p.duration_days} day(s)${
          p.instructions ? ` — ${p.instructions}` : ''
        }`
      );
    }
  } else {
    lines.push('No new medication was prescribed at this visit.');
  }
  lines.push('Please contact the clinic if symptoms worsen or do not improve as expected, or to schedule a follow-up.');
  return { summary_text: lines.join('\n'), status: 'simulated' };
}

export async function generatePostVisitSummary(
  notes: string,
  prescription: PrescriptionItem[]
): Promise<PostVisitResult> {
  if (!apiKey()) {
    return simulatePostVisit(notes, prescription);
  }
  try {
    const notesWithRx = prescription.length
      ? `${notes}\n\nPrescription: ${prescription
          .map((p) => `${p.drug} ${p.dosage ?? ''} - ${p.frequency_per_day}x/day for ${p.duration_days} days`)
          .join('; ')}`
      : notes;
    const raw = await withRetry(() => callAnthropic(POST_VISIT_SYSTEM, buildPostVisitPrompt(notesWithRx)));
    const parsed = extractJson(raw) as { summary?: string };
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      throw new Error('LLM response failed schema validation');
    }
    return { summary_text: parsed.summary, status: 'ready' };
  } catch (err) {
    const fallback = simulatePostVisit(notes, prescription);
    return { ...fallback, status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}
