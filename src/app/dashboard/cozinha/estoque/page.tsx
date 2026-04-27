'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ItemEstoque } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  aiBadge: { display:'inline-flex' as const, gap:'4px', background:'#ede9fe', color:'#5b21b6', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 as const },
}

function nivelInfo(item: ItemEstoque) {
  const pct = Math.min(100, Math.round((item.quantidade_atual / (item.quantidade_minima * 1.5)) * 100))
  if (item.quantidade_atual <= item.quantidade_minima * 0.2) return {pct, color:'#dc2626', label:'Crítico', bg:'#fee2e2'}
  if (item.quantidade_atual <= item.quantidade_minima) return {pct, color:'#d97706', label:'Atenção', bg:'#fef3c7'}
  return {pct, color:'#16a34a', label:'OK', bg:'#d8f3dc'}
}

export default function EstoquePage() {
  const supabase = createClient()
  const [itens, setItens] = useState<ItemEstoque[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showEntrada, setShowEntrada] = useState<ItemEstoque|null>(null)
  const [qtdEntrada, setQtdEntrada] = useState('')
  const [form, setForm] = useState({ nome:'', unidade:'kg', quantidade_atual:'', quantidade_minima:'', categoria_id:'', fornecedor:'', custo_unitario:'' })
  const [analisando, setAnalisando] = useState(false)
  const [msg, setMsg] = useState('')
  const [alertas, setAlertas] = useState<any[]>([])

  const upd = (k:string,v:string)=>setForm(f=>({...f,[k]:v}))

  async function load() {
    const { data:cats } = await supabase.from('categorias_estoque').select('*').order('nome')
    setCategorias(cats||[])
    let q = supabase.from('itens_estoque').select('*').order('nome')
    if (filterCat) q = q.eq('categoria_id', filterCat)
    const { data } = await q
    const items = (data||[]) as ItemEstoque[]
    const filtrados = filterStatus ? items.filter(i => {
      const n = nivelInfo(i)
      return filterStatus === 'critico' ? n.label==='Crítico' : filterStatus==='atencao' ? n.label==='Atenção' : n.label==='OK'
    }) : items
    setItens(filtrados)
  }

  useEffect(()=>{ load() },[filterCat, filterStatus])

  async function analisarCompras() {
    setAnalisando(true)
    const res = await fetch('/api/estoque/analisar', { method:'POST' })
    const json = await res.json()
    setAnalisando(false)
    if (json.alertas) { setAlertas(json.alertas); setMsg(`✦ IA identificou ${json.alertas.length} item(ns) para atenção.`) }
    else setMsg('Erro: '+(json.error||''))
    setTimeout(()=>setMsg(''),5000)
  }

  async function salvarItem() {
    if (!form.nome||!form.unidade||!form.quantidade_minima) { setMsg('Preencha nome, unidade e quantidade mínima.'); return }
    const { error } = await supabase.from('itens_estoque').insert({
      nome:form.nome, unidade:form.unidade,
      quantidade_atual: parseFloat(form.quantidade_atual)||0,
      quantidade_minima: parseFloat(form.quantidade_minima),
      categoria_id: form.categoria_id||null,
      fornecedor: form.fornecedor||null,
      custo_unitario: form.custo_unitario?parseFloat(form.custo_unitario):null,
    })
    if (error) setMsg('Erro: '+error.message)
    else { setMsg('Item cadastrado!'); setForm({nome:'',unidade:'kg',quantidade_atual:'',quantidade_minima:'',categoria_id:'',fornecedor:'',custo_unitario:''}); setShowForm(false); load() }
    setTimeout(()=>setMsg(''),3000)
  }

  async function registrarEntrada() {
    if (!showEntrada||!qtdEntrada) return
    const novaQtd = showEntrada.quantidade_atual + parseFloat(qtdEntrada)
    await supabase.from('itens_estoque').update({ quantidade_atual: novaQtd, data_ultima_compra: new Date().toISOString().split('T')[0] }).eq('id',showEntrada.id)
    await supabase.from('movimentacoes_estoque').insert({ item_id:showEntrada.id, tipo:'entrada', quantidade:parseFloat(qtdEntrada), motivo:'Compra' })
    setMsg('Entrada registrada!'); setShowEntrada(null); setQtdEntrada(''); load()
    setTimeout(()=>setMsg(''),3000)
  }

  const criticos = itens.filter(i=>nivelInfo(i).label==='Crítico')
  const atencao = itens.filter(i=>nivelInfo(i).label==='Atenção')

  return (
    <div>
      {msg && <div style={{background:msg.includes('Erro')?'#fee2e2':msg.startsWith('✦')?'#ede9fe':'#d8f3dc',color:msg.includes('Erro')?'#991b1b':msg.startsWith('✦')?'#5b21b6':'#2d6a4f',padding:'12px 16px',borderRadius:'10px',marginBottom:'16px',fontSize:'13px'}}>{msg}</div>}

      {/* Métricas */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px'}}>
        {[
          {label:'Total de Itens', val:itens.length, color:'#1d4e89'},
          {label:'Em Estoque OK', val:itens.filter(i=>nivelInfo(i).label==='OK').length, color:'#2d6a4f'},
          {label:'Atenção', val:atencao.length, color:'#92400e'},
          {label:'Crítico', val:criticos.length, color:'#991b1b'},
        ].map(m=>(
          <div key={m.label} style={{background:'#fff',border:'1px solid #e0dbd0',borderRadius:'12px',padding:'14px 16px'}}>
            <div style={{fontSize:'11px',color:'#9a9588',textTransform:'uppercase' as const,letterSpacing:'.5px',marginBottom:'4px'}}>{m.label}</div>
            <div style={{fontSize:'22px',fontWeight:600,color:m.color}}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Alertas IA */}
      {alertas.length>0 && (
        <div style={{...S.card, marginBottom:'16px', borderColor:'#ddd6fe'}}>
          <div style={{fontWeight:600, fontSize:'13px', color:'#5b21b6', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={S.aiBadge}>✦ Análise IA</span> Previsão de Compras
          </div>
          {alertas.map((a,i)=>(
            <div key={i} style={{display:'flex', alignItems:'flex-start', gap:'12px', padding:'8px 0', borderBottom:'1px solid #f1efe8', fontSize:'13px'}}>
              <span style={{fontWeight:500, minWidth:'160px'}}>{a.item}</span>
              <span style={{color:'#991b1b', fontWeight:600, minWidth:'100px'}}>{a.data_sugerida}</span>
              <span style={{color:'#5c5850'}}>{a.motivo}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros + ações */}
      <div style={{...S.card, marginBottom:'16px', display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' as const}}>
        <div style={{flex:1, minWidth:'150px'}}>
          <label style={S.label}>Categoria</label>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={S.select}>
            <option value="">Todas</option>
            {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div style={{flex:1, minWidth:'130px'}}>
          <label style={S.label}>Status</label>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={S.select}>
            <option value="">Todos</option>
            <option value="critico">Crítico</option>
            <option value="atencao">Atenção</option>
            <option value="ok">OK</option>
          </select>
        </div>
        <button onClick={analisarCompras} disabled={analisando} style={S.btn('#5b21b6')}>
          {analisando?'⏳ Analisando...':'✦ Prever Compras (IA)'}
        </button>
        <button onClick={()=>setShowForm(s=>!s)} style={S.btn()}>+ Novo Item</button>
      </div>

      {/* Form novo item */}
      {showForm && (
        <div style={{...S.card, marginBottom:'16px', borderColor:'#b7e4c7'}}>
          <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Cadastrar Novo Item</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'16px'}}>
            <div style={{gridColumn:'span 2'}}><label style={S.label}>Nome do Item *</label><input value={form.nome} onChange={e=>upd('nome',e.target.value)} style={S.input} placeholder="Ex: Arroz"/></div>
            <div><label style={S.label}>Unidade *</label><select value={form.unidade} onChange={e=>upd('unidade',e.target.value)} style={S.select}><option value="kg">kg</option><option value="L">L (litro)</option><option value="g">g</option><option value="ml">ml</option><option value="unidade">unidade</option><option value="caixa">caixa</option><option value="rolo">rolo</option><option value="dúzia">dúzia</option></select></div>
            <div><label style={S.label}>Qtd. Atual</label><input type="number" step="0.001" value={form.quantidade_atual} onChange={e=>upd('quantidade_atual',e.target.value)} style={S.input} placeholder="0"/></div>
            <div><label style={S.label}>Qtd. Mínima *</label><input type="number" step="0.001" value={form.quantidade_minima} onChange={e=>upd('quantidade_minima',e.target.value)} style={S.input} placeholder="Ex: 10"/></div>
            <div><label style={S.label}>Categoria</label><select value={form.categoria_id} onChange={e=>upd('categoria_id',e.target.value)} style={S.select}><option value="">Selecione...</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div style={{gridColumn:'span 2'}}><label style={S.label}>Fornecedor</label><input value={form.fornecedor} onChange={e=>upd('fornecedor',e.target.value)} style={S.input} placeholder="Nome do fornecedor"/></div>
            <div><label style={S.label}>Custo Unitário (R$)</label><input type="number" step="0.01" value={form.custo_unitario} onChange={e=>upd('custo_unitario',e.target.value)} style={S.input} placeholder="0,00"/></div>
          </div>
          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={salvarItem} style={S.btn()}>💾 Salvar Item</button>
            <button onClick={()=>setShowForm(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela de estoque */}
      <div style={S.card}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#f7f5f0'}}>
              {['Item','Un.','Qtd. Atual','Mínimo','Nível','Fornecedor','Próx. Compra','Status','Ações'].map(h=>(
                <th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.length===0 && <tr><td colSpan={9} style={{padding:'32px', textAlign:'center' as const, color:'#9a9588'}}>Nenhum item cadastrado.</td></tr>}
            {itens.map(item => {
              const n = nivelInfo(item)
              return (
                <tr key={item.id} style={{borderBottom:'1px solid #e0dbd0', background: n.label==='Crítico'?'#fff9f9':'transparent'}}>
                  <td style={{padding:'11px 12px', fontWeight:500}}>{item.nome}</td>
                  <td style={{padding:'11px 12px', color:'#9a9588'}}>{item.unidade}</td>
                  <td style={{padding:'11px 12px', fontWeight:600}}>{item.quantidade_atual}</td>
                  <td style={{padding:'11px 12px', color:'#9a9588'}}>{item.quantidade_minima}</td>
                  <td style={{padding:'11px 12px', minWidth:'120px'}}>
                    <div style={{height:'6px', background:'#f1efe8', borderRadius:'3px', overflow:'hidden', marginBottom:'4px'}}>
                      <div style={{height:'100%', width:`${Math.min(100,n.pct)}%`, background:n.color, borderRadius:'3px'}}/>
                    </div>
                    <span style={{fontSize:'11px', color:n.color}}>{n.pct}%</span>
                  </td>
                  <td style={{padding:'11px 12px', fontSize:'12px', color:'#5c5850'}}>{item.fornecedor||'—'}</td>
                  <td style={{padding:'11px 12px', fontSize:'12px', color: n.label==='Crítico'?'#991b1b':'#5c5850', fontWeight: n.label==='Crítico'?600:400}}>
                    {item.data_proxima_compra ? new Date(item.data_proxima_compra+'T12:00').toLocaleDateString('pt-BR') : '—'}
                    {n.label==='Crítico' && ' ⚠️'}
                  </td>
                  <td style={{padding:'11px 12px'}}>
                    <span style={{padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background:n.bg, color:n.color}}>{n.label}</span>
                  </td>
                  <td style={{padding:'11px 12px'}}>
                    <button onClick={()=>{setShowEntrada(item);setQtdEntrada('')}} style={{...S.btn('#1d4e89'), padding:'5px 10px', fontSize:'11px'}}>+ Entrada</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal entrada */}
      {showEntrada && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
          <div style={{background:'#fff',borderRadius:'16px',padding:'28px',width:'360px',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontSize:'16px',fontWeight:600,marginBottom:'6px'}}>Entrada de Estoque</div>
            <div style={{fontSize:'13px',color:'#5c5850',marginBottom:'16px'}}>{showEntrada.nome} · Atual: {showEntrada.quantidade_atual} {showEntrada.unidade}</div>
            <label style={S.label}>Quantidade recebida ({showEntrada.unidade})</label>
            <input type="number" step="0.001" value={qtdEntrada} onChange={e=>setQtdEntrada(e.target.value)}
              style={{...S.input, fontSize:'18px', textAlign:'center' as const, marginBottom:'16px'}}
              placeholder="0"/>
            {qtdEntrada && <div style={{fontSize:'12px', color:'#9a9588', marginBottom:'16px'}}>Novo total: {showEntrada.quantidade_atual + parseFloat(qtdEntrada||'0')} {showEntrada.unidade}</div>}
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={registrarEntrada} style={{...S.btn(), flex:1, justifyContent:'center'}}>✅ Confirmar</button>
              <button onClick={()=>setShowEntrada(null)} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
