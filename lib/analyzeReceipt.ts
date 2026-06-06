import type { ReceiptField, ReceiptFieldSize, ReceiptFieldStyle, ReceiptFieldType, ReceiptImage, ReceiptLayout } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';
const DEFAULT_PDF_ENGINE = 'cloudflare-ai';
const OPENROUTER_TIMEOUT_MS = 45_000;

const ANALYSIS_PROMPT = `You are a document layout analyzer. Analyze this receipt template and return ONLY a valid JSON object with no markdown and no explanation. Describe its structure so a developer can rebuild a clearly marked sample template preview in HTML/CSS.

Return this structure:
{
  "title": "receipt heading text",
  "layout": "brief layout description",
  "colors": { "background": "#hex", "text": "#hex", "border": "#hex" },
  "font": { "family": "serif or sans-serif", "headerSize": "24px", "bodySize": "14px" },
  "fields": [
    { "id": "unique_id", "label": "Display Label", "type": "text|date|number|image|tel|email", "position": "top-center|top-left|top-right|left|right|table|footer", "style": "bold|normal|italic", "size": "large|medium|small" }
  ],
  "tables": [
    { "id": "table_id", "position": "middle|bottom", "columns": ["Column1", "Column2"], "rowFields": ["field_id1", "field_id2"] }
  ],
  "images": [
    { "id": "image_id", "type": "logo|passport|signature", "position": "top-center|top-left|left" }
  ],
  "barcode": { "exists": true, "position": "bottom-center", "sourceField": "field_id" },
  "footer": { "exists": true, "text": "static footer text" },
  "sections": [
    { "id": "section_id", "position": "top-center|top-right|left|right|table|footer", "fields": ["field_id1", "field_id2"] }
  ]
}

Detect visible fields, labels, tables, image placeholders, colors, font style, barcode or QR placement, footer text, and structural sections. Do not invent real payment validity or official status.

Your entire response must be one valid JSON object. Do not include prose, headings, markdown fences, comments, or any text outside the JSON object.`;

const ALLOWED_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const MAX_BASE64_LENGTH = 14_000_000;
const FIELD_TYPES = new Set<ReceiptFieldType>(['text', 'date', 'number', 'image', 'tel', 'email']);
const FIELD_STYLES = new Set<ReceiptFieldStyle>(['bold', 'normal', 'italic']);
const FIELD_SIZES = new Set<ReceiptFieldSize>(['large', 'medium', 'small']);

type OpenRouterContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'file'; file: { filename: string; file_data: string } };

interface OpenRouterResponse {
  choices?: {
    message?: {
      content?: string | { type?: string; text?: string }[];
    };
    text?: string;
    error?: { message?: string };
  }[];
  error?: {
    message?: string;
    code?: string | number;
    metadata?: unknown;
  };
}

export async function analyzeReceipt(base64: string, mediaType: string): Promise<ReceiptLayout> {
  if (!base64) {
    throw new Error('Missing file data.');
  }

  if (base64.length > MAX_BASE64_LENGTH) {
    throw new Error('File is too large. Use a template under 10 MB.');
  }

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    throw new Error('Unsupported file type.');
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const isPDF = mediaType === 'application/pdf';
  const content: OpenRouterContent[] = [
    { type: 'text', text: ANALYSIS_PROMPT },
    isPDF
      ? {
          type: 'file',
          file: {
            filename: 'receipt-template.pdf',
            file_data: `data:application/pdf;base64,${base64}`
          }
        }
      : {
          type: 'image_url',
          image_url: {
            url: `data:${mediaType};base64,${base64}`,
            detail: 'high'
          }
        }
  ];
  const plugins = [
    { id: 'response-healing' },
    ...(isPDF
      ? [
          {
            id: 'file-parser',
            pdf: {
              engine: process.env.OPENROUTER_PDF_ENGINE || DEFAULT_PDF_ENGINE
            }
          }
        ]
      : [])
  ];

  const response = await fetchWithTimeout(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-OpenRouter-Title': 'Receipt Template Builder'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content
        }
      ],
      plugins
    })
  });

  const data = await readOpenRouterResponse(response);

  if (!response.ok || data.error) {
    const details = data.error ? ` ${JSON.stringify(data.error).slice(0, 240)}` : '';
    throw new Error(`${data.error?.message || `OpenRouter returned ${response.status}.`}${details}`);
  }

  const raw = extractOpenRouterText(data);

  if (!raw) {
    throw new Error('OpenRouter returned an empty analysis.');
  }

  return normalizeReceiptLayout(parseLayoutJson(raw));
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenRouter timed out. Try a smaller image/PDF or use a faster model.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readOpenRouterResponse(response: Response): Promise<OpenRouterResponse> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as OpenRouterResponse;
  } catch {
    throw new Error(`OpenRouter returned a non-JSON API response: ${text.slice(0, 180)}`);
  }
}

