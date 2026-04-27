'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Cardapio, ItemEstoque } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'80px' },
}

const REFEICOES = ['cafe','almoco','lanche','jantar'] as const
const REFEICAO_LABELS: Record<string,string> = { cafe:'☕ Café da Manhã', almoco:'🍽 Almoço', lanche:'🍎 Lanche', jantar:'🌙 Jantar' }
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function semanaAtual() {
  const hoje = new Date()
  const dom = new Date(hoje)
  dom.setDate(hoje.getDate() - hoje.getDay())
  return Array.from({length:7}, (_,i) => {
    const d = new Date(dom)
    d.setDate(dom.getDate()+i)
    return d.toISOString().split('T')[0]
  })
}

export default function CardapioPage() {
  const supabase = createClient()
  const [semana, setSemana] = useState<string[]>(semanaAtual())
  const [cardapios, setCardapios] = useState<Cardapio[]>([])
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ data: semana[0], refeicao:'almoco', descricao:'', ingredientes:'' })
  const [ingredientesForm, setIngredientesForm] = useState<{item_estoque_id:string; quantidade_por_pessoa:string}[]>([])

  const upd = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  async function load() {
    const { data } = await supabase.from('cardapio')
      .select('*, ingredientes:receitas_ingredientes(*, item:itens_estoque(nome,unidade))')
      .gte('data', semana[0]).lte('data', semana[6]).order('data').order('refeicao')
    setCardapios(data||[])
    const { data: estoq } = await supabase.from('itens_estoque').select('id,nome,unidade,quantidade_atual').order('nome')
    setItensEstoque(estoq||[])
  }

  useEffect(()=>{ load() },[semana])

  function navegarSemana(dir: 1|-1) {
    setSemana(s => s.map(d => {
      const dt = new Date(d+'T12:00')
      dt.setDate(dt.getDate() + dir*7)
      return dt.toISOString().split('T')[0]
    }))
  }

  async function salvar() {
    if (!form.data||!form.refeicao||!form.descricao) { setMsg('Preencha data, refeição e descrição.'); return }
    setSaving(true)
    const { data: card, error } = await supabase.from('cardapio').insert({ data:form.data, refeicao:form.refeicao, descricao:form.descricao }).select().single()
    if (error) { setMsg('Erro: '+error.message); setSaving(false); return }
    // Salvar ingredientes
    const ings = ingredientesForm.filter(i=>i.item_estoque_id&&i.quantidade_por_pessoa)
    if (ings.length>0 && card) {
      await supabase.from('receitas_ingredientes').insert(ings.map(i=>({ cardapio_id:card.id, item_estoque_id:i.item_estoque_id, quantidade_por_pessoa:parseFloat(i.quantidade_por_pessoa), numero_porcoes:60 })))
    }
    setSaving(false); setMsg('Refeição cadastrada!'); setShowForm(false); setIngredientesForm([]); load()
    setTimeout(()=>setMsg(''),3000)
  }

  // Organizar por dia e refeição
  function getRefeicao(data: string, ref: string) {
    return cardapios.filter(c=>c.data===data&&c.refeicao===ref)
  }

  // Verificar impacto no estoque
  function impactoEstoque(data: string): 'ok'|'atencao'|'critico' {
    const refs = cardapios.filter(c=>c.data===data)
    let status:'ok'|'atencao'|'critico' = 'ok'
    for (const ref of refs) {
      for (const ing of (ref.ingredientes||[])) {
        const item = itensEstoque.find(i=>i.id===(ing as any).item_estoque_id)
        if (!item) continue
        const qtdNec = (ing as any).quantidade_por_pessoa * (ing as any).numero_porcoes
        if (item.quantidade_atual < qtdNec * 0.5) status = 'critico'
        else if (item.quantidade_atual < qtdNec && status !== 'critico') status = 'atencao'
      }
    }
    return status
  }

  return (
    <div>
      {msg && <div style={{background:msg.includes('Erro')?'#fee2e2':'#d8f3dc',color:msg.includes('Erro')?'#991b1b':'#2d6a4f',padding:'12px 16px',borderRadius:'10px',marginBottom:'16px',fontSize:'13px'}}>{msg}</div>}

      {/* Navegação de semana */}
      <div style={{...S.card, marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <button onClick={()=>navegarSemana(-1)} style={S.btnSec}>← Semana anterior</button>
        <div style={{fontWeight:600, fontSize:'14px'}}>
          {new Date(semana[0]+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})} — {new Date(semana[6]+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}
        </div>
        <div style={{display:'flex', gap:'10px'}}>
          <button onClick={()=>navegarSemana(1)} style={S.btnSec}>Próxima semana →</button>
          <button onClick={()=>{ setForm({data:semana[1],refeicao:'almoco',descricao:'',ingredientes:''}); setShowForm(s=>!s) }} style={S.btn()}>+ Adicionar Refeição</button>
        </div>
      </div>

      {/* Form nova refeição */}
      {showForm && (
        <div style={{...S.card, marginBottom:'16px', borderColor:'#b7e4c7'}}>
          <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Nova Refeição</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px'}}>
            <div><label style={S.label}>Data *</label><select value={form.data} onChange={e=>upd('data',e.target.value)} style={S.select}>{semana.map((d,i)=><option key={d} value={d}>{DIAS_SEMANA[i]} — {new Date(d+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</option>)}</select></div>
            <div><label style={S.label}>Refeição *</label><select value={form.refeicao} onChange={e=>upd('refeicao',e.target.value)} style={S.select}>{REFEICOES.map(r=><option key={r} value={r}>{REFEICAO_LABELS[r]}</option>)}</select></div>
          </div>
          <div style={{marginBottom:'12px'}}><label style={S.label}>Descrição *</label><textarea value={form.descricao} onChange={e=>upd('descricao',e.target.value)} style={{...S.textarea, minHeight:'60px'}} placeholder="Ex: Frango grelhado, arroz, feijão, salada verde"/></div>

          <div style={{fontWeight:500, fontSize:'13px', color:'#5c5850', marginBottom:'8px'}}>Ingredientes (para cálculo de estoque)</div>
          {ingredientesForm.map((ing, idx)=>(
            <div key={idx} style={{display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'8px', marginBottom:'8px'}}>
              <select value={ing.item_estoque_id} onChange={e=>{ const n=[...ingredientesForm]; n[idx].item_estoque_id=e.target.value; setIngredientesForm(n) }} style={S.select}>
                <option value="">Selecione o ingrediente...</option>
                {itensEstoque.map(i=><option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
              </select>
              <input type="number" step="0.001" value={ing.quantidade_por_pessoa} onChange={e=>{ const n=[...ingredientesForm]; n[idx].quantidade_por_pessoa=e.target.value; setIngredientesForm(n) }} placeholder="Qtd. por pessoa" style={S.input}/>
              <button onClick={()=>setIngredientesForm(f=>f.filter((_,i)=>i!==idx))} style={{...S.btnSec, color:'#991b1b'}}>✕</button>
            </div>
          ))}
          <button onClick={()=>setIngredientesForm(f=>[...f,{item_estoque_id:'',quantidade_por_pessoa:''}])} style={{...S.btnSec, marginBottom:'16px', fontSize:'12px'}}>+ Adicionar ingrediente</button>

          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={salvar} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar Refeição'}</button>
            <button onClick={()=>{ setShowForm(false); setIngredientesForm([]) }} style={S.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Grade semanal */}
      <div style={{overflowX:'auto' as const}}>
        <table style={{width:'100%', borderCollapse:'separate', borderSpacing:'0 0', fontSize:'13px'}}>
          <thead>
            <tr>
              <th style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#9a9588', textTransform:'uppercase' as const, width:'120px'}}>Refeição</th>
              {semana.map((d,i)=>{
                const imp = impactoEstoque(d)
                const isHoje = d===new Date().toISOString().split('T')[0]
                return (
                  <th key={d} style={{padding:'10px 8px', textAlign:'center', fontSize:'12px', fontWeight:600, color: isHoje?'#40916c':'#1a1814', background: isHoje?'#d8f3dc':'transparent', borderRadius: isHoje?'8px 8px 0 0':0}}>
                    <div>{DIAS_SEMANA[i]}</div>
                    <div style={{fontSize:'11px', fontWeight:400, color: isHoje?'#2d6a4f':'#9a9588'}}>{new Date(d+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</div>
                    {imp!=='ok' && <div style={{fontSize:'10px', color: imp==='critico'?'#991b1b':'#92400e', marginTop:'2px'}}>{imp==='critico'?'⚠️ Estoque crítico':'⚡ Atenção'}</div>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {REFEICOES.map(ref=>(
              <tr key={ref}>
                <td style={{padding:'12px', background:'#f7f5f0', fontWeight:500, fontSize:'12px', borderBottom:'1px solid #e0dbd0', borderRadius:'8px', whiteSpace:'nowrap' as const}}>{REFEICAO_LABELS[ref]}</td>
                {semana.map(d=>{
                  const items = getRefeicao(d, ref)
                  const isHoje = d===new Date().toISOString().split('T')[0]
                  return (
                    <td key={d} style={{padding:'8px', verticalAlign:'top', borderBottom:'1px solid #e0dbd0', background: isHoje?'#f7fff9':'transparent', minWidth:'130px'}}>
                      {items.length===0 ? (
                        <div style={{color:'#e0dbd0', fontSize:'11px', textAlign:'center' as const, padding:'8px 0'}}>—</div>
                      ) : items.map(c=>(
                        <div key={c.id} style={{background:'#fff', border:'1px solid #e0dbd0', borderRadius:'8px', padding:'8px', fontSize:'12px', lineHeight:'1.5'}}>
                          {c.descricao}
                          {(c.ingredientes||[]).length>0 && (
                            <div style={{marginTop:'4px', paddingTop:'4px', borderTop:'1px solid #f1efe8'}}>
                              {(c.ingredientes||[]).map((ing: any,ii: number)=>(
                                <div key={ii} style={{fontSize:'10px', color:'#9a9588'}}>{ing.item?.nome}: {ing.quantidade_por_pessoa}{ing.item?.unidade}/p</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
