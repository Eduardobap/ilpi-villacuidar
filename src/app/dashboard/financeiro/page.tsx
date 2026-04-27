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
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'70px' },
}

const STATUS_COLORS: Record<string,{bg:string,color:string}> = {
  pendente:{bg:'#fef3c7',color:'#92400e'}, pago:{bg:'#d8f3dc',color:'#2d6a4f'},
  recebido:{bg:'#d8f3dc',color:'#2d6a4f'}, vencido:{bg:'#fee2e2',color:'#991b1b'},
  cancelado:{bg:'#f1efe8',color:'#5f5e5a'}
}

const FORM_EMPTY = { tipo:'receber' as TipoLancamento, descricao:'', valor:'', data_vencimento:'', categoria_id:'', observacoes:'' }

export default function FinanceiroPage() {
  const supabase = createClient()
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [residentes, setResidentes] = useState<any[]>([])
  const [form, setForm] = useState({...FORM_EMPTY})
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const hoje = new Date().toISOString().split('T')[0]
  const [filtros, setFiltros] = useState({ tipo:'todos', status:'todos', dataIni: hoje.slice(0,7)+'-01', dataFim: hoje })
  const [metricas, setMetricas] = useState({ receberHoje:0, pagarHoje:0, saldoMes:0, vencidos:0 })

  const upd = (k: string, v: string) => setForm(f=>({...f,[k]:v}))
  const updF = (k: string, v: string) => setFiltros(f=>({...f,[k]:v}))

  async function load() {
    const { data: cats } = await supabase.from('categorias_financeiras').select('*').order('nome')
    setCategorias(cats||[])
    const { data: res } = await supabase.from('residentes').select('id,nome').eq('status','ativo').order('nome')
    setResidentes(res||[])

    let q = supabase.from('lancamentos_financeiros').select('*, residente:residentes(nome)').order('data_vencimento')
    if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo)
    if (filtros.status !== 'todos') q = q.eq('status', filtros.status)
    if (filtros.dataIni) q = q.gte('data_vencimento', filtros.dataIni)
    if (filtros.dataFim) q = q.lte('data_vencimento', filtros.dataFim)
    const { data } = await q
    setLancamentos(data||[])

    // métricas do dia
    const { data: rHoje } = await supabase.from('lancamentos_financeiros').select('valor').eq('data_vencimento',hoje).eq('tipo','receber').in('status',['pendente'])
    const { data: pHoje } = await supabase.from('lancamentos_financeiros').select('valor').eq('data_vencimento',hoje).eq('tipo','pagar').in('status',['pendente'])
    const { data: venc } = await supabase.from('lancamentos_financeiros').select('valor').lt('data_vencimento',hoje).eq('status','pendente')
    const { data: mes } = await supabase.from('lancamentos_financeiros').select('tipo,valor').in('status',['pago','recebido']).gte('data_vencimento',hoje.slice(0,7)+'-01').lte('data_vencimento',hoje)
    const saldo = (mes||[]).reduce((s,l) => l.tipo==='receber' ? s+l.valor : s-l.valor, 0)
    setMetricas({
      receberHoje: (rHoje||[]).reduce((s,l)=>s+l.valor,0),
      pagarHoje: (pHoje||[]).reduce((s,l)=>s+l.valor,0),
      vencidos: (venc||[]).reduce((s,l)=>s+l.valor,0),
      saldoMes: saldo
    })
  }

  useEffect(() => { load() }, [filtros])

  async function salvar() {
    if (!form.descricao||!form.valor||!form.data_vencimento) { setMsg('Preencha descrição, valor e vencimento.'); return }
    setSaving(true)
    const { error } = await supabase.from('lancamentos_financeiros').insert({
      tipo: form.tipo, descricao: form.descricao, valor: parseFloat(form.valor),
      data_vencimento: form.data_vencimento, categoria_id: form.categoria_id||null,
      observacoes: form.observacoes||null, status: 'pendente',
    })
    setSaving(false)
    if (error) { setMsg('Erro: '+error.message); return }
    setMsg('Lançamento criado!'); setForm({...FORM_EMPTY}); setShowForm(false); load()
    setTimeout(() => setMsg(''), 3000)
  }

  async function baixar(id: string, tipo: TipoLancamento) {
    await supabase.from('lancamentos_financeiros').update({
      status: tipo==='receber'?'recebido':'pago',
      data_pagamento: hoje,
    }).eq('id', id)
    load()
  }

  const totReceber = lancamentos.filter(l=>l.tipo==='receber'&&l.status==='pendente').reduce((s,l)=>s+l.valor,0)
  const totPagar = lancamentos.filter(l=>l.tipo==='pagar'&&l.status==='pendente').reduce((s,l)=>s+l.valor,0)

  return (
    <div>
      {msg && <div style={{background:msg.includes('Erro')?'#fee2e2':'#d8f3dc',color:msg.includes('Erro')?'#991b1b':'#2d6a4f',padding:'12px 16px',borderRadius:'10px',marginBottom:'16px',fontSize:'13px'}}>{msg}</div>}

      {/* Dashboard do dia */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px'}}>
        {[
          {label:'A Receber Hoje', val:`R$ ${metricas.receberHoje.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'#2d6a4f', bg:'#d8f3dc'},
          {label:'A Pagar Hoje', val:`R$ ${metricas.pagarHoje.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'#991b1b', bg:'#fee2e2'},
          {label:'Saldo do Mês', val:`R$ ${metricas.saldoMes.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color: metricas.saldoMes>=0?'#2d6a4f':'#991b1b', bg: metricas.saldoMes>=0?'#d8f3dc':'#fee2e2'},
          {label:'Vencidos', val:`R$ ${metricas.vencidos.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color: metricas.vencidos>0?'#991b1b':'#2d6a4f', bg: metricas.vencidos>0?'#fee2e2':'#d8f3dc'},
        ].map(m => (
          <div key={m.label} style={{background:'#fff', border:'1px solid #e0dbd0', borderRadius:'12px', padding:'16px'}}>
            <div style={{fontSize:'11px', color:'#9a9588', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'6px'}}>{m.label}</div>
            <div style={{fontSize:'22px', fontWeight:600, color:m.color}}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{...S.card, marginBottom:'16px'}}>
        <div style={{display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' as const, marginBottom:'12px'}}>
          <div style={{flex:1, minWidth:'120px'}}><label style={S.label}>Tipo</label><select value={filtros.tipo} onChange={e=>updF('tipo',e.target.value)} style={S.select}><option value="todos">Todos</option><option value="receber">A Receber</option><option value="pagar">A Pagar</option></select></div>
          <div style={{flex:1, minWidth:'120px'}}><label style={S.label}>Status</label><select value={filtros.status} onChange={e=>updF('status',e.target.value)} style={S.select}><option value="todos">Todos</option><option value="pendente">Pendente</option><option value="recebido">Recebido</option><option value="pago">Pago</option><option value="vencido">Vencido</option></select></div>
          <div style={{flex:1}}><label style={S.label}>De</label><input type="date" value={filtros.dataIni} onChange={e=>updF('dataIni',e.target.value)} style={S.input}/></div>
          <div style={{flex:1}}><label style={S.label}>Até</label><input type="date" value={filtros.dataFim} onChange={e=>updF('dataFim',e.target.value)} style={S.input}/></div>
          <button onClick={() => setShowForm(s=>!s)} style={S.btn()}>+ Novo Lançamento</button>
        </div>
        <div style={{fontSize:'13px', color:'#5c5850', display:'flex', gap:'20px'}}>
          <span>📊 {lancamentos.length} lançamento(s) no período</span>
          <span style={{color:'#2d6a4f'}}>↑ A receber: R$ {totReceber.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span style={{color:'#991b1b'}}>↓ A pagar: R$ {totPagar.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
        </div>
      </div>

      {/* Form novo lançamento */}
      {showForm && (
        <div style={{...S.card, marginBottom:'16px', borderColor:'#b7e4c7'}}>
          <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Novo Lançamento</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px'}}>
            <div><label style={S.label}>Tipo *</label><select value={form.tipo} onChange={e=>upd('tipo',e.target.value)} style={S.select}><option value="receber">A Receber</option><option value="pagar">A Pagar</option></select></div>
            <div><label style={S.label}>Valor (R$) *</label><input type="number" step="0.01" value={form.valor} onChange={e=>upd('valor',e.target.value)} style={S.input} placeholder="0,00"/></div>
            <div><label style={S.label}>Vencimento *</label><input type="date" value={form.data_vencimento} onChange={e=>upd('data_vencimento',e.target.value)} style={S.input}/></div>
            <div style={{gridColumn:'span 2'}}><label style={S.label}>Descrição *</label><input value={form.descricao} onChange={e=>upd('descricao',e.target.value)} style={S.input} placeholder="Ex: Mensalidade — Nome do residente"/></div>
            <div><label style={S.label}>Categoria</label><select value={form.categoria_id} onChange={e=>upd('categoria_id',e.target.value)} style={S.select}><option value="">Selecione...</option>{categorias.filter(c=>c.tipo===form.tipo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          </div>
          <div style={{marginBottom:'16px'}}><label style={S.label}>Observações</label><textarea value={form.observacoes} onChange={e=>upd('observacoes',e.target.value)} style={{...S.textarea, minHeight:'56px'}} placeholder="Observações adicionais..."/></div>
          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={salvar} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar'}</button>
            <button onClick={() => setShowForm(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div style={S.card}>
        <div style={{overflowX:'auto' as const}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr style={{background:'#f7f5f0'}}>
                {['Tipo','Descrição','Categoria','Valor','Vencimento','Status','Ação'].map(h=>(
                  <th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentos.length===0 && <tr><td colSpan={7} style={{padding:'32px', textAlign:'center' as const, color:'#9a9588'}}>Nenhum lançamento no período selecionado.</td></tr>}
              {lancamentos.map(l => {
                const sc = STATUS_COLORS[l.status]||STATUS_COLORS.pendente
                const vencido = l.status==='pendente' && l.data_vencimento < hoje
                return (
                  <tr key={l.id} style={{borderBottom:'1px solid #e0dbd0', background: vencido?'#fff9f9':'transparent'}}>
                    <td style={{padding:'11px 12px'}}>
                      <span style={{padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background:l.tipo==='receber'?'#d8f3dc':'#fee2e2', color:l.tipo==='receber'?'#2d6a4f':'#991b1b'}}>
                        {l.tipo==='receber'?'↑ Receber':'↓ Pagar'}
                      </span>
                    </td>
                    <td style={{padding:'11px 12px', fontWeight:500, maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const}}>{l.descricao}</td>
                    <td style={{padding:'11px 12px', fontSize:'12px', color:'#9a9588'}}>{categorias.find(c=>c.id===l.categoria_id)?.nome||'—'}</td>
                    <td style={{padding:'11px 12px', fontWeight:600, color:l.tipo==='receber'?'#2d6a4f':'#991b1b'}}>
                      R$ {l.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    </td>
                    <td style={{padding:'11px 12px', fontSize:'12px', color: vencido?'#991b1b':'#5c5850', fontWeight: vencido?600:400}}>
                      {new Date(l.data_vencimento+'T12:00').toLocaleDateString('pt-BR')}
                      {vencido && ' ⚠️'}
                    </td>
                    <td style={{padding:'11px 12px'}}><span style={{...sc, display:'inline-flex', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500}}>{l.status}</span></td>
                    <td style={{padding:'11px 12px'}}>
                      {['pendente'].includes(l.status) && (
                        <button onClick={() => baixar(l.id, l.tipo)} style={{...S.btn('#1d4e89'), padding:'5px 12px', fontSize:'11px'}}>
                          {l.tipo==='receber'?'Recebido':'Pago'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
