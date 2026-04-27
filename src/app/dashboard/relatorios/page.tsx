'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { Residente } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit', display:'inline-flex' as const, alignItems:'center' as const, gap:'6px' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit', display:'inline-flex' as const, alignItems:'center' as const, gap:'6px' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'90px' },
  aiBadge: { display:'inline-flex' as const, alignItems:'center' as const, gap:'4px', background:'#ede9fe', color:'#5b21b6', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 as const },
}

type SubTab = 'pai' | 'pia' | 'lista'

export default function RelatoriosPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [subTab, setSubTab] = useState<SubTab>('lista')
  const [residentes, setResidentes] = useState<Residente[]>([])
  const [pais, setPais] = useState<any[]>([])
  const [pias, setPias] = useState<any[]>([])

  // PAI form
  const [paiForm, setPaiForm] = useState({ residente_id:'', data_inicio: new Date().toISOString().split('T')[0], data_validade:'', diagnosticos:'', objetivos:'', metas:'', intervencoes:'' })
  // PIA form
  const [piaForm, setPiaForm] = useState({ residente_id:'', data: new Date().toISOString().split('T')[0], avaliacao_funcional:'', aspectos_sociais:'', atividades_preferidas:'', plano_vida:'', preferencias:'' })

  const [loadingAI, setLoadingAI] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [selectedResidente, setSelectedResidente] = useState<Residente|null>(null)

  async function load() {
    const { data: res } = await supabase.from('residentes').select('*').eq('status','ativo').order('nome')
    setResidentes(res || [])
    const { data: paiData } = await supabase.from('pai').select('*, residente:residentes(nome,quarto)').order('created_at',{ascending:false})
    setPais(paiData || [])
    const { data: piaData } = await supabase.from('pia').select('*, residente:residentes(nome,quarto)').order('created_at',{ascending:false})
    setPias(piaData || [])
  }

  useEffect(() => { load() }, [])

  function updPAI(k: string, v: string) { setPaiForm(f => ({...f,[k]:v})) }
  function updPIA(k: string, v: string) { setPiaForm(f => ({...f,[k]:v})) }

  async function gerarPAI_IA() {
    if (!paiForm.residente_id) { setMsg('Selecione um residente primeiro.'); return }
    setLoadingAI(true)
    const res = await fetch('/api/relatorios/gerar-pai', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ residente_id: paiForm.residente_id })
    })
    const json = await res.json()
    setLoadingAI(false)
    if (json.diagnosticos) {
      setPaiForm(f => ({...f, diagnosticos:json.diagnosticos, objetivos:json.objetivos, metas:json.metas, intervencoes:json.intervencoes}))
      setMsg('✦ IA preencheu o PAI com base no histórico do residente. Revise e ajuste antes de salvar.')
    } else setMsg('Erro ao gerar com IA: ' + (json.error||''))
    setTimeout(() => setMsg(''), 6000)
  }

  async function gerarPIA_IA() {
    if (!piaForm.residente_id) { setMsg('Selecione um residente primeiro.'); return }
    setLoadingAI(true)
    const res = await fetch('/api/relatorios/gerar-pia', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ residente_id: piaForm.residente_id })
    })
    const json = await res.json()
    setLoadingAI(false)
    if (json.avaliacao_funcional) {
      setPiaForm(f => ({...f, ...json}))
      setMsg('✦ IA preencheu o PIA com base no histórico do residente. Revise antes de salvar.')
    } else setMsg('Erro: ' + (json.error||''))
    setTimeout(() => setMsg(''), 6000)
  }

  async function salvarPAI() {
    if (!paiForm.residente_id || !paiForm.data_inicio || !paiForm.data_validade) { setMsg('Preencha residente, data de início e validade.'); return }
    setSaving(true)
    const { error } = await supabase.from('pai').insert({ ...paiForm, responsavel_id: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: '+error.message); return }
    setMsg('PAI salvo com sucesso!'); load(); setSubTab('lista')
    setTimeout(() => setMsg(''), 3000)
  }

  async function salvarPIA() {
    if (!piaForm.residente_id || !piaForm.data) { setMsg('Preencha residente e data.'); return }
    setSaving(true)
    const { error } = await supabase.from('pia').insert({ ...piaForm, responsavel_id: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: '+error.message); return }
    setMsg('PIA salvo com sucesso!'); load(); setSubTab('lista')
    setTimeout(() => setMsg(''), 3000)
  }

  function selecionarResidentePAI(id: string) {
    updPAI('residente_id', id)
    setSelectedResidente(residentes.find(r=>r.id===id)||null)
  }
  function selecionarResidentePIA(id: string) {
    updPIA('residente_id', id)
    setSelectedResidente(residentes.find(r=>r.id===id)||null)
  }

  const TABS: {id:SubTab; label:string}[] = [
    {id:'lista', label:'📋 Lista de Relatórios'},
    {id:'pai', label:'📄 Novo PAI'},
    {id:'pia', label:'📄 Novo PIA'},
  ]

  return (
    <div>
      {msg && (
        <div style={{background:msg.includes('Erro')?'#fee2e2': msg.startsWith('✦')?'#ede9fe':'#d8f3dc', color:msg.includes('Erro')?'#991b1b':msg.startsWith('✦')?'#5b21b6':'#2d6a4f', padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px'}}>{msg}</div>
      )}

      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
        <div style={{display:'flex', gap:'0'}}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)} style={{
              padding:'9px 18px', fontSize:'13px', fontWeight:500, cursor:'pointer',
              background: subTab===t.id?'#fff':'transparent', color: subTab===t.id?'#40916c':'#9a9588',
              border:'none', borderBottom: subTab===t.id?'2px solid #40916c':'2px solid transparent', fontFamily:'inherit'
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── LISTA ── */}
      {subTab==='lista' && (
        <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
          <div style={S.card}>
            <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>PAI — Planos de Atenção Individual</div>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
              <thead><tr style={{background:'#f7f5f0'}}>{['Residente','Quarto','Período','Validade','Ações'].map(h=><th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const}}>{h}</th>)}</tr></thead>
              <tbody>
                {pais.length===0 && <tr><td colSpan={5} style={{padding:'24px', textAlign:'center' as const, color:'#9a9588'}}>Nenhum PAI cadastrado.</td></tr>}
                {pais.map(p => {
                  const vencendo = p.data_validade && new Date(p.data_validade) < new Date(Date.now() + 7*24*60*60*1000)
                  return (
                    <tr key={p.id} style={{borderBottom:'1px solid #e0dbd0'}}>
                      <td style={{padding:'11px 12px', fontWeight:500}}>{p.residente?.nome}</td>
                      <td style={{padding:'11px 12px'}}>{p.residente?.quarto}</td>
                      <td style={{padding:'11px 12px', fontSize:'12px', color:'#5c5850'}}>{new Date(p.data_inicio+'T12:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{padding:'11px 12px'}}>
                        <span style={{fontSize:'12px', color: vencendo?'#991b1b':'#5c5850', fontWeight: vencendo?600:400}}>
                          {p.data_validade ? new Date(p.data_validade+'T12:00').toLocaleDateString('pt-BR') : '—'}
                          {vencendo && ' ⚠️'}
                        </span>
                      </td>
                      <td style={{padding:'11px 12px'}}>
                        <div style={{display:'flex', gap:'6px'}}>
                          <button style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>Ver</button>
                          <button style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>📄 PDF</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{marginTop:'12px'}}><button onClick={() => setSubTab('pai')} style={S.btn()}>+ Novo PAI</button></div>
          </div>

          <div style={S.card}>
            <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>PIA — Planos Individuais de Atenção</div>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
              <thead><tr style={{background:'#f7f5f0'}}>{['Residente','Quarto','Data','Dependência','Ações'].map(h=><th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const}}>{h}</th>)}</tr></thead>
              <tbody>
                {pias.length===0 && <tr><td colSpan={5} style={{padding:'24px', textAlign:'center' as const, color:'#9a9588'}}>Nenhum PIA cadastrado.</td></tr>}
                {pias.map(p => (
                  <tr key={p.id} style={{borderBottom:'1px solid #e0dbd0'}}>
                    <td style={{padding:'11px 12px', fontWeight:500}}>{p.residente?.nome}</td>
                    <td style={{padding:'11px 12px'}}>{p.residente?.quarto}</td>
                    <td style={{padding:'11px 12px', fontSize:'12px', color:'#5c5850'}}>{new Date(p.data+'T12:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{padding:'11px 12px', textTransform:'capitalize' as const, fontSize:'12px', color:'#5c5850'}}>{p.avaliacao_funcional?.split(' ').slice(0,3).join(' ')||'—'}</td>
                    <td style={{padding:'11px 12px'}}>
                      <div style={{display:'flex', gap:'6px'}}>
                        <button style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>Ver</button>
                        <button style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>📄 PDF</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{marginTop:'12px'}}><button onClick={() => setSubTab('pia')} style={S.btn()}>+ Novo PIA</button></div>
          </div>
        </div>
      )}

      {/* ── PAI ── */}
      {subTab==='pai' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                <div style={{fontWeight:600, fontSize:'14px'}}>PAI — Identificação</div>
                <span style={S.aiBadge}>✦ IA disponível</span>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Residente *</label>
                <select value={paiForm.residente_id} onChange={e=>selecionarResidentePAI(e.target.value)} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>
              {selectedResidente && paiForm.residente_id && (
                <div style={{padding:'10px 12px', background:'#f7f5f0', borderRadius:'8px', fontSize:'12px', color:'#5c5850', marginBottom:'12px'}}>
                  <div><strong>Diagnósticos cadastrados:</strong> {selectedResidente.diagnosticos||'Não informado'}</div>
                  <div style={{marginTop:'4px'}}><strong>Dependência:</strong> {selectedResidente.nivel_dependencia||'—'}</div>
                </div>
              )}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px'}}>
                <div><label style={S.label}>Início *</label><input type="date" value={paiForm.data_inicio} onChange={e=>updPAI('data_inicio',e.target.value)} style={S.input}/></div>
                <div><label style={S.label}>Válido até *</label><input type="date" value={paiForm.data_validade} onChange={e=>updPAI('data_validade',e.target.value)} style={S.input}/></div>
              </div>
              <button onClick={gerarPAI_IA} disabled={loadingAI||!paiForm.residente_id} style={S.btn('#5b21b6')}>
                {loadingAI ? '⏳ Gerando...' : '✦ Gerar com IA'}
              </button>
              <div style={{fontSize:'11px', color:'#9a9588', marginTop:'6px'}}>A IA analisa o histórico do residente e preenche automaticamente.</div>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Conteúdo do PAI</div>
              <div style={{marginBottom:'12px'}}><label style={S.label}>Diagnósticos Ativos</label><textarea value={paiForm.diagnosticos} onChange={e=>updPAI('diagnosticos',e.target.value)} style={S.textarea}/></div>
              <div style={{marginBottom:'12px'}}><label style={S.label}>Objetivos do Cuidado</label><textarea value={paiForm.objetivos} onChange={e=>updPAI('objetivos',e.target.value)} style={S.textarea}/></div>
              <div style={{marginBottom:'12px'}}><label style={S.label}>Metas (3 meses)</label><textarea value={paiForm.metas} onChange={e=>updPAI('metas',e.target.value)} style={S.textarea}/></div>
              <div style={{marginBottom:'20px'}}><label style={S.label}>Intervenções da Equipe</label><textarea value={paiForm.intervencoes} onChange={e=>updPAI('intervencoes',e.target.value)} style={S.textarea}/></div>
              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={salvarPAI} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar PAI'}</button>
                <button style={S.btnSec}>📄 Exportar PDF</button>
                <button onClick={()=>setSubTab('lista')} style={S.btnSec}>Voltar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PIA ── */}
      {subTab==='pia' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                <div style={{fontWeight:600, fontSize:'14px'}}>PIA — Identificação</div>
                <span style={S.aiBadge}>✦ IA disponível</span>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Residente *</label>
                <select value={piaForm.residente_id} onChange={e=>selecionarResidentePIA(e.target.value)} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Data *</label>
                <input type="date" value={piaForm.data} onChange={e=>updPIA('data',e.target.value)} style={S.input}/>
              </div>
              <button onClick={gerarPIA_IA} disabled={loadingAI||!piaForm.residente_id} style={S.btn('#5b21b6')}>
                {loadingAI?'⏳ Gerando...':'✦ Gerar com IA'}
              </button>
              <div style={{fontSize:'11px', color:'#9a9588', marginTop:'6px'}}>A IA analisa o perfil e histórico para sugerir o PIA.</div>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Conteúdo do PIA</div>
              <div style={{marginBottom:'12px'}}><label style={S.label}>Avaliação Funcional</label><select value={piaForm.avaliacao_funcional} onChange={e=>updPIA('avaliacao_funcional',e.target.value)} style={S.select}><option value="">Selecione...</option><option value="Independente">Independente</option><option value="Dependência leve">Dependência leve</option><option value="Dependência moderada">Dependência moderada</option><option value="Dependência total">Dependência total</option></select></div>
              <div style={{marginBottom:'12px'}}><label style={S.label}>Aspectos Sociais e Familiares</label><textarea value={piaForm.aspectos_sociais} onChange={e=>updPIA('aspectos_sociais',e.target.value)} style={S.textarea}/></div>
              <div style={{marginBottom:'12px'}}><label style={S.label}>Atividades Preferidas</label><textarea value={piaForm.atividades_preferidas} onChange={e=>updPIA('atividades_preferidas',e.target.value)} style={S.textarea}/></div>
              <div style={{marginBottom:'12px'}}><label style={S.label}>Plano de Vida e Preferências</label><textarea value={piaForm.plano_vida} onChange={e=>updPIA('plano_vida',e.target.value)} style={S.textarea}/></div>
              <div style={{marginBottom:'20px'}}><label style={S.label}>Preferências Alimentares e Outras</label><textarea value={piaForm.preferencias} onChange={e=>updPIA('preferencias',e.target.value)} style={S.textarea}/></div>
              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={salvarPIA} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar PIA'}</button>
                <button style={S.btnSec}>📄 Exportar PDF</button>
                <button onClick={()=>setSubTab('lista')} style={S.btnSec}>Voltar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
