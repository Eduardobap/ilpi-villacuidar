'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { LancamentoFinanceiro, TipoLancamento, StatusFinanceiro } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'60px' },
}

const STATUS_COLORS: Record<string,{bg:string,color:string}> = {
  pendente:{bg:'#fef3c7',color:'#92400e'}, pago:{bg:'#d8f3dc',color:'#2d6a4f'},
  recebido:{bg:'#d8f3dc',color:'#2d6a4f'}, vencido:{bg:'#fee2e2',color:'#991b1b'},
  cancelado:{bg:'#f1efe8',color:'#5f5e5a'}
}

type CobrancaRecorrente = {
  id: string
  descricao: string
  valor: number
  residente_id: string | null
  categoria_id: string | null
  dia_vencimento: number
  ativa: boolean
  observacoes: string | null
  residente?: { nome: string }
}

const FORM_LAN_EMPTY = { descricao:'', valor:'', data_vencimento:'', categoria_id:'', residente_id:'', observacoes:'' }
const FORM_REC_EMPTY = { descricao:'', valor:'', residente_id:'', categoria_id:'', dia_vencimento:'10', observacoes:'' }

type Tab = 'receber' | 'pagar' | 'recorrentes'

export default function FinanceiroPage() {
  const supabase = createClient()
  const { profile } = useAuth()
  const hoje = new Date().toISOString().split('T')[0]
  const mesAtual = hoje.slice(0,7)

  const [tab, setTab] = useState<Tab>('receber')
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [recorrentes, setRecorrentes] = useState<CobrancaRecorrente[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [residentes, setResidentes] = useState<any[]>([])
  const [metricas, setMetricas] = useState({ receberPendente:0, pagarPendente:0, saldoMes:0, vencidos:0 })

  // form lançamento
  const [showFormLan, setShowFormLan] = useState(false)
  const [formLan, setFormLan] = useState({ ...FORM_LAN_EMPTY })
  const [savingLan, setSavingLan] = useState(false)

  // form recorrente
  const [showFormRec, setShowFormRec] = useState(false)
  const [formRec, setFormRec] = useState({ ...FORM_REC_EMPTY })
  const [savingRec, setSavingRec] = useState(false)
  const [gerandoMes, setGerandoMes] = useState(false)

  // filtros
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroIni, setFiltroIni] = useState(mesAtual+'-01')
  const [filtroFim, setFiltroFim] = useState(hoje)

  const [msg, setMsg] = useState('')

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const updL = (k: string, v: string) => setFormLan(f=>({...f,[k]:v}))
  const updR = (k: string, v: string) => setFormRec(f=>({...f,[k]:v}))

  async function load() {
    const [{ data: cats }, { data: res }] = await Promise.all([
      supabase.from('categorias_financeiras').select('*').order('nome'),
      supabase.from('residentes').select('id,nome').eq('status','ativo').order('nome'),
    ])
    setCategorias(cats||[])
    setResidentes(res||[])

    const tipo: TipoLancamento = tab === 'receber' ? 'receber' : 'pagar'

    if (tab !== 'recorrentes') {
      let q = supabase.from('lancamentos_financeiros')
        .select('*, residente:residentes(nome)')
        .eq('tipo', tipo)
        .order('data_vencimento')
      if (filtroStatus !== 'todos') q = q.eq('status', filtroStatus)
      if (filtroIni) q = q.gte('data_vencimento', filtroIni)
      if (filtroFim) q = q.lte('data_vencimento', filtroFim)
      const { data } = await q
      setLancamentos(data||[])
    } else {
      const { data } = await supabase.from('cobrancas_recorrentes')
        .select('*, residente:residentes(nome)')
        .order('descricao')
      setRecorrentes(data||[])
    }

    // métricas globais
    const [{ data: rPend }, { data: pPend }, { data: venc }, { data: mes }] = await Promise.all([
      supabase.from('lancamentos_financeiros').select('valor').eq('tipo','receber').eq('status','pendente'),
      supabase.from('lancamentos_financeiros').select('valor').eq('tipo','pagar').eq('status','pendente'),
      supabase.from('lancamentos_financeiros').select('valor').lt('data_vencimento',hoje).eq('status','pendente'),
      supabase.from('lancamentos_financeiros').select('tipo,valor').in('status',['pago','recebido']).gte('data_vencimento',mesAtual+'-01').lte('data_vencimento',hoje),
    ])
    const saldo = (mes||[]).reduce((s,l) => l.tipo==='receber' ? s+l.valor : s-l.valor, 0)
    setMetricas({
      receberPendente: (rPend||[]).reduce((s,l)=>s+l.valor,0),
      pagarPendente:   (pPend||[]).reduce((s,l)=>s+l.valor,0),
      vencidos:        (venc||[]).reduce((s,l)=>s+l.valor,0),
      saldoMes: saldo,
    })
  }

  useEffect(() => { load() }, [tab, filtroStatus, filtroIni, filtroFim])

  async function salvarLancamento() {
    if (!formLan.descricao||!formLan.valor||!formLan.data_vencimento) { showMsg('Preencha descrição, valor e vencimento.'); return }
    setSavingLan(true)
    const tipo: TipoLancamento = tab === 'pagar' ? 'pagar' : 'receber'
    const { error } = await supabase.from('lancamentos_financeiros').insert({
      tipo, descricao: formLan.descricao, valor: parseFloat(formLan.valor),
      data_vencimento: formLan.data_vencimento,
      categoria_id: formLan.categoria_id||null,
      residente_id: formLan.residente_id||null,
      observacoes: formLan.observacoes||null,
      status: 'pendente', created_by: profile?.id,
    })
    setSavingLan(false)
    if (error) { showMsg('Erro: '+error.message); return }
    showMsg('Lançamento criado!'); setFormLan({...FORM_LAN_EMPTY}); setShowFormLan(false); load()
  }

  async function baixar(id: string, tipo: TipoLancamento) {
    await supabase.from('lancamentos_financeiros').update({
      status: tipo==='receber'?'recebido':'pago',
      data_pagamento: hoje,
    }).eq('id', id)
    load()
  }

  async function cancelar(id: string) {
    await supabase.from('lancamentos_financeiros').update({ status: 'cancelado' }).eq('id', id)
    load()
  }

  async function salvarRecorrente() {
    if (!formRec.descricao||!formRec.valor) { showMsg('Preencha descrição e valor.'); return }
    setSavingRec(true)
    const { error } = await supabase.from('cobrancas_recorrentes').insert({
      descricao: formRec.descricao, valor: parseFloat(formRec.valor),
      residente_id: formRec.residente_id||null,
      categoria_id: formRec.categoria_id||null,
      dia_vencimento: parseInt(formRec.dia_vencimento)||10,
      observacoes: formRec.observacoes||null, ativa: true,
    })
    setSavingRec(false)
    if (error) { showMsg('Erro: '+error.message); return }
    showMsg('Cobrança recorrente cadastrada!'); setFormRec({...FORM_REC_EMPTY}); setShowFormRec(false); load()
  }

  async function toggleRecorrente(id: string, ativa: boolean) {
    await supabase.from('cobrancas_recorrentes').update({ ativa: !ativa }).eq('id', id)
    load()
  }

  async function excluirRecorrente(id: string) {
    if (!confirm('Excluir esta cobrança recorrente?')) return
    await supabase.from('cobrancas_recorrentes').delete().eq('id', id)
    load()
  }

  async function gerarCobrancasMes() {
    const ativas = recorrentes.filter(r => r.ativa)
    if (!ativas.length) { showMsg('Nenhuma cobrança recorrente ativa.'); return }
    setGerandoMes(true)

    const ano = new Date().getFullYear()
    const mes = new Date().getMonth() + 1
    const mesStr = String(mes).padStart(2,'0')

    // verifica quais já foram geradas neste mês (por descrição + mês)
    const { data: jaGeradas } = await supabase.from('lancamentos_financeiros')
      .select('descricao, residente_id')
      .eq('tipo','receber')
      .gte('data_vencimento', `${ano}-${mesStr}-01`)
      .lte('data_vencimento', `${ano}-${mesStr}-31`)

    const geradasSet = new Set((jaGeradas||[]).map(l => `${l.descricao}|${l.residente_id||''}`))

    const novos = ativas.filter(r => !geradasSet.has(`${r.descricao}|${r.residente_id||''}`))
      .map(r => {
        const dia = Math.min(r.dia_vencimento, new Date(ano, mes, 0).getDate())
        return {
          tipo: 'receber' as TipoLancamento,
          descricao: r.descricao,
          valor: r.valor,
          residente_id: r.residente_id,
          categoria_id: r.categoria_id,
          observacoes: r.observacoes,
          data_vencimento: `${ano}-${mesStr}-${String(dia).padStart(2,'0')}`,
          status: 'pendente' as StatusFinanceiro,
          created_by: profile?.id,
        }
      })

    if (!novos.length) { showMsg(`Todas as cobranças deste mês já foram geradas.`); setGerandoMes(false); return }

    const { error } = await supabase.from('lancamentos_financeiros').insert(novos)
    setGerandoMes(false)
    if (error) { showMsg('Erro: '+error.message); return }
    showMsg(`${novos.length} cobrança(s) gerada(s) para ${mesStr}/${ano}!`)
    setTab('receber'); load()
  }

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:2})}`
  const totPendente = lancamentos.filter(l=>l.status==='pendente').reduce((s,l)=>s+l.valor,0)
  const totLiquidado = lancamentos.filter(l=>['pago','recebido'].includes(l.status)).reduce((s,l)=>s+l.valor,0)

  const tabStyle = (t: Tab) => ({
    padding:'9px 20px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer',
    background: tab===t ? '#fff' : 'transparent',
    color: tab===t ? (t==='receber'?'#2d6a4f':t==='pagar'?'#991b1b':'#1d4e89') : '#9a9588',
    border:'none', borderBottom: tab===t ? `2px solid ${t==='receber'?'#40916c':t==='pagar'?'#dc2626':'#1d4e89'}` : '2px solid transparent',
    fontFamily:'inherit',
  })

  return (
    <div>
      {msg && (
        <div style={{background:msg.includes('Erro')?'#fee2e2':'#d8f3dc',color:msg.includes('Erro')?'#991b1b':'#2d6a4f',padding:'12px 16px',borderRadius:'10px',marginBottom:'16px',fontSize:'13px'}}>
          {msg}
        </div>
      )}

      {/* Métricas */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px'}}>
        {[
          { label:'A Receber (pendente)', val:fmtBRL(metricas.receberPendente), color:'#2d6a4f', bg:'#d8f3dc' },
          { label:'A Pagar (pendente)',   val:fmtBRL(metricas.pagarPendente),   color:'#991b1b', bg:'#fee2e2' },
          { label:'Saldo do Mês',         val:fmtBRL(metricas.saldoMes),         color:metricas.saldoMes>=0?'#2d6a4f':'#991b1b', bg:metricas.saldoMes>=0?'#d8f3dc':'#fee2e2' },
          { label:'Vencidos',             val:fmtBRL(metricas.vencidos),         color:metricas.vencidos>0?'#991b1b':'#2d6a4f', bg:metricas.vencidos>0?'#fee2e2':'#d8f3dc' },
        ].map(m => (
          <div key={m.label} style={{background:'#fff', border:'1px solid #e0dbd0', borderRadius:'12px', padding:'16px'}}>
            <div style={{fontSize:'11px', color:'#9a9588', textTransform:'uppercase' as const, letterSpacing:'.5px', marginBottom:'6px'}}>{m.label}</div>
            <div style={{fontSize:'20px', fontWeight:600, color:m.color}}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{display:'flex', borderBottom:'1px solid #e0dbd0', marginBottom:'16px', background:'#fff', borderRadius:'12px 12px 0 0', overflow:'hidden'}}>
        <button style={tabStyle('receber')} onClick={() => setTab('receber')}>↑ Contas a Receber</button>
        <button style={tabStyle('pagar')}   onClick={() => setTab('pagar')}>↓ Contas a Pagar</button>
        <button style={tabStyle('recorrentes')} onClick={() => setTab('recorrentes')}>🔁 Mensalidades Recorrentes</button>
      </div>

      {/* ── RECEBER / PAGAR ─────────────────────────────────── */}
      {tab !== 'recorrentes' && (
        <>
          {/* Filtros + botão */}
          <div style={{...S.card, marginBottom:'16px'}}>
            <div style={{display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' as const, marginBottom:'12px'}}>
              <div style={{flex:1, minWidth:'120px'}}>
                <label style={S.label}>Status</label>
                <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={S.select}>
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value={tab==='receber'?'recebido':'pago'}>{tab==='receber'?'Recebido':'Pago'}</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <label style={S.label}>De</label>
                <input type="date" value={filtroIni} onChange={e=>setFiltroIni(e.target.value)} style={S.input}/>
              </div>
              <div style={{flex:1}}>
                <label style={S.label}>Até</label>
                <input type="date" value={filtroFim} onChange={e=>setFiltroFim(e.target.value)} style={S.input}/>
              </div>
              <button onClick={() => { setShowFormLan(s=>!s); setFormLan({...FORM_LAN_EMPTY}) }}
                style={S.btn(tab==='pagar'?'#dc2626':'#40916c')}>
                + {tab==='receber'?'Nova Receita':'Nova Despesa'}
              </button>
            </div>
            <div style={{fontSize:'13px', color:'#5c5850', display:'flex', gap:'20px', flexWrap:'wrap' as const}}>
              <span>{lancamentos.length} lançamento(s)</span>
              <span style={{color:'#5c5850'}}>Pendente: <strong>{fmtBRL(totPendente)}</strong></span>
              <span style={{color:'#2d6a4f'}}>Liquidado: <strong>{fmtBRL(totLiquidado)}</strong></span>
            </div>
          </div>

          {/* Form novo lançamento */}
          {showFormLan && (
            <div style={{...S.card, marginBottom:'16px', borderColor: tab==='pagar'?'#fca5a5':'#b7e4c7'}}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                {tab==='receber'?'Nova Receita / Cobrança':'Nova Despesa / Conta a Pagar'}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px'}}>
                <div style={{gridColumn:'span 2'}}>
                  <label style={S.label}>Descrição *</label>
                  <input value={formLan.descricao} onChange={e=>updL('descricao',e.target.value)} style={S.input}
                    placeholder={tab==='receber'?'Ex: Mensalidade — João Silva':'Ex: Fornecedor de insumos'}/>
                </div>
                <div>
                  <label style={S.label}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={formLan.valor} onChange={e=>updL('valor',e.target.value)} style={S.input} placeholder="0,00"/>
                </div>
                <div>
                  <label style={S.label}>Vencimento *</label>
                  <input type="date" value={formLan.data_vencimento} onChange={e=>updL('data_vencimento',e.target.value)} style={S.input}/>
                </div>
                <div>
                  <label style={S.label}>Categoria</label>
                  <select value={formLan.categoria_id} onChange={e=>updL('categoria_id',e.target.value)} style={S.select}>
                    <option value="">Selecione...</option>
                    {categorias.filter(c=>c.tipo===(tab==='receber'?'receber':'pagar')).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                {tab==='receber' && (
                  <div>
                    <label style={S.label}>Residente</label>
                    <select value={formLan.residente_id} onChange={e=>updL('residente_id',e.target.value)} style={S.select}>
                      <option value="">Selecione...</option>
                      {residentes.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Observações</label>
                <textarea value={formLan.observacoes} onChange={e=>updL('observacoes',e.target.value)} style={S.textarea} placeholder="Observações adicionais..."/>
              </div>
              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={salvarLancamento} disabled={savingLan} style={S.btn(tab==='pagar'?'#dc2626':'#40916c')}>
                  {savingLan?'Salvando...':'💾 Salvar'}
                </button>
                <button onClick={() => setShowFormLan(false)} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div style={S.card}>
            <div style={{overflowX:'auto' as const}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr style={{background:'#f7f5f0'}}>
                    {['Descrição','Residente','Categoria','Valor','Vencimento','Status','Ação'].map(h=>(
                      <th key={h} style={{padding:'10px 12px', textAlign:'left' as const, fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.length===0 && (
                    <tr><td colSpan={7} style={{padding:'32px', textAlign:'center' as const, color:'#9a9588'}}>
                      Nenhum lançamento no período selecionado.
                    </td></tr>
                  )}
                  {lancamentos.map(l => {
                    const sc = STATUS_COLORS[l.status]||STATUS_COLORS.pendente
                    const vencido = l.status==='pendente' && l.data_vencimento < hoje
                    return (
                      <tr key={l.id} style={{borderBottom:'1px solid #e0dbd0', background: vencido?'#fff9f9':'transparent'}}>
                        <td style={{padding:'11px 12px', fontWeight:500, maxWidth:'200px', overflow:'hidden' as const, textOverflow:'ellipsis', whiteSpace:'nowrap' as const}}>{l.descricao}</td>
                        <td style={{padding:'11px 12px', fontSize:'12px', color:'#9a9588'}}>{(l.residente as any)?.nome||'—'}</td>
                        <td style={{padding:'11px 12px', fontSize:'12px', color:'#9a9588'}}>{categorias.find(c=>c.id===l.categoria_id)?.nome||'—'}</td>
                        <td style={{padding:'11px 12px', fontWeight:600, color: tab==='receber'?'#2d6a4f':'#991b1b'}}>
                          {fmtBRL(l.valor)}
                        </td>
                        <td style={{padding:'11px 12px', fontSize:'12px', color: vencido?'#991b1b':'#5c5850', fontWeight: vencido?600:400}}>
                          {new Date(l.data_vencimento+'T12:00').toLocaleDateString('pt-BR')}
                          {vencido && ' ⚠️'}
                        </td>
                        <td style={{padding:'11px 12px'}}>
                          <span style={{...sc, display:'inline-flex' as const, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500}}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{padding:'11px 12px'}}>
                          <div style={{display:'flex', gap:'6px'}}>
                            {l.status==='pendente' && (
                              <button onClick={() => baixar(l.id, l.tipo)} style={{...S.btn('#1d4e89'), padding:'5px 10px', fontSize:'11px'}}>
                                {l.tipo==='receber'?'Recebido':'Pago'}
                              </button>
                            )}
                            {l.status==='pendente' && (
                              <button onClick={() => cancelar(l.id)} style={{...S.btnSec, fontSize:'11px', padding:'5px 8px', color:'#dc2626'}}>
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── MENSALIDADES RECORRENTES ─────────────────────────── */}
      {tab === 'recorrentes' && (
        <>
          <div style={{...S.card, marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:'12px'}}>
            <div>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'4px'}}>Cobranças Recorrentes</div>
              <div style={{fontSize:'12px', color:'#9a9588'}}>Configure mensalidades e cobranças fixas. Gere os lançamentos do mês com um clique.</div>
            </div>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={gerarCobrancasMes} disabled={gerandoMes} style={S.btn('#1d4e89')}>
                {gerandoMes ? 'Gerando...' : '📅 Gerar cobranças do mês'}
              </button>
              <button onClick={() => { setShowFormRec(s=>!s); setFormRec({...FORM_REC_EMPTY}) }} style={S.btn()}>
                + Nova recorrente
              </button>
            </div>
          </div>

          {/* Form nova recorrente */}
          {showFormRec && (
            <div style={{...S.card, marginBottom:'16px', borderColor:'#b7e4c7'}}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                Nova Cobrança Recorrente
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px'}}>
                <div style={{gridColumn:'span 2'}}>
                  <label style={S.label}>Descrição *</label>
                  <input value={formRec.descricao} onChange={e=>updR('descricao',e.target.value)} style={S.input} placeholder="Ex: Mensalidade"/>
                </div>
                <div>
                  <label style={S.label}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={formRec.valor} onChange={e=>updR('valor',e.target.value)} style={S.input} placeholder="0,00"/>
                </div>
                <div>
                  <label style={S.label}>Residente</label>
                  <select value={formRec.residente_id} onChange={e=>updR('residente_id',e.target.value)} style={S.select}>
                    <option value="">Selecione (opcional)</option>
                    {residentes.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Categoria</label>
                  <select value={formRec.categoria_id} onChange={e=>updR('categoria_id',e.target.value)} style={S.select}>
                    <option value="">Selecione (opcional)</option>
                    {categorias.filter(c=>c.tipo==='receber').map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Dia do Vencimento</label>
                  <input type="number" min="1" max="31" value={formRec.dia_vencimento} onChange={e=>updR('dia_vencimento',e.target.value)} style={S.input}/>
                </div>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Observações</label>
                <textarea value={formRec.observacoes} onChange={e=>updR('observacoes',e.target.value)} style={S.textarea} placeholder="Observações..."/>
              </div>
              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={salvarRecorrente} disabled={savingRec} style={S.btn()}>{savingRec?'Salvando...':'💾 Salvar'}</button>
                <button onClick={() => setShowFormRec(false)} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Lista de recorrentes */}
          <div style={S.card}>
            {recorrentes.length === 0 && (
              <div style={{textAlign:'center' as const, color:'#9a9588', padding:'40px', fontSize:'13px'}}>
                Nenhuma cobrança recorrente cadastrada.<br/>Clique em "+ Nova recorrente" para começar.
              </div>
            )}
            {recorrentes.map(r => (
              <div key={r.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid #f0ece4', flexWrap:'wrap' as const, gap:'8px'}}>
                <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <div style={{
                    width:'10px', height:'10px', borderRadius:'50%',
                    background: r.ativa ? '#40916c' : '#ccc', flexShrink:0
                  }}/>
                  <div>
                    <div style={{fontWeight:500, fontSize:'13px'}}>{r.descricao}</div>
                    <div style={{fontSize:'11px', color:'#9a9588', marginTop:'2px'}}>
                      {(r.residente as any)?.nome ? `${(r.residente as any).nome} · ` : ''}
                      Vence dia {r.dia_vencimento} · {r.ativa ? 'Ativa' : 'Inativa'}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
                  <div style={{fontWeight:600, fontSize:'15px', color:'#2d6a4f'}}>{fmtBRL(r.valor)}</div>
                  <div style={{display:'flex', gap:'6px'}}>
                    <button onClick={() => toggleRecorrente(r.id, r.ativa)} style={{...S.btnSec, fontSize:'12px', padding:'5px 10px'}}>
                      {r.ativa ? 'Pausar' : 'Ativar'}
                    </button>
                    <button onClick={() => excluirRecorrente(r.id)} style={{...S.btnSec, fontSize:'12px', padding:'5px 10px', color:'#dc2626'}}>
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
