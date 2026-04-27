'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { EvolucaoDiaria, Residente, PostoEnfermagem, POSTO_LABELS, PERMISSIONS } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (color='#40916c') => ({ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', background:color, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { display:'inline-flex' as const, alignItems:'center' as const, gap:'6px', padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'80px' },
  tag: (c: string) => {
    const m: Record<string,{bg:string;color:string}> = {
      green:{bg:'#d8f3dc',color:'#2d6a4f'}, amber:{bg:'#fef3c7',color:'#92400e'},
      red:{bg:'#fee2e2',color:'#991b1b'}, blue:{bg:'#dbeafe',color:'#1d4e89'},
      purple:{bg:'#ede9fe',color:'#5b21b6'}, gray:{bg:'#f1efe8',color:'#5f5e5a'}
    }
    const t = m[c] || m.gray
    return { display:'inline-flex' as const, alignItems:'center' as const, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 as const, background:t.bg, color:t.color }
  },
}

const EMPTY_FORM = {
  residente_id:'', pressao_arterial:'', temperatura:'', saturacao_o2:'',
  frequencia_cardiaca:'', frequencia_respiratoria:'', glicemia:'',
  condicao_geral:'bom', alimentacao:'total', eliminacoes:'preservadas',
  sono:'', humor:'', evolucao_texto:'', intercorrencias:'',
  pendencias_proximo_turno:'', medicacoes_administradas:'', turno:'diurno'
}

