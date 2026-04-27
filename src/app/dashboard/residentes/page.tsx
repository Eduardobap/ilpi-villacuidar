'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { Residente, PostoEnfermagem, POSTO_LABELS, PERMISSIONS } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'70px' },
  statusTag: (s: string) => {
    const m: Record<string,{bg:string,color:string}> = { ativo:{bg:'#d8f3dc',color:'#2d6a4f'}, internado:{bg:'#dbeafe',color:'#1d4e89'}, falecido:{bg:'#f1efe8',color:'#5f5e5a'}, alta:{bg:'#fef3c7',color:'#92400e'} }
    const t = m[s]||m.ativo; return {display:'inline-flex' as const, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 as const, background:t.bg, color:t.color}
  }
}

const EMPTY: Partial<Residente> = { nome:'', quarto:'', posto:'posto_1', nivel_dependencia:'moderado', status:'ativo', diagnosticos:'', alergias:'', responsavel_nome:'', responsavel_parentesco:'', responsavel_telefone:'', mensalidade:undefined }

export default function ResidentesPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [residentes, setResidentes] = useState<Residente[]>([])
  const [search, setSearch] = useState('')
  const [filterPosto, setFilterPosto] = useState<PostoEnfermagem|'todos'>('todos')
  const [filterStatus, setFilterStatus] = useState('ativo')
  const [modal, setModal] = useState<'ver'|'editar'|'novo'|null>(null)
  const [selected, setSelected] = useState<Partial<Residente>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const postoFix = profile?.role === 'cuidador' ? profile.posto : undefined
  const canEdit = profile && PERMISSIONS.canAccessPAIPIA(profile.role)

  async function load() {
    let q = supabase.from('residentes').select('*').order('nome')
    if (postoFix) q = q.eq('posto', postoFix)
    else if (filterPosto !== 'todos') q = q.eq('posto', filterPosto)
    if (filterStatus !== 'todos') q = q.eq('status', filterStatus)
    const { data } = await q
    setResidentes(data?.map(r => ({
      ...r,
      idade: Math.floor((new Date().getTime() - new Date(r.data_nascimento).getTime()) / (1000*60*60*24*365.25))
    })) || [])
  }

  useEffect(() => { load() }, [filterPosto, filterStatus])

  function upd(k: string, v: any) { setSelected(s => ({...s, [k]:v})) }

  async function salvar() {
    if (!selected.nome || !selected.quarto || !selected.posto) { setMsg('Preencha nome, quarto e posto.'); return }
    setSaving(true)
    const payload = { ...selected }
    if (!payload.data_nascimento) delete payload.data_nascimento
    const { error } = selected.id
      ? await supabase.from('residentes').update(payload).eq('id', selected.id)
      : await supabase.from('residentes').insert({ ...payload, data_entrada: new Date().toISOString().split('T')[0] })
    setSaving(false)
    if (error) { setMsg('Erro: ' + error.message); return }
    setMsg(selected.id ? 'Residente atualizado!' : 'Residente cadastrado!')
    setModal(null); load()
    setTimeout(() => setMsg(''), 3000)
  }

  const filtered = residentes.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()) || r.quarto.includes(search))

  const avatarColor = (nome: string) => {
    const colors = ['#dbeafe','#d8f3dc','#ede9fe','#fef3c7','#fee2e2','#ccfbf1']
    const textColors = ['#1d4e89','#2d6a4f','#5b21b6','#92400e','#991b1b','#134e4a']
    const i = nome.charCodeAt(0) % colors.length
    return { bg: colors[i], text: textColors[i] }
  }

  return (
    <div>
      {msg && <div style={{background:msg.includes('Erro')?'#fee2e2':'#d8f3dc', color:msg.includes('Erro')?'#991b1b':'#2d6a4f', padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px'}}>{msg}</div>}

      {/* Filtros + ações */}
      <div style={{...S.card, marginBottom:'16px', display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' as const}}>
        <div style={{flex:2, minWidth:'200px'}}>
          <label style={S.label}>Buscar</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome ou quarto..." style={S.input}/>
        </div>
        {!postoFix && (
          <div style={{flex:1, minWidth:'140px'}}>
            <label style={S.label}>Posto</label>
            <select value={filterPosto} onChange={e=>setFilterPosto(e.target.value as any)} style={S.select}>
              <option value="todos">Todos os postos</option>
              <option value="posto_1">Posto 1</option>
              <option value="posto_2">Posto 2</option>
              <option value="posto_3">Posto 3</option>
            </select>
          </div>
        )}
        <div style={{flex:1, minWidth:'140px'}}>
          <label style={S.label}>Status</label>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={S.select}>
            <option value="ativo">Ativos</option>
            <option value="internado">Internados</option>
            <option value="alta">Alta</option>
            <option value="falecido">Falecido</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <button onClick={load} style={S.btnSec}>Filtrar</button>
        {canEdit && <button onClick={() => { setSelected({...EMPTY}); setModal('novo') }} style={S.btn()}>+ Novo Residente</button>}
      </div>

      {/* Resumo por posto */}
      {!postoFix && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'16px'}}>
          {(['posto_1','posto_2','posto_3'] as PostoEnfermagem[]).map(p => (
            <div key={p} style={{...S.card, padding:'14px 16px'}}>
              <div style={{fontSize:'11px', color:'#9a9588', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px'}}>{POSTO_LABELS[p]}</div>
              <div style={{fontSize:'22px', fontWeight:600, color:'#40916c'}}>{residentes.filter(r=>r.posto===p&&r.status==='ativo').length}</div>
              <div style={{fontSize:'12px', color:'#9a9588'}}>residentes ativos</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      <div style={S.card}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
          <div style={{fontSize:'13px', color:'#5c5850'}}>{filtered.length} residente(s) encontrado(s)</div>
        </div>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#f7f5f0'}}>
              {['Residente','Quarto','Posto','Idade','Diagnóstico','Dependência','Status','Ações'].map(h=>(
                <th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{padding:'32px', textAlign:'center' as const, color:'#9a9588'}}>Nenhum residente encontrado.</td></tr>}
            {filtered.map(r => {
              const av = avatarColor(r.nome)
              return (
                <tr key={r.id} style={{borderBottom:'1px solid #e0dbd0'}}>
                  <td style={{padding:'12px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                      <div style={{width:'32px', height:'32px', borderRadius:'50%', background:av.bg, color:av.text, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:600, flexShrink:0}}>
                        {r.nome.split(' ').slice(0,2).map(w=>w[0]).join('')}
                      </div>
                      <span style={{fontWeight:500}}>{r.nome}</span>
                    </div>
                  </td>
                  <td style={{padding:'12px'}}>{r.quarto}</td>
                  <td style={{padding:'12px'}}><span style={{fontSize:'11px', background:'#f1efe8', color:'#5f5e5a', padding:'2px 8px', borderRadius:'20px'}}>{POSTO_LABELS[r.posto]}</span></td>
                  <td style={{padding:'12px'}}>{r.idade} anos</td>
                  <td style={{padding:'12px', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, color:'#5c5850'}}>{r.diagnosticos || '—'}</td>
                  <td style={{padding:'12px', textTransform:'capitalize' as const, color:'#5c5850'}}>{r.nivel_dependencia || '—'}</td>
                  <td style={{padding:'12px'}}><span style={S.statusTag(r.status)}>{r.status}</span></td>
                  <td style={{padding:'12px'}}>
                    <div style={{display:'flex', gap:'6px'}}>
                      <button onClick={() => { setSelected(r); setModal('ver') }} style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>Ver</button>
                      {canEdit && <button onClick={() => { setSelected(r); setModal('editar') }} style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>Editar</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {(modal === 'novo' || modal === 'editar' || modal === 'ver') && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px'}}>
          <div style={{background:'#fff', borderRadius:'16px', width:'720px', maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{padding:'20px 24px 16px', borderBottom:'1px solid #e0dbd0', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'#fff'}}>
              <div style={{fontSize:'16px', fontWeight:600}}>
                {modal==='novo'?'Novo Residente': modal==='editar'?'Editar Residente': selected.nome}
              </div>
              <span onClick={() => setModal(null)} style={{cursor:'pointer', color:'#9a9588', fontSize:'18px'}}>✕</span>
            </div>
            <div style={{padding:'20px 24px 24px'}}>
              {modal === 'ver' ? (
                <ResidenteDetail r={selected as Residente}/>
              ) : (
                <div>
                  <div style={{fontWeight:600, fontSize:'13px', color:'#5c5850', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.5px'}}>Dados Pessoais</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px'}}>
                    <div style={{gridColumn:'span 2'}}><label style={S.label}>Nome Completo *</label><input value={selected.nome||''} onChange={e=>upd('nome',e.target.value)} style={S.input}/></div>
                    <div><label style={S.label}>Data de Nascimento</label><input type="date" value={selected.data_nascimento||''} onChange={e=>upd('data_nascimento',e.target.value)} style={S.input}/></div>
                    <div><label style={S.label}>CPF</label><input value={selected.cpf||''} onChange={e=>upd('cpf',e.target.value)} placeholder="000.000.000-00" style={S.input}/></div>
                    <div><label style={S.label}>Quarto *</label><input value={selected.quarto||''} onChange={e=>upd('quarto',e.target.value)} style={S.input}/></div>
                    <div><label style={S.label}>Posto *</label><select value={selected.posto||'posto_1'} onChange={e=>upd('posto',e.target.value)} style={S.select}><option value="posto_1">Posto 1</option><option value="posto_2">Posto 2</option><option value="posto_3">Posto 3</option></select></div>
                    <div><label style={S.label}>Status</label><select value={selected.status||'ativo'} onChange={e=>upd('status',e.target.value)} style={S.select}><option value="ativo">Ativo</option><option value="internado">Internado</option><option value="alta">Alta</option><option value="falecido">Falecido</option></select></div>
                    <div><label style={S.label}>Nível de Dependência</label><select value={selected.nivel_dependencia||''} onChange={e=>upd('nivel_dependencia',e.target.value)} style={S.select}><option value="independente">Independente</option><option value="leve">Leve</option><option value="moderado">Moderado</option><option value="total">Total</option></select></div>
                  </div>
                  <div style={{fontWeight:600, fontSize:'13px', color:'#5c5850', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.5px'}}>Saúde</div>
                  <div style={{display:'grid', gap:'12px', marginBottom:'16px'}}>
                    <div><label style={S.label}>Diagnósticos</label><textarea value={selected.diagnosticos||''} onChange={e=>upd('diagnosticos',e.target.value)} style={S.textarea}/></div>
                    <div><label style={S.label}>Alergias</label><input value={selected.alergias||''} onChange={e=>upd('alergias',e.target.value)} style={S.input}/></div>
                    <div><label style={S.label}>Observações Médicas</label><textarea value={selected.observacoes_medicas||''} onChange={e=>upd('observacoes_medicas',e.target.value)} style={S.textarea}/></div>
                  </div>
                  <div style={{fontWeight:600, fontSize:'13px', color:'#5c5850', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.5px'}}>Responsável</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px'}}>
                    <div><label style={S.label}>Nome</label><input value={selected.responsavel_nome||''} onChange={e=>upd('responsavel_nome',e.target.value)} style={S.input}/></div>
                    <div><label style={S.label}>Parentesco</label><input value={selected.responsavel_parentesco||''} onChange={e=>upd('responsavel_parentesco',e.target.value)} placeholder="Filho(a), cônjuge..." style={S.input}/></div>
                    <div><label style={S.label}>Telefone</label><input value={selected.responsavel_telefone||''} onChange={e=>upd('responsavel_telefone',e.target.value)} style={S.input}/></div>
                    <div><label style={S.label}>E-mail</label><input value={selected.responsavel_email||''} onChange={e=>upd('responsavel_email',e.target.value)} style={S.input}/></div>
                  </div>
                  <div style={{fontWeight:600, fontSize:'13px', color:'#5c5850', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.5px'}}>Financeiro</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'24px'}}>
                    <div><label style={S.label}>Plano de Saúde</label><input value={selected.plano_saude||''} onChange={e=>upd('plano_saude',e.target.value)} style={S.input}/></div>
                    <div><label style={S.label}>Mensalidade (R$)</label><input type="number" value={selected.mensalidade||''} onChange={e=>upd('mensalidade',parseFloat(e.target.value))} style={S.input}/></div>
                  </div>
                  <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={salvar} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar'}</button>
                    <button onClick={() => setModal(null)} style={S.btnSec}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResidenteDetail({ r }: { r: Residente }) {
  const rows = [
    ['Quarto', r.quarto], ['Posto', POSTO_LABELS[r.posto]], ['Data de Nascimento', r.data_nascimento ? new Date(r.data_nascimento+'T12:00').toLocaleDateString('pt-BR') : '—'],
    ['CPF', r.cpf||'—'], ['Diagnósticos', r.diagnosticos||'—'], ['Alergias', r.alergias||'—'],
    ['Dependência', r.nivel_dependencia||'—'], ['Responsável', r.responsavel_nome||'—'],
    ['Parentesco', r.responsavel_parentesco||'—'], ['Telefone', r.responsavel_telefone||'—'],
    ['Plano de Saúde', r.plano_saude||'—'],
    ['Mensalidade', r.mensalidade ? `R$ ${r.mensalidade.toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—'],
  ]
  return (
    <div>
      {rows.map(([k,v]) => (
        <div key={k} style={{display:'flex', padding:'10px 0', borderBottom:'1px solid #f7f5f0', fontSize:'13px'}}>
          <div style={{width:'160px', flexShrink:0, color:'#9a9588', fontSize:'12px'}}>{k}</div>
          <div style={{color:'#1a1814'}}>{v}</div>
        </div>
      ))}
    </div>
  )
}
