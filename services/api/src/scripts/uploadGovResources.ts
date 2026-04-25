import 'dotenv/config'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), '../../data/resources')
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000'
const AUTH_TOKEN = process.env.GOV_AUTH_TOKEN ?? 'gov001'

const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.md', '.markdown', '.txt', '.html', '.htm', '.csv', '.xlsx', '.xls'])

interface ResourceJson {
  rid?: string
  agencyId?: string
  agencyName?: string
  name: string
  description: string
  eligibilityCriteria: string[]
  contactUrl?: string
}

function inferKind(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (ext === '.md' || ext === '.markdown') return 'markdown'
  if (ext === '.html' || ext === '.htm') return 'html'
  if (ext === '.csv') return 'csv'
  if (ext === '.xlsx' || ext === '.xls') return 'xlsx'
  if (ext === '.txt') return 'txt'
  return 'other'
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      ...init.headers,
    },
  })
  const payload = await response.json() as { success: boolean; data?: T; error?: string }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? `Request failed: ${response.status} ${response.statusText}`)
  }

  return payload.data as T
}

async function uploadResource(resourceDir: string): Promise<void> {
  const dirName = path.basename(resourceDir)
  const resourceJsonPath = path.join(resourceDir, 'resource.json')
  const resource = JSON.parse(await readFile(resourceJsonPath, 'utf8')) as ResourceJson
  const rid = resource.rid ?? dirName

  console.log(`[resource] ${rid}`)
  await requestJson(`${API_BASE_URL}/gov/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...resource, rid }),
  })

  const entries = await readdir(resourceDir)
  for (const entry of entries) {
    if (entry === 'resource.json') continue
    if (!DOCUMENT_EXTENSIONS.has(path.extname(entry).toLowerCase())) continue

    const filePath = path.join(resourceDir, entry)
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) continue

    const bytes = await readFile(filePath)
    const form = new FormData()
    form.append('kind', inferKind(entry))
    form.append('file', new Blob([bytes]), entry)

    console.log(`  [document] ${entry}`)
    await requestJson(`${API_BASE_URL}/gov/resources/${encodeURIComponent(rid)}/documents`, {
      method: 'POST',
      body: form,
    })
  }
}

async function main() {
  const dataDir = path.resolve(process.argv[2] ?? DEFAULT_DATA_DIR)
  const entries = await readdir(dataDir)

  for (const entry of entries) {
    const resourceDir = path.join(dataDir, entry)
    const resourceStat = await stat(resourceDir)
    if (resourceStat.isDirectory()) {
      await uploadResource(resourceDir)
    }
  }
}

await main()
