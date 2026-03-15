'use client'

import { useState, useCallback } from 'react'

type LineItem = {
  description: string
  quantity: number | null
  unit: string | null
  unit_value: number | null
  total_value: number | null
  country_of_origin: string | null
}

type ExtractedData = {
  importer_name: string | null
  importer_address: string | null
  supplier_name: string | null
  supplier_country: string | null
  country_of_origin: string | null
  invoice_number: string | null
  invoice_date: string | null
  invoice_value: number | null
  currency: string | null
  incoterms: string | null
  line_items: LineItem[]
  missing_fields: string[]
}

type Flag = {
  type: 'section_301' | 'ad_cvd' | 'fda' | 'usda' | 'usmca' | 'info'
  message: string
}

type AlternativeCode = {
  hts_code: string
  reason: string
}

type Classification = {
  item_number: number
  description: string
  hts_code: string
  hts_description: string
  confidence: number
  duty_rate: string
  reasoning: string
  flags: Flag[]
  alternative_codes: AlternativeCode[]
}

type Stage = 'idle' | 'uploading' | 'extracting' | 'classifying' | 'done' | 'error'

const FLAG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  section_301: { bg: '#FEF2F2', text: '#DC2626', label: 'Section 301' },
  ad_cvd:      { bg: '#FFF7ED', text: '#EA580C', label: 'AD/CVD' },
  fda:         { bg: '#EFF6FF', text: '#2563EB', label: 'FDA' },
  usda:        { bg: '#F0FDF4', text: '#16A34A', label: 'USDA' },
  usmca:       { bg: '#F5F3FF', text: '#7C3AED', label: 'USMCA' },
  info:        { bg: '#F8FAFC', text: '#64748B', label: 'Info' },
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 90 ? '#16A34A' : score >= 70 ? '#D97706' : '#DC2626'
  const label = score >= 90 ? 'High confidence' : score >= 70 ? 'Review recommended' : 'Escalate to senior broker'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono, monospace)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{score}%</span>
      </div>
      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99 }}>
        <div style={{ height: 6, width: `${score}%`, background: color, borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
    </div>
  )
}

