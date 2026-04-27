'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { EvolucaoMultidisciplinar, Residente, EspecialidadeMulti, ESPECIALIDADE_LABELS, PERMISSIONS } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'90px' },
}

const ESPECIA_COLORS: Record<string,string> = {
  medico:'#1d4e89', fisioterapeuta:'#2d6a4f', psicologo:'#5b21b6',
  terapeuta_ocupacional:'#92400e', assistente_social:'#134e4a', nutricionista_multi:'#991b1b'
}

const FORM_EMPTY = { residente_id:'', especialidade:'' as EspecialidadeMulti|'', tipo_atendimento:'evolucao', evolucao_texto:'', conduta:'', objetivos:'', proximo_atendimento:'' }

export default function MultidisciplinarPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [tab, setTab] = useState<'historico'|'registrar'>('historico')
  const [evolucoes, setEvolucoes] = useState<EvolucaoMultidisciplinar[]>([])
  const [residentes, setResidentes] = useState<Residente[]>([])
  const [form, setForm] = useState({ ...FORM_EMPTY })
  const [filterResidente, setFilterResidente] = useState('')
  const [filterEsp, setFilterEsp] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editId, setEditId] = useState<string|null>(null)
  const [expandId, setExpandId] = useState<string|null>(null)

  const myEsp = profile?.especialidade
  const canEdit = (ev: EvolucaoMultidisciplinar) =>
    profile && (PERMISSIONS.canEditSignedEvolucao(profile.role) || (profile.role==='multidisciplinar' && ev.created_by === profile.id))

  async function load() {
    const { data: res } = await supabase.from('residentes').select('id,nome,quarto,posto').eq('status','ativo').order('nome')
    setResidentes(res || [])

    let q = supabase.from('evolucoes_multidisciplinares')
      .select(`*, residente:residentes(nome,quarto), created_by_profile:profiles!created_by(full_name,especialidade)`)
      .order('data', { ascending: false }).order('created_at', { ascending: false })
    if (filterResidente) q = q.eq('residente_id', filterResidente)
    if (filterEsp) q = q.eq('especialidade', filterEsp)
    const { data } = await q
    setEvolucoes((data || []) as EvolucaoMultidisciplinar[])
  }

  useEffect(() => { load() }, [filterResidente, filterEsp])

  const upd = (k: string, v: string) => setForm(f => ({...f, [k]:v}))

  async function salvar() {
    if (!form.residente_id || !form.evolucao_texto) { setMsg('Preencha o residente e a evolução.'); return }
    const esp = myEsp || form.especialidade
    if (!esp) { setMsg('Especialidade não definida.'); return }
    setSaving(true)
    if (editId) {
      const { error } = await supabase.from('evolucoes_multidisciplinares').update({
        evolucao_texto: form.evolucao_texto, conduta: form.conduta||null,
        objetivos: form.objetivos||null, proximo_atendimento: form.proximo_atendimento||null,
        tipo_atendimento: form.tipo_atendimento, updated_by: profile?.id,
      }).eq('id', editId)
      if (error) { setMsg('Erro: '+error.message) }
      else { setMsg('Evolução atualizada!'); setEditId(null) }
    } else {
      const { error } = await supabase.from('evolucoes_multidisciplinares').insert({
        residente_id: form.residente_id, data: new Date().toISOString().split('T')[0],
        especialidade: esp, tipo_atendimento: form.tipo_atendimento,
        evolucao_texto: form.evolucao_texto, conduta: form.conduta||null,
        objetivos: form.objetivos||null, proximo_atendimento: form.proximo_atendimento||null,
        created_by: profile?.id,
      })
      if (error) { setMsg('Erro: '+error.message) }
      else { setMsg('Evolução salva com sucesso!') }
    }
    setSaving(false); setForm({...FORM_EMPTY}); setTab('historico'); load()
    setTimeout(() => setMsg(''), 3000)
  }

  function iniciarEdicao(ev: EvolucaoMultidisciplinar) {
    setForm({ residente_id:ev.residente_id, especialidade:ev.especialidade, tipo_atendimento:ev.tipo_atendimento||'evolucao', evolucao_texto:ev.evolucao_texto, conduta:ev.conduta||'', objetivos:ev.objetivos||'', proximo_atendimento:ev.proximo_atendimento||'' })
    setEditId(ev.id); setTab('registrar')
  }

  return (
    <div>
      {msg && <div style={{background:msg.includes('Erro')?'#fee2e2':'#d8f3dc',color:msg.includes('Erro')?'#991b1b':'#2d6a4f',padding:'12px 16px',borderRadius:'10px',marginBottom:'16px',fontSize:'13px'}}>{msg}</div>}

      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
        <div style={{display:'flex', gap:'0'}}>
          {(['historico','registrar'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if(t==='registrar'&&!editId) setForm({...FORM_EMPTY}) }} style={{
              padding:'9px 20px', fontSize:'13px', fontWeight:500, cursor:'pointer',
              background: tab===t ? '#fff':'transparent', color: tab===t ? '#40916c':'#9a9588',
              border:'none', borderBottom: tab===t ? '2px solid #40916c':'2px solid transparent', fontFamily:'inherit'
            }}>
              {t==='historico'?'📋 Histórico':'✏️ '+(editId?'Editar':'Registrar')+' Evolução'}
            </button>
          ))}
        </div>
        {tab==='historico' && <button onClick={() => { setEditId(null); setForm({...FORM_EMPTY}); setTab('registrar') }} style={S.btn()}>+ Nova Evolução</button>}
      </div>

      {/* HISTORICO */}
      {tab === 'historico' && (
        <div>
          <div style={{...S.card, marginBottom:'16px', display:'flex', gap:'12px', flexWrap:'wrap' as const}}>
            <div style={{flex:2, minWidth:'200px'}}>
              <label style={S.label}>Residente</label>
              <select value={filterResidente} onChange={e=>setFilterResidente(e.target.value)} style={S.select}>
                <option value="">Todos os residentes</option>
                {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
              </select>
            </div>
            <div style={{flex:1, minWidth:'180px'}}>
              <label style={S.label}>Especialidade</label>
              <select value={filterEsp} onChange={e=>setFilterEsp(e.target.value)} style={S.select}>
                <option value="">Todas</option>
                {(Object.entries(ESPECIALIDADE_LABELS) as [EspecialidadeMulti,string][]).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{alignSelf:'flex-end'}}><button onClick={load} style={S.btnSec}>Filtrar</button></div>
          </div>

          <div style={{display:'flex', flexDirection:'column' as const, gap:'10px'}}>
            {evolucoes.length===0 && <div style={{...S.card, textAlign:'center' as const, color:'#9a9588', padding:'40px'}}>Nenhuma evolução encontrada.</div>}
            {evolucoes.map(ev => {
              const espColor = ESPECIA_COLORS[ev.especialidade] || '#5f5e5a'
              const prof = ev.created_by_profile as any
              const open = expandId === ev.id
              return (
                <div key={ev.id} style={S.card}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                      <div style={{width:'4px', height:'44px', background:espColor, borderRadius:'4px', flexShrink:0}}/>
                      <div>
                        <div style={{fontWeight:500, fontSize:'14px'}}>{(ev.residente as any)?.nome}</div>
                        <div style={{fontSize:'12px', color:'#9a9588'}}>
                          {new Date(ev.data+'T12:00').toLocaleDateString('pt-BR')} · {ESPECIALIDADE_LABELS[ev.especialidade]} · {prof?.full_name}
                        </div>
                      </div>
                      <span style={{padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background:`${espColor}15`, color:espColor}}>
                        {ev.tipo_atendimento}
                      </span>
                    </div>
                    <div style={{display:'flex', gap:'6px'}}>
                      {canEdit(ev) && <button onClick={() => iniciarEdicao(ev)} style={{...S.btnSec, fontSize:'12px', padding:'5px 10px'}}>Editar</button>}
                      <button onClick={() => setExpandId(open?null:ev.id)} style={{...S.btnSec, fontSize:'12px', padding:'5px 10px'}}>{open?'Fechar':'Ver'}</button>
                    </div>
                  </div>
                  {open && (
                    <div style={{marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #e0dbd0'}}>
                      {ev.evolucao_texto && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px', color:'#9a9588', marginBottom:'4px', textTransform:'uppercase' as const}}>Evolução</div><div style={{fontSize:'13px', lineHeight:'1.7', color:'#1a1814'}}>{ev.evolucao_texto}</div></div>}
                      {ev.conduta && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px', color:'#9a9588', marginBottom:'4px', textTransform:'uppercase' as const}}>Conduta</div><div style={{fontSize:'13px', lineHeight:'1.7'}}>{ev.conduta}</div></div>}
                      {ev.objetivos && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px', color:'#9a9588', marginBottom:'4px', textTransform:'uppercase' as const}}>Objetivos</div><div style={{fontSize:'13px', lineHeight:'1.7'}}>{ev.objetivos}</div></div>}
                      {ev.proximo_atendimento && <div style={{fontSize:'12px', color:'#9a9588'}}>📅 Próximo atendimento: {new Date(ev.proximo_atendimento+'T12:00').toLocaleDateString('pt-BR')}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* REGISTRAR */}
      {tab === 'registrar' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Identificação</div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Residente *</label>
                <select value={form.residente_id} onChange={e=>upd('residente_id',e.target.value)} style={S.select} disabled={!!editId}>
                  <option value="">Selecione...</option>
                  {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>
              {!myEsp && (
                <div style={{marginBottom:'12px'}}>
                  <label style={S.label}>Especialidade *</label>
                  <select value={form.especialidade} onChange={e=>upd('especialidade',e.target.value)} style={S.select} disabled={!!editId}>
                    <option value="">Selecione...</option>
                    {(Object.entries(ESPECIALIDADE_LABELS) as [EspecialidadeMulti,string][]).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}
              {myEsp && <div style={{padding:'8px 12px', background:'#f7f5f0', borderRadius:'8px', fontSize:'13px', color:'#5c5850', marginBottom:'12px'}}>Especialidade: <strong>{ESPECIALIDADE_LABELS[myEsp]}</strong></div>}
              <div>
                <label style={S.label}>Tipo de Atendimento</label>
                <select value={form.tipo_atendimento} onChange={e=>upd('tipo_atendimento',e.target.value)} style={S.select}>
                  <option value="avaliacao">Avaliação</option>
                  <option value="evolucao">Evolução de Rotina</option>
                  <option value="interconsulta">Interconsulta</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>
            <div style={S.card}>
              <label style={S.label}>Objetivos</label>
              <textarea value={form.objetivos} onChange={e=>upd('objetivos',e.target.value)} style={S.textarea} placeholder="Objetivos terapêuticos..."/>
              <div style={{marginTop:'12px'}}>
                <label style={S.label}>Próximo Atendimento</label>
                <input type="date" value={form.proximo_atendimento} onChange={e=>upd('proximo_atendimento',e.target.value)} style={S.input}/>
              </div>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Evolução *</div>
              <textarea value={form.evolucao_texto} onChange={e=>upd('evolucao_texto',e.target.value)} style={{...S.textarea, minHeight:'180px'}} placeholder="Descreva o atendimento, observações clínicas, evolução do paciente..."/>
            </div>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Conduta</div>
              <textarea value={form.conduta} onChange={e=>upd('conduta',e.target.value)} style={S.textarea} placeholder="Condutas realizadas e planejadas..."/>
            </div>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={salvar} disabled={saving} style={{...S.btn(), flex:1, justifyContent:'center', padding:'12px'}}>{saving?'Salvando...':'💾 '+(editId?'Atualizar':'Salvar Evolução')}</button>
              <button onClick={() => { setEditId(null); setForm({...FORM_EMPTY}); setTab('historico') }} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
