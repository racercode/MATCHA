import { PDFParse } from 'pdf-parse'
import * as XLSX from 'xlsx'
import type { GovernmentResourceDocumentKind } from '@matcha/shared-types'

export function inferDocumentKind(filename = '', mimeType = ''): GovernmentResourceDocumentKind {
  const lowerName = filename.toLowerCase()
  const lowerMime = mimeType.toLowerCase()

  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf'
  if (lowerMime.includes('markdown') || lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) return 'markdown'
  if (lowerMime.includes('html') || lowerName.endsWith('.html') || lowerName.endsWith('.htm')) return 'html'
  if (lowerMime.includes('csv') || lowerName.endsWith('.csv')) return 'csv'
  if (
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls')
  ) {
    return 'xlsx'
  }
  if (lowerMime.startsWith('text/') || lowerName.endsWith('.txt')) return 'txt'
  return 'other'
}

export function normalizeDocumentKind(value: unknown, filename = '', mimeType = ''): GovernmentResourceDocumentKind {
  if (
    value === 'pdf' ||
    value === 'markdown' ||
    value === 'txt' ||
    value === 'html' ||
    value === 'csv' ||
    value === 'xlsx' ||
    value === 'url' ||
    value === 'other'
  ) {
    return value
  }

  return inferDocumentKind(filename, mimeType)
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')

  return normalizeWhitespace(
    withoutScripts
      .replace(/<\/(p|div|section|article|header|footer|li|ul|ol|h[1-6]|tr|table)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'"),
  )
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })

  try {
    const result = await parser.getText()
    return normalizeWhitespace(result.text)
  } finally {
    await parser.destroy()
  }
}

function parseSpreadsheet(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sections = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    return [`# Sheet: ${sheetName}`, csv.trim()].filter(Boolean).join('\n')
  })

  return normalizeWhitespace(sections.join('\n\n'))
}

export async function extractTextFromUploadedFile(file: Express.Multer.File): Promise<string> {
  const kind = inferDocumentKind(file.originalname, file.mimetype)

  if (kind === 'pdf') {
    return parsePdf(file.buffer)
  }

  const rawText = file.buffer.toString('utf8')
  if (kind === 'html') return stripHtml(rawText)
  if (kind === 'xlsx') return parseSpreadsheet(file.buffer)

  return normalizeWhitespace(rawText)
}