function extractOpenRouterText(data: OpenRouterResponse): string {
  const choice = data.choices?.[0];

  if (choice?.error?.message) {
    throw new Error(choice.error.message);
  }

  if (typeof choice?.message?.content === 'string') {
    return choice.message.content.trim();
  }

  if (Array.isArray(choice?.message?.content)) {
    return choice.message.content
      .map((part) => (part.type === 'text' && typeof part.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }

  return choice?.text?.trim() || '';
}

function parseLayoutJson(raw: string): unknown {
  const clean = raw.replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }

    throw new Error(`OpenRouter model did not return layout JSON. Raw response started with: ${clean.slice(0, 180)}`);
  }
}

function normalizeReceiptLayout(raw: unknown): ReceiptLayout {
  const input = isRecord(raw) ? raw : {};
  const colors = isRecord(input.colors) ? input.colors : {};
  const font = isRecord(input.font) ? input.font : {};
  const barcode = isRecord(input.barcode) ? input.barcode : {};
  const footer = isRecord(input.footer) ? input.footer : {};

  return {
    title: stringOr(input.title, 'Receipt Template'),
    layout: stringOr(input.layout, ''),
    colors: {
      background: safeColor(colors.background, '#ffffff'),
      text: safeColor(colors.text, '#111827'),
      border: safeColor(colors.border, '#d1d5db')
    },
    font: {
      family: fontFamily(stringOr(font.family, 'sans-serif')),
      headerSize: cssSize(font.headerSize, '28px'),
      bodySize: cssSize(font.bodySize, '14px')
    },
    fields: asArray(input.fields).map(normalizeField).filter(Boolean) as ReceiptField[],
    tables: asArray(input.tables).map((table, index) => {
      const item = isRecord(table) ? table : {};
      return {
        id: slug(stringOr(item.id, `table_${index + 1}`)),
        position: stringOr(item.position, 'table'),
        columns: asArray(item.columns).map((column) => stringOr(column, '')).filter(Boolean),
        rowFields: asArray(item.rowFields).map((field) => slug(String(field))).filter(Boolean)
      };
    }),
    images: asArray(input.images).map((image, index) => {
      const item = isRecord(image) ? image : {};
      const rawType = stringOr(item.type, 'logo');
      const type: ReceiptImage['type'] = rawType === 'passport' || rawType === 'signature' ? rawType : 'logo';
      return {
        id: slug(stringOr(item.id, `${type}_${index + 1}`)),
        type,
        position: stringOr(item.position, 'top-center')
      };
    }),
    barcode: {
      exists: Boolean(barcode.exists),
      position: stringOr(barcode.position, 'bottom-center'),
      sourceField: slugOrEmpty(stringOr(barcode.sourceField, ''))
    },
    footer: {
      exists: Boolean(footer.exists),
      text: stringOr(footer.text, '')
    },
    sections: asArray(input.sections).map((section, index) => {
      const item = isRecord(section) ? section : {};
      return {
        id: slug(stringOr(item.id, `section_${index + 1}`)),
        position: stringOr(item.position, 'left'),
        fields: asArray(item.fields).map((field) => slug(String(field))).filter(Boolean)
      };
    })
  };
}

function normalizeField(field: unknown, index: number): ReceiptField | null {
  if (!isRecord(field)) return null;

  const label = stringOr(field.label, stringOr(field.id, `Field ${index + 1}`));
  const type = FIELD_TYPES.has(field.type as ReceiptFieldType) ? (field.type as ReceiptFieldType) : 'text';
  const style = FIELD_STYLES.has(field.style as ReceiptFieldStyle) ? (field.style as ReceiptFieldStyle) : 'normal';
  const size = FIELD_SIZES.has(field.size as ReceiptFieldSize) ? (field.size as ReceiptFieldSize) : 'medium';

  return {
    id: slug(stringOr(field.id, label)),
    label,
    type,
    position: stringOr(field.position, 'left'),
    style,
    size
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeColor(value: unknown, fallback: string): string {
  const color = stringOr(value, '');
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) return color;
  if (/^(rgb|hsl)a?\(/i.test(color)) return color;
  if (/^[a-z]+$/i.test(color)) return color;
  return fallback;
}

function cssSize(value: unknown, fallback: string): string {
  if (typeof value === 'number') return `${value}px`;
  const size = stringOr(value, '');
  if (/^\d+(\.\d+)?(px|rem|em|pt)$/i.test(size)) return size;
  if (/^\d+(\.\d+)?$/i.test(size)) return `${size}px`;
  return fallback;
}

function fontFamily(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('serif') && !normalized.includes('sans')) return 'Georgia, "Times New Roman", serif';
  if (normalized.includes('mono')) return 'Consolas, "Courier New", monospace';
  return 'Arial, Helvetica, sans-serif';
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field'
  );
}

function slugOrEmpty(value: string): string {
  const trimmed = value.trim();
  return trimmed ? slug(trimmed) : '';
}