export default function EvolucoesPagina() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [tab, setTab] = useState<'listar'|'preencher'>('listar')
  const [evolucoes, setEvolucoes] = useState<EvolucaoDiaria[]>([])
  const [residentes, setResidentes] = useState<Residente[]>([])
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [filterPosto, setFilterPosto] = useState<PostoEnfermagem | 'todos'>('todos')
  const [filterData, setFilterData] = useState(new Date().toISOString().split('T')[0])
  const [pinModal, setPinModal] = useState<{evolucaoId:string; nome:string} | null>(null)
  const [pin, setPin] = useState('')
  const [signing, setSigning] = useState(false)
  const [config, setConfig] = useState<{assinatura_modo: 'pin'|'click'|'admin'}>({assinatura_modo:'click'})
  const [msg, setMsg] = useState('')

  const postoFiltro = profile?.role === 'cuidador' ? profile.posto : undefined

  const load = useCallback(async () => {
    let qRes = supabase.from('residentes').select('*').eq('status','ativo').order('nome')
    if (postoFiltro) qRes = qRes.eq('posto', postoFiltro)
    else if (filterPosto !== 'todos') qRes = qRes.eq('posto', filterPosto)
    const { data: res } = await qRes
    setResidentes(res || [])

    let qEv = supabase
      .from('evolucoes_diarias')
      .select(`*, residente:residentes(nome,quarto,posto), preenchido_por_profile:profiles!preenchido_por(full_name,role), assinado_por_profile:profiles!assinado_por(full_name)`)
      .eq('data', filterData)
      .order('created_at', { ascending: false })
    if (postoFiltro) qEv = qEv.eq('posto', postoFiltro)
    else if (filterPosto !== 'todos') qEv = qEv.eq('posto', filterPosto)
    const { data: ev } = await qEv
    setEvolucoes((ev || []) as EvolucaoDiaria[])

    const { data: cfg } = await supabase.from('configuracoes').select('*').single()
    if (cfg) setConfig(cfg)
  }, [filterPosto, filterData, postoFiltro])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: string) => setForm(f => ({...f, [k]:v}))

  async function salvarEvolucao() {
    if (!form.residente_id || !form.evolucao_texto) {
      setMsg('Preencha o residente e a evolução.')
      return
    }
    setSaving(true)
    const residente = residentes.find(r => r.id === form.residente_id)
    const { error } = await supabase.from('evolucoes_diarias').upsert({
      residente_id: form.residente_id,
      data: filterData,
      turno: form.turno,
      posto: residente?.posto || postoFiltro,
      pressao_arterial: form.pressao_arterial || null,
      temperatura: form.temperatura ? parseFloat(form.temperatura) : null,
      saturacao_o2: form.saturacao_o2 ? parseFloat(form.saturacao_o2) : null,
      frequencia_cardiaca: form.frequencia_cardiaca ? parseInt(form.frequencia_cardiaca) : null,
      frequencia_respiratoria: form.frequencia_respiratoria ? parseInt(form.frequencia_respiratoria) : null,
      glicemia: form.glicemia ? parseInt(form.glicemia) : null,
      condicao_geral: form.condicao_geral,
      alimentacao: form.alimentacao,
      eliminacoes: form.eliminacoes,
      sono: form.sono || null,
      humor: form.humor || null,
      evolucao_texto: form.evolucao_texto,
      intercorrencias: form.intercorrencias || null,
      pendencias_proximo_turno: form.pendencias_proximo_turno || null,
      medicacoes_administradas: form.medicacoes_administradas || null,
      status: 'pendente',
      preenchido_por: profile?.id,
    }, { onConflict: 'residente_id,data,turno' })

    setSaving(false)
    if (error) { setMsg('Erro ao salvar: ' + error.message); return }
    setMsg('Evolução salva com sucesso!')
    setForm({ ...EMPTY_FORM })
    setTab('listar')
    load()
    setTimeout(() => setMsg(''), 3000)
  }

  async function assinar(evolucaoId: string, nome: string) {
    if (config.assinatura_modo === 'pin') {
      setPinModal({ evolucaoId, nome })
    } else {
      await confirmarAssinatura(evolucaoId, '')
    }
  }

  async function confirmarAssinatura(evolucaoId: string, pinInformado: string) {
    setSigning(true)
    if (config.assinatura_modo === 'pin' && pinInformado) {
      const { data: p } = await supabase.from('profiles').select('pin_hash').eq('id', profile?.id).single()
      if (!p?.pin_hash || p.pin_hash !== pinInformado) {
        setMsg('PIN incorreto.')
        setSigning(false)
        return
      }
    }
    await supabase.from('evolucoes_diarias').update({
      status: 'assinada',
      assinado_por: profile?.id,
      assinado_em: new Date().toISOString(),
    }).eq('id', evolucaoId)
    setSigning(false)
    setPinModal(null)
    setPin('')
    load()
  }

  const canSign = profile && PERMISSIONS.canSignEvolucao(profile.role)
  const canFill = profile && ['admin','enfermeira','tecnico','cuidador'].includes(profile.role)

  const statusColor = (s: string) =>
    s === 'assinada' ? 'green' : s === 'pendente' ? 'amber' : s === 'editada_enfermeira' ? 'blue' : 'gray'

  const statusLabel = (s: string) =>
    s === 'assinada' ? 'Assinada' : s === 'pendente' ? 'Pendente' : s === 'rascunho' ? 'Rascunho' : 'Editada'

  return (
    <div>
      {/* Mensagem */}
      {msg && (
        <div style={{
          background: msg.includes('Erro') ? '#fee2e2' : '#d8f3dc',
          color: msg.includes('Erro') ? '#991b1b' : '#2d6a4f',
          padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px'
        }}>{msg}</div>
      )}

      {/* Header e tabs */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
        <div style={{display:'flex', gap:'0'}}>
          {(['listar','preencher'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'9px 20px', fontSize:'13px', fontWeight:500, cursor:'pointer',
              background: tab===t ? '#fff' : 'transparent',
              color: tab===t ? '#40916c' : '#9a9588',
              border:'none', borderBottom: tab===t ? '2px solid #40916c' : '2px solid transparent',
              fontFamily:'inherit'
            }}>
              {t === 'listar' ? '📋 Evoluções do Dia' : '✏️ Preencher Evolução'}
            </button>
          ))}
        </div>
        {canFill && tab === 'listar' && (
          <button style={S.btn()} onClick={() => setTab('preencher')}>+ Nova Evolução</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{...S.card, marginBottom:'16px', display:'flex', gap:'16px', alignItems:'flex-end', flexWrap:'wrap' as const}}>
        <div style={{flex:1, minWidth:'140px'}}>
          <label style={S.label}>Data</label>
          <input type="date" value={filterData} onChange={e => setFilterData(e.target.value)} style={S.input}/>
        </div>
        {profile?.role !== 'cuidador' && (
          <div style={{flex:1, minWidth:'140px'}}>
            <label style={S.label}>Posto</label>
            <select value={filterPosto} onChange={e => setFilterPosto(e.target.value as any)} style={S.select}>
              <option value="todos">Todos os postos</option>
              <option value="posto_1">Posto 1</option>
              <option value="posto_2">Posto 2</option>
              <option value="posto_3">Posto 3</option>
            </select>
          </div>
        )}
        <button onClick={load} style={S.btnSec}>Filtrar</button>
      </div>

      {/* ── LISTAR ── */}
      {tab === 'listar' && (
        <div style={S.card}>
          <div style={{overflowX:'auto' as const}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
              <thead>
                <tr style={{background:'#f7f5f0'}}>
                  {['Residente','Quarto','Posto','Turno','PA','Temp','Sat','Condição','Status','Assinatura','Ação'].map(h => (
                    <th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evolucoes.length === 0 && (
                  <tr><td colSpan={11} style={{padding:'32px', textAlign:'center' as const, color:'#9a9588'}}>Nenhuma evolução para este dia/filtro.</td></tr>
                )}
                {evolucoes.map(ev => (
                  <tr key={ev.id} style={{borderBottom:'1px solid #e0dbd0'}}>
                    <td style={{padding:'11px 12px', fontWeight:500}}>{ev.residente?.nome}</td>
                    <td style={{padding:'11px 12px'}}>{ev.residente?.quarto}</td>
                    <td style={{padding:'11px 12px'}}>{ev.residente?.posto ? POSTO_LABELS[ev.residente.posto] : '—'}</td>
                    <td style={{padding:'11px 12px'}}>{ev.turno === 'diurno' ? '☀️ Diurno' : '🌙 Noturno'}</td>
                    <td style={{padding:'11px 12px'}}>{ev.pressao_arterial || '—'}</td>
                    <td style={{padding:'11px 12px'}}>{ev.temperatura ? ev.temperatura + '°' : '—'}</td>
                    <td style={{padding:'11px 12px'}}>{ev.saturacao_o2 ? ev.saturacao_o2 + '%' : '—'}</td>
                    <td style={{padding:'11px 12px'}}>{ev.condicao_geral || '—'}</td>
                    <td style={{padding:'11px 12px'}}><span style={S.tag(statusColor(ev.status))}>{statusLabel(ev.status)}</span></td>
                    <td style={{padding:'11px 12px', fontSize:'12px', color:'#5c5850'}}>
                      {ev.assinado_por_profile ? (
                        <span>✅ {(ev.assinado_por_profile as any).full_name}</span>
                      ) : (
                        <span style={{color:'#9a9588'}}>Não assinada</span>
                      )}
                    </td>
                    <td style={{padding:'11px 12px'}}>
                      <div style={{display:'flex', gap:'6px'}}>
                        {canSign && ev.status === 'pendente' && (
                          <button onClick={() => assinar(ev.id, ev.residente?.nome || '')} style={{...S.btn('#2d6a4f'), padding:'5px 10px', fontSize:'11px'}}>
                            ✍ Assinar
                          </button>
                        )}
                        <button style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>Ver</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumo por posto */}
          {profile?.role !== 'cuidador' && (
            <div style={{marginTop:'16px', padding:'12px', background:'#f7f5f0', borderRadius:'10px', display:'flex', gap:'24px', fontSize:'12px', color:'#5c5850'}}>
              <span>Total: <strong>{evolucoes.length}</strong></span>
              <span>✅ Assinadas: <strong>{evolucoes.filter(e=>e.status==='assinada').length}</strong></span>
              <span>⏳ Pendentes: <strong>{evolucoes.filter(e=>e.status==='pendente').length}</strong></span>
              <span>📝 Rascunhos: <strong>{evolucoes.filter(e=>e.status==='rascunho').length}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* ── PREENCHER ── */}
      {tab === 'preencher' && canFill && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          {/* Col 1 */}
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Identificação
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px'}}>
                <div>
                  <label style={S.label}>Turno</label>
                  <select value={form.turno} onChange={e=>upd('turno',e.target.value)} style={S.select}>
                    <option value="diurno">☀️ Diurno (07h–19h)</option>
                    <option value="noturno">🌙 Noturno (19h–07h)</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Data</label>
                  <input type="date" value={filterData} onChange={e=>setFilterData(e.target.value)} style={S.input}/>
                </div>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Residente *</label>
                <select value={form.residente_id} onChange={e=>upd('residente_id',e.target.value)} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r => (
                    <option key={r.id} value={r.id}>{r.nome} — Quarto {r.quarto} ({POSTO_LABELS[r.posto]})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Sinais Vitais
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                {[
                  ['pressao_arterial','Pressão Arterial','120/80 mmHg'],
                  ['temperatura','Temperatura','36.5°C'],
                  ['saturacao_o2','Saturação O₂','98%'],
                  ['frequencia_cardiaca','Freq. Cardíaca','bpm'],
                  ['frequencia_respiratoria','Freq. Respiratória','irpm'],
                  ['glicemia','Glicemia','mg/dL'],
                ].map(([k,l,p]) => (
                  <div key={k}>
                    <label style={S.label}>{l}</label>
                    <input value={(form as any)[k]} onChange={e=>upd(k,e.target.value)} placeholder={p} style={S.input}/>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Avaliações
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={S.label}>Condição Geral</label>
                  <select value={form.condicao_geral} onChange={e=>upd('condicao_geral',e.target.value)} style={S.select}>
                    <option value="bom">Bom estado geral (BEG)</option>
                    <option value="regular">Regular estado geral (REG)</option>
                    <option value="mau">Mau estado geral (MEG)</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Alimentação</label>
                  <select value={form.alimentacao} onChange={e=>upd('alimentacao',e.target.value)} style={S.select}>
                    <option value="total">Aceitação total</option>
                    <option value="parcial">Aceitação parcial</option>
                    <option value="recusou">Recusou alimentação</option>
                    <option value="dieta_enteral">Dieta enteral</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Eliminações</label>
                  <select value={form.eliminacoes} onChange={e=>upd('eliminacoes',e.target.value)} style={S.select}>
                    <option value="preservadas">Diurese e evacuação preservadas</option>
                    <option value="diurese_aumentada">Diurese aumentada</option>
                    <option value="oliguria">Oligúria</option>
                    <option value="anuria">Anúria</option>
                    <option value="constipacao">Constipação</option>
                    <option value="diarreia">Diarreia</option>
                    <option value="fralda">Uso de fralda</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Humor / Comportamento</label>
                  <input value={form.humor} onChange={e=>upd('humor',e.target.value)} placeholder="Ex: calmo, agitado, ansioso..." style={S.input}/>
                </div>
                <div style={{gridColumn:'span 2'}}>
                  <label style={S.label}>Sono (turno noturno)</label>
                  <input value={form.sono} onChange={e=>upd('sono',e.target.value)} placeholder="Ex: dormiu bem, agitado, insônia..." style={S.input}/>
                </div>
              </div>
            </div>
          </div>

          {/* Col 2 */}
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Evolução de Enfermagem *
              </div>
              <textarea
                value={form.evolucao_texto}
                onChange={e=>upd('evolucao_texto',e.target.value)}
                placeholder="Descreva o estado geral do residente, intercorrências, comportamento, procedimentos realizados..."
                style={{...S.textarea, minHeight:'140px'}}
              />
            </div>

            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Intercorrências
              </div>
              <textarea
                value={form.intercorrencias}
                onChange={e=>upd('intercorrencias',e.target.value)}
                placeholder="Descreva intercorrências ocorridas no turno (queda, febre, vômito, etc.)..."
                style={{...S.textarea, minHeight:'80px'}}
              />
            </div>

            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Medicações Administradas
              </div>
              <textarea
                value={form.medicacoes_administradas}
                onChange={e=>upd('medicacoes_administradas',e.target.value)}
                placeholder="Liste as medicações administradas no turno..."
                style={{...S.textarea, minHeight:'70px'}}
              />
            </div>

            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Pendências para o Próximo Turno
              </div>
              <textarea
                value={form.pendencias_proximo_turno}
                onChange={e=>upd('pendencias_proximo_turno',e.target.value)}
                placeholder="Informe pendências importantes para o próximo plantão..."
                style={{...S.textarea, minHeight:'70px'}}
              />
            </div>

            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={salvarEvolucao} disabled={saving} style={{...S.btn(), flex:1, justifyContent:'center', padding:'12px'}}>
                {saving ? 'Salvando...' : '💾 Salvar Evolução'}
              </button>
              <button onClick={() => setForm({...EMPTY_FORM})} style={{...S.btnSec, padding:'12px 16px'}}>Limpar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal PIN */}
      {pinModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:200
        }}>
          <div style={{background:'#fff', borderRadius:'16px', padding:'28px', width:'360px', boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontSize:'16px', fontWeight:600, marginBottom:'6px'}}>Assinar Evolução</div>
            <div style={{fontSize:'13px', color:'#5c5850', marginBottom:'20px'}}>{pinModal.nome}</div>
            <label style={S.label}>Digite seu PIN de assinatura</label>
            <input
              type="password" value={pin} onChange={e=>setPin(e.target.value)}
              placeholder="••••" maxLength={8}
              style={{...S.input, fontSize:'20px', letterSpacing:'6px', textAlign:'center' as const, marginBottom:'16px'}}
              onKeyDown={e => e.key === 'Enter' && confirmarAssinatura(pinModal.evolucaoId, pin)}
            />
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={() => confirmarAssinatura(pinModal.evolucaoId, pin)} disabled={signing}
                style={{...S.btn(), flex:1, justifyContent:'center'}}>
                {signing ? 'Assinando...' : '✅ Confirmar Assinatura'}
              </button>
              <button onClick={() => { setPinModal(null); setPin('') }} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
