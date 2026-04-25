'use client'
import { useState, useEffect, useRef } from 'react'
import type { GovernmentResource } from '@/types'
import { getResources, createResource, uploadResourceDocument } from '@/lib/api'

interface FormState {
  name: string
  description: string
  agencyName: string
  contactUrl: string
}

function CardUploader({ rid }: { rid: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    setStatus('idle')
    try {
      for (const file of files) {
        await uploadResourceDocument(rid, file)
      }
      setStatus('ok')
    } catch {
      setStatus('err')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{
        fontSize: 12,
        color: 'var(--primary)',
        cursor: uploading ? 'not-allowed' : 'pointer',
        borderBottom: '1px dashed var(--primary)',
      }}>
        {uploading ? '上傳中...' : '+ 上傳文件'}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.md,.txt,.html,.csv,.xlsx"
          style={{ display: 'none' }}
          disabled={uploading}
          onChange={handleChange}
        />
      </label>
      {status === 'ok' && <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ 已上傳</span>}
      {status === 'err' && <span style={{ fontSize: 11, color: 'var(--danger)' }}>上傳失敗</span>}
    </div>
  )
}

export default function ResourcesClient({ initialResources }: { initialResources: GovernmentResource[] }) {
  const [resources, setResources] = useState<GovernmentResource[]>(initialResources)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>({ name: '', description: '', agencyName: '', contactUrl: '' })
  const [criteriaInput, setCriteriaInput] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getResources().then(setResources).catch(() => {})
  }, [])

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingFiles(Array.from(e.target.files ?? []))
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.description.trim()) return
    setSubmitting(true)
    try {
      const eligibilityCriteria = criteriaInput.split('\n').map((s) => s.trim()).filter(Boolean)
      const created = await createResource({ ...form, eligibilityCriteria })
      for (const file of pendingFiles) {
        await uploadResourceDocument(created.rid, file)
      }
      const updated = await getResources()
      setResources(updated)
      setShowForm(false)
      setForm({ name: '', description: '', agencyName: '', contactUrl: '' })
      setCriteriaInput('')
      setPendingFiles([])
    } catch (e) {
      console.log(e)
      alert('建立資源失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>資源管理</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>管理政府資源與申請資格</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius)',
            background: showForm ? 'var(--surface)' : 'var(--primary)',
            color: showForm ? 'var(--text)' : '#fff',
            border: showForm ? '1px solid var(--border)' : 'none',
            fontSize: 14,
          }}
        >
          {showForm ? '取消' : '+ 新增資源'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 24,
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>新增政府資源</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {[
              { label: '資源名稱 *', key: 'name' as const, placeholder: '青年就業促進計畫' },
              { label: '機關名稱', key: 'agencyName' as const, placeholder: '臺北市青年局' },
              { label: '聯絡 URL', key: 'contactUrl' as const, placeholder: 'https://...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  {label}
                </label>
                <input
                  value={form[key]}
                  onChange={setField(key)}
                  placeholder={placeholder}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg)',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              描述 *
            </label>
            <textarea
              value={form.description}
              onChange={setField('description')}
              rows={3}
              placeholder="提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg)',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              申請資格（每行一條）
            </label>
            <textarea
              value={criteriaInput}
              onChange={(e) => setCriteriaInput(e.target.value)}
              rows={4}
              placeholder={'年齡 18–29 歲\n具中華民國國籍\n非在學中'}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg)',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              附件文件（可多選）
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.md,.txt,.html,.csv,.xlsx"
              onChange={handleFileChange}
              style={{ fontSize: 13 }}
            />
            {pendingFiles.length > 0 && (
              <ul style={{ marginTop: 6, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                {pendingFiles.map((f) => <li key={f.name}>{f.name}</li>)}
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.name.trim() || !form.description.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: submitting ? '#9ca3af' : 'var(--primary)',
                color: '#fff',
              }}
            >
              {submitting ? '建立中...' : '建立資源'}
            </button>
          </div>
        </div>
      )}

      {/* Resource grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
        {resources.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', padding: '32px 0' }}>
            尚無資源，請新增第一筆政府資源
          </p>
        )}
        {resources.map((r) => (
          <div key={r.rid} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{r.name}</h3>
            {r.agencyName && (
              <p style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 10 }}>{r.agencyName}</p>
            )}
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, flex: 1 }}>
              {r.description}
            </p>
            {r.eligibilityCriteria && r.eligibilityCriteria.length > 0 && (
              <ul style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 16, marginBottom: 12 }}>
                {r.eligibilityCriteria.slice(0, 4).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
                {r.eligibilityCriteria.length > 4 && (
                  <li style={{ listStyle: 'none', paddingLeft: 0, marginTop: 2 }}>
                    ...共 {r.eligibilityCriteria.length} 項資格
                  </li>
                )}
              </ul>
            )}
            {r.contactUrl && (
              <a
                href={r.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--primary)' }}
              >
                官方網站 →
              </a>
            )}
            <CardUploader rid={r.rid} />
          </div>
        ))}
      </div>
    </div>
  )
}
