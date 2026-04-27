'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { PassagemPlantao, PostoEnfermagem, POSTO_LABELS, PERMISSIONS } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'9px 16px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' },
  select: { padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit' },
  label: { fontSize:'12px', fontWeight:500 as const, color:'#5c5850', display:'block' as const, marginBottom:'5px' },
}

export default function PassagemPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [passagens, setPassagens] = useState<PassagemPlantao[]>([])
  const [filterPosto, setFilterPosto] = useState<PostoEnfermagem | 'todos'>('todos')
  const [filterData, setFilterData] = useState(new Date().toISOString().split('T')[0])
  const [generating, setGenerating] = useState(false)
  const [turnoGerar, setTurnoGerar] = useState<'diurno'|'noturno'>('diurno')
  const [postoGerar, setPostoGerar] = useState<PostoEnfermagem | 'todos'>('todos')
  const [selected, setSelected] = useState<PassagemPlantao | null>(null)
  const [msg, setMsg] = useState('')

  const postoFiltro = profile?.role === 'cuidador' ? profile.posto : undefined
  const canGenerate = profile && PERMISSIONS.canGeneratePassagem(profile.role)

  async function load() {
    let q = supabase.from('passagens_plantao').select('*').eq('data', filterData).order('gerado_em', { ascending: false })
    if (postoFiltro) q = q.or(`posto.eq.${postoFiltro},posto.is.null`)
    else if (filterPosto !== 'todos') q = q.eq('posto', filterPosto)
    const { data } = await q
    setPassagens(data || [])
  }

  useEffect(() => { load() }, [filterData, filterPosto])

  async function gerarPassagem() {
    setGenerating(true)
    setMsg('')
    try {
      const res = await fetch('/api/passagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: filterData,
          turno: turnoGerar,
          posto: postoGerar !== 'todos' ? postoGerar : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg('Passagem gerada com sucesso!')
      load()
      if (json.passagem) setSelected(json.passagem)
    } catch (e: any) {
      setMsg('Erro ao gerar passagem: ' + e.message)
    }
    setGenerating(false)
    setTimeout(() => setMsg(''), 4000)
  }

  async function receberPassagem(id: string) {
    await supabase.from('passagens_plantao').update({
      recebido_por: profile?.id,
      recebido_em: new Date().toISOString(),
    }).eq('id', id)
    load()
  }

  return (
    <div>
      {msg && (
        <div style={{
          background: msg.includes('Erro') ? '#fee2e2' : '#d8f3dc',
          color: msg.includes('Erro') ? '#991b1b' : '#2d6a4f',
          padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px'
        }}>{msg}</div>
      )}

      {/* Gerar passagem */}
      {canGenerate && (
        <div style={{...S.card, marginBottom:'16px'}}>
          <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0', display:'flex', alignItems:'center', gap:'10px'}}>
            Gerar Passagem de Plantão
            <span style={{fontSize:'11px', background:'#ede9fe', color:'#5b21b6', padding:'3px 10px', borderRadius:'20px', fontWeight:500}}>✦ IA</span>
          </div>
          <div style={{display:'flex', gap:'16px', alignItems:'flex-end', flexWrap:'wrap' as const}}>
            <div>
              <label style={S.label}>Data</label>
              <input type="date" defaultValue={filterData}
                onChange={e => setFilterData(e.target.value)}
                style={{...S.select, padding:'9px 12px'}}/>
            </div>
            <div>
              <label style={S.label}>Turno que passa</label>
              <select value={turnoGerar} onChange={e => setTurnoGerar(e.target.value as any)} style={S.select}>
                <option value="diurno">☀️ Diurno (07h–19h)</option>
                <option value="noturno">🌙 Noturno (19h–07h)</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Posto</label>
              <select value={postoGerar} onChange={e => setPostoGerar(e.target.value as any)} style={S.select}>
                <option value="todos">Todos os postos</option>
                <option value="posto_1">Posto 1</option>
                <option value="posto_2">Posto 2</option>
                <option value="posto_3">Posto 3</option>
              </select>
            </div>
            <button onClick={gerarPassagem} disabled={generating} style={S.btn()}>
              {generating ? '⏳ Gerando com IA...' : '✦ Gerar Automaticamente'}
            </button>
          </div>
          <div style={{marginTop:'12px', fontSize:'12px', color:'#9a9588'}}>
            A IA analisa todas as evoluções preenchidas no turno e gera um relatório profissional de passagem de plantão.
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{...S.card, marginBottom:'16px', display:'flex', gap:'16px', alignItems:'flex-end'}}>
        <div>
          <label style={S.label}>Data</label>
          <input type="date" value={filterData} onChange={e => setFilterData(e.target.value)} style={{...S.select, padding:'9px 12px'}}/>
        </div>
        {profile?.role !== 'cuidador' && (
          <div>
            <label style={S.label}>Posto</label>
            <select value={filterPosto} onChange={e => setFilterPosto(e.target.value as any)} style={S.select}>
              <option value="todos">Todos</option>
              <option value="posto_1">Posto 1</option>
              <option value="posto_2">Posto 2</option>
              <option value="posto_3">Posto 3</option>
            </select>
          </div>
        )}
        <button onClick={load} style={S.btnSec}>Filtrar</button>
      </div>

      {/* Lista de passagens */}
      <div style={{display:'grid', gap:'16px'}}>
        {passagens.length === 0 && (
          <div style={{...S.card, textAlign:'center' as const, color:'#9a9588', padding:'40px'}}>
            Nenhuma passagem de plantão para este dia.
            {canGenerate && <div style={{marginTop:'8px', fontSize:'12px'}}>Use o botão acima para gerar automaticamente.</div>}
          </div>
        )}
        {passagens.map(p => (
          <div key={p.id} style={S.card}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
              <div>
                <div style={{fontWeight:600, fontSize:'14px'}}>
                  {p.turno === 'diurno' ? '☀️ Diurno' : '🌙 Noturno'} — {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  {p.posto && <span style={{marginLeft:'8px', fontSize:'12px', background:'#d8f3dc', color:'#2d6a4f', padding:'2px 8px', borderRadius:'20px', fontWeight:500}}>{POSTO_LABELS[p.posto]}</span>}
                </div>
                <div style={{fontSize:'12px', color:'#9a9588', marginTop:'3px'}}>
                  Gerado em {new Date(p.gerado_em).toLocaleString('pt-BR')}
                  {p.recebido_em && (
                    <span style={{marginLeft:'12px', color:'#2d6a4f'}}>✅ Recebido em {new Date(p.recebido_em).toLocaleString('pt-BR')}</span>
                  )}
                </div>
              </div>
              <div style={{display:'flex', gap:'8px'}}>
                {!p.recebido_em && (
                  <button onClick={() => receberPassagem(p.id)} style={S.btn('#1d4e89')}>
                    ✅ Confirmar Recebimento
                  </button>
                )}
                <button onClick={() => setSelected(selected?.id === p.id ? null : p)} style={S.btnSec}>
                  {selected?.id === p.id ? 'Fechar' : 'Ver Relatório'}
                </button>
                <button onClick={() => window.print()} style={S.btnSec}>🖨️</button>
              </div>
            </div>

            {selected?.id === p.id && (
              <div style={{
                background:'#f7f5f0', border:'1px solid #e0dbd0', borderRadius:'10px',
                padding:'20px', fontSize:'13px', lineHeight:'1.8', whiteSpace:'pre-wrap' as const,
                fontFamily:'inherit', color:'#1a1814'
              }}>
                {p.texto_gerado}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
