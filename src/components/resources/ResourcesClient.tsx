'use client'
import { useState } from 'react'
import type { GovernmentResource } from '@/types'
import { createResource } from '@/lib/api'

function ResourceCard({ r }: { r: GovernmentResource }) {
  return (
    <div style={{ background: 'var(--surface-0)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{r.name}</div>
          <div style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--matcha-light)', color: 'var(--matcha-dark)', fontWeight: 500 }}>
            {r.agencyName || r.agencyId}
          </div>
        </div>
        {r.contactUrl && (
          <button
            onClick={() => {
              const url = r.contactUrl?.startsWith('http') ? r.contactUrl : `https://${r.contactUrl}`
              window.open(url, '_blank')
            }}
            style={{ fontSize: 12, color: 'var(--blue-text)', border: '0.5px solid var(--blue-bg)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', flexShrink: 0, cursor: 'pointer', background: 'transparent' }}
          >
            官網 ↗
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 12 }}>{r.description}</p>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5 }}>資格條件</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {r.eligibilityCriteria.map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--matcha)', marginTop: 1, flexShrink: 0 }}>✓</span>
              <span style={{ color: 'var(--text-secondary)' }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {r.tags.map(tag => (
          <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', border: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

const BLANK = { agencyId: '', agencyName: '', name: '', description: '', eligibilityCriteria: '', tags: '', contactUrl: '' }

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13,
  border: '0.5px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-1)',
  color: 'var(--text-primary)',
  outline: 'none', width: '100%',
}

export default function ResourcesClient({ initialResources }: { initialResources: GovernmentResource[] }) {
  const [resources, setResources] = useState(initialResources)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function field(key: keyof typeof BLANK) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  async function handleSubmit() {
    if (!form.name || !form.agencyId || !form.description) {
      setError('請填寫必填欄位（機關代碼、名稱、描述）')
      return
    }
    setSaving(true)
    setError('')
    try {
      const r = await createResource({
        agencyId: form.agencyId,
        agencyName: form.agencyName || form.agencyId,
        name: form.name,
        description: form.description,
        eligibilityCriteria: form.eligibilityCriteria.split('\n').map(s => s.trim()).filter(Boolean),
        tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
        contactUrl: form.contactUrl || undefined,
      })
      setResources(prev => [r, ...prev])
      setForm(BLANK)
      setShowForm(false)
    } catch {
      setError('新增失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>資源管理</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>管理機關提供的服務資源，供 Gov Agent 媒合使用</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius-md)', background: showForm ? 'var(--surface-2)' : 'var(--matcha)', color: showForm ? 'var(--text-secondary)' : '#fff', border: 'none', cursor: 'pointer' }}>
          {showForm ? '取消' : '+ 新增資源'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface-0)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 20 }}>新增政府資源</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>機關代碼 * <span style={{ opacity: 0.6 }}>(agencyId)</span></span>
              <input type="text" placeholder="例：labor-dept" {...field('agencyId')} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>機關名稱 (agencyName)</span>
              <input type="text" placeholder="例：勞動部" {...field('agencyName')} style={inputStyle} />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>資源名稱 *</span>
            <input type="text" placeholder="例：低收入戶租屋補貼計畫" {...field('name')} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>資源描述 *</span>
            <textarea placeholder="詳細說明此資源的內容與補助方式..." {...field('description')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>資格條件（每行一條）</span>
            <textarea placeholder={'月收入低於25,000元'} {...field('eligibilityCriteria')} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>標籤（逗號分隔）</span>
              <input type="text" placeholder="租屋補助, 低收入戶" {...field('tags')} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>官網 URL</span>
              <input type="url" placeholder="https://social.kcg.gov.tw" {...field('contactUrl')} style={inputStyle} />
            </label>
          </div>
          {error && (
            <div style={{ fontSize: 12, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setForm(BLANK); setError('') }} style={{ padding: '8px 18px', fontSize: 13, borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-secondary)', border: '0.5px solid var(--border)', cursor: 'pointer' }}>
              取消
            </button>
            <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius-md)', background: 'var(--matcha)', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? '新增中...' : '新增資源'}
            </button>
          </div>
        </div>
      )}

      {resources.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 40 }}>
          尚無資源，點右上角新增
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        {resources.map(r => <ResourceCard key={r.rid} r={r} />)}
      </div>
    </div>
  )
}