function PipelineStep({ label, status }: { label: string; status: 'pending' | 'active' | 'done' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: status === 'done' ? '#0F172A' : status === 'active' ? '#3B82F6' : '#E2E8F0',
        transition: 'background 0.3s'
      }}>
        {status === 'done' && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
        {status === 'active' && (
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: '#fff',
            animation: 'spin 0.8s linear infinite'
          }} />
        )}
      </div>
      <span style={{
        fontSize: 13, fontWeight: status === 'active' ? 600 : 400,
        color: status === 'pending' ? '#94A3B8' : status === 'active' ? '#1E40AF' : '#0F172A',
        transition: 'color 0.3s'
      }}>{label}</span>
    </div>
  )
}

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      setStage('error')
      return
    }

    setFileName(file.name)
    setError('')
    setStage('uploading')

    try {
      // Stage 1: Extract
      setStage('extracting')
      const formData = new FormData()
      formData.append('file', file)

      const extractRes = await fetch('/api/extract', { method: 'POST', body: formData })
      if (!extractRes.ok) throw new Error('Extraction failed')
      const extractedData: ExtractedData = await extractRes.json()
      setExtracted(extractedData)

      // Stage 2: Classify
      setStage('classifying')
      const classifyRes = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_items: extractedData.line_items,
          supplier_country: extractedData.supplier_country || extractedData.country_of_origin,
        }),
      })
      if (!classifyRes.ok) throw new Error('Classification failed')
      const classifyData = await classifyRes.json()
      setClassifications(classifyData.classifications)
      setStage('done')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Check your API key and try again.')
      setStage('error')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const reset = () => {
    setStage('idle')
    setExtracted(null)
    setClassifications([])
    setFileName('')
    setError('')
  }

  const getStepStatus = (step: 'upload' | 'extract' | 'classify') => {
    const order = ['upload', 'extract', 'classify']
    const stageOrder: Record<Stage, number> = { idle: -1, uploading: 0, extracting: 1, classifying: 2, done: 3, error: -1 }
    const stepIdx = order.indexOf(step)
    const currentIdx = stageOrder[stage]
    if (currentIdx > stepIdx) return 'done'
    if (currentIdx === stepIdx) return 'active'
    return 'pending'
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F8F7F4; font-family: 'DM Sans', sans-serif; color: #0F172A; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .field-row { display: flex; justify-content: space-between; align-items: baseline; padding: 9px 0; border-bottom: 1px solid #F1F5F9; }
        .field-row:last-child { border-bottom: none; }
        .hts-card { background: #fff; border-radius: 12px; border: 1px solid #E2E8F0; padding: 20px; margin-bottom: 16px; animation: fadeUp 0.4s ease forwards; }
        .flag-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; margin-right: 6px; margin-bottom: 4px; }
        .alt-code { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; font-size: 12px; }
        input[type=file] { display: none; }
      `}</style>

      {/* Header */}
      <div style={{ background: '#0F172A', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, background: '#3B82F6', borderRadius: '50%' }} />
          <span style={{ color: '#fff', fontFamily: 'DM Serif Display, serif', fontSize: 18, letterSpacing: '-0.01em' }}>Portsights</span>
          <span style={{ color: '#475569', fontSize: 12, marginLeft: 4, fontFamily: 'DM Mono, monospace' }}>AI Enhanced Customs Brokerage Intelligence</span>
        </div>
        {stage === 'done' && (
          <button onClick={reset} style={{ background: 'transparent', border: '1px solid #334155', color: '#94A3B8', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            New Entry
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* Idle: Upload */}
        {stage === 'idle' && (
          <div className="fade-up">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 42, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 12 }}>
                Customs data entry,<br />automated.
              </h1>
              <p style={{ color: '#64748B', fontSize: 16, maxWidth: 460, margin: '0 auto' }}>
                Upload a commercial invoice. AI extracts fields, classifies HTS codes, and flags compliance risks in seconds.
              </p>
            </div>

            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              htmlFor="file-upload"
              style={{
                display: 'block', maxWidth: 520, margin: '0 auto',
                border: `2px dashed ${dragOver ? '#3B82F6' : '#CBD5E1'}`,
                borderRadius: 16, padding: '60px 32px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                background: dragOver ? '#EFF6FF' : '#fff',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
              <p style={{ fontWeight: 500, marginBottom: 6 }}>Upload commercial invoice here</p>
              <p style={{ fontSize: 13, color: '#94A3B8' }}>PDF format · Up to 10MB</p>
              <div style={{ marginTop: 20, display: 'inline-block', background: '#0F172A', color: '#fff', padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                Browse files
              </div>
              <input id="file-upload" type="file" accept=".pdf" onChange={handleFileInput} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 48 }}>
              {['Field extraction', 'HTS classification', 'Compliance flags'].map(f => (
                <div key={f} style={{ textAlign: 'center' }}>
                  <div style={{ width: 8, height: 8, background: '#3B82F6', borderRadius: '50%', margin: '0 auto 8px' }} />
                  <span style={{ fontSize: 12, color: '#64748B' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing */}
        {(stage === 'uploading' || stage === 'extracting' || stage === 'classifying') && (
          <div className="fade-up" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#64748B', marginBottom: 8 }}>Processing</p>
            <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 26, fontWeight: 400, marginBottom: 4 }}>{fileName}</h2>
            <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 40 }}>This takes 15–30 seconds</p>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '24px 28px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <PipelineStep label="Uploading document" status={getStepStatus('upload')} />
              <PipelineStep label="Extracting invoice fields with Claude" status={getStepStatus('extract')} />
              <PipelineStep label="Classifying HTS codes + compliance check" status={getStepStatus('classify')} />
            </div>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="fade-up" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 24 }}>
              <p style={{ color: '#DC2626', fontWeight: 500, marginBottom: 8 }}>Something went wrong</p>
              <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>{error}</p>
              <button onClick={reset} style={{ background: '#0F172A', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Try again</button>
            </div>
          </div>
        )}

        {/* Results */}
        {stage === 'done' && extracted && (
          <div className="fade-up">
            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              {[
                { label: 'Line items', value: extracted.line_items.length },
                { label: 'Invoice value', value: extracted.invoice_value ? `${extracted.currency || ''} ${extracted.invoice_value.toLocaleString()}` : '—' },
                { label: 'Missing fields', value: extracted.missing_fields.length, warn: extracted.missing_fields.length > 0 },
                { label: 'Compliance flags', value: classifications.reduce((acc, c) => acc + (c.flags?.length || 0), 0), warn: classifications.some(c => c.flags?.some(f => f.type === 'section_301' || f.type === 'ad_cvd')) },
              ].map(stat => (
                <div key={stat.label} style={{ flex: 1, minWidth: 140, background: '#fff', border: `1px solid ${stat.warn ? '#FED7AA' : '#E2E8F0'}`, borderRadius: 10, padding: '14px 18px' }}>
                  <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
                  <p style={{ fontSize: 22, fontFamily: 'DM Serif Display, serif', color: stat.warn ? '#EA580C' : '#0F172A' }}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
              {/* Left: Invoice Fields */}
              <div>
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 6, height: 6, background: '#0F172A', borderRadius: '50%' }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Invoice Fields</span>
                    {extracted.missing_fields.length > 0 && (
                      <span style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, marginLeft: 'auto' }}>
                        {extracted.missing_fields.length} missing
                      </span>
                    )}
                  </div>
                  {[
                    ['Invoice #', extracted.invoice_number],
                    ['Date', extracted.invoice_date],
                    ['Importer', extracted.importer_name],
                    ['Supplier', extracted.supplier_name],
                    ['Origin country', extracted.country_of_origin],
                    ['Supplier country', extracted.supplier_country],
                    ['Value', extracted.invoice_value ? `${extracted.currency} ${extracted.invoice_value.toLocaleString()}` : null],
                    ['Incoterms', extracted.incoterms],
                  ].map(([label, value]) => (
                    <div key={label as string} className="field-row">
                      <span style={{ fontSize: 12, color: '#64748B' }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: value ? '#0F172A' : '#EF4444', fontFamily: value ? 'inherit' : 'DM Mono, monospace' }}>
                        {value || 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>

                {extracted.missing_fields.length > 0 && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', marginBottom: 8 }}>Missing required fields</p>
                    {extracted.missing_fields.map(f => (
                      <div key={f} style={{ fontSize: 12, color: '#64748B', padding: '3px 0' }}>· {f}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Classifications */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, background: '#0F172A', borderRadius: '50%' }} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>HTS Code Classification</span>
                  <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>Broker review required before filing</span>
                </div>
                {classifications.map((c, i) => (
                  <div key={i} className="hts-card" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 3 }}>{c.description}</p>
                        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 500, letterSpacing: '0.04em', color: '#0F172A' }}>{c.hts_code}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{c.hts_description}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 11, color: '#94A3B8' }}>Duty rate</p>
                        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 600, color: '#0F172A' }}>{c.duty_rate}</p>
                      </div>
                    </div>

                    <ConfidenceBar score={c.confidence} />

                    <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, margin: '12px 0 10px', padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, borderLeft: '3px solid #E2E8F0' }}>
                      {c.reasoning}
                    </p>

                    {c.flags && c.flags.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        {c.flags.map((flag, fi) => {
                          const style = FLAG_STYLES[flag.type] || FLAG_STYLES.info
                          return (
                            <div key={fi} style={{ marginBottom: 6 }}>
                              <span className="flag-badge" style={{ background: style.bg, color: style.text }}>{style.label}</span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>{flag.message}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {c.alternative_codes && c.alternative_codes.length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11, color: '#94A3B8', cursor: 'pointer', userSelect: 'none' }}>
                          {c.alternative_codes.length} alternative code{c.alternative_codes.length > 1 ? 's' : ''}
                        </summary>
                        <div style={{ marginTop: 8 }}>
                          {c.alternative_codes.map((alt, ai) => (
                            <div key={ai} className="alt-code">
                              <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 500, color: '#0F172A' }}>{alt.hts_code}</span>
                              <span style={{ color: '#64748B', marginLeft: 8 }}>{alt.reason}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
