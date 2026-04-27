'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit', display:'inline-flex' as const, alignItems:'center' as const, gap:'6px' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  aiBadge: { display:'inline-flex' as const, alignItems:'center' as const, gap:'4px', background:'#ede9fe', color:'#5b21b6', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 as const },
}

const STATUS_MAP: Record<string,{label:string,bg:string,color:string}> = {
  conciliado:{label:'✓ Conciliado',bg:'#d8f3dc',color:'#2d6a4f'},
  divergencia:{label:'⚠ Divergência',bg:'#fef3c7',color:'#92400e'},
  nao_conciliado:{label:'Não identificado',bg:'#dbeafe',color:'#1d4e89'},
}

export default function ExtratoPage() {
  const supabase = createClient()
  const [extrato, setExtrato] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [msg, setMsg] = useState('')
  const [resumo, setResumo] = useState({ creditos:0, debitos:0, saldo:0, conciliados:0, pendentes:0 })

  async function load() {
    const { data } = await supabase.from('extrato_bancario').select('*').order('data_lancamento',{ascending:false}).limit(100)
    const rows = data||[]
    setExtrato(rows)
    setResumo({
      creditos: rows.filter(r=>r.valor>0).reduce((s:number,r:any)=>s+r.valor,0),
      debitos: rows.filter(r=>r.valor<0).reduce((s:number,r:any)=>s+Math.abs(r.valor),0),
      saldo: rows.reduce((s:number,r:any)=>s+r.valor,0),
      conciliados: rows.filter(r=>r.status_conciliacao==='conciliado').length,
      pendentes: rows.filter(r=>r.status_conciliacao!=='conciliado').length,
    })
  }

  useEffect(() => { load() }, [])

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    const text = await file.text()
    const rows = text.trim().split('\n').slice(1)
    const lancamentos = rows.map(row => {
      const cols = row.split(';')
      const valor = parseFloat((cols[2]||'0').replace(',','.').replace('R$','').trim())
      return { data_lancamento: cols[0]?.trim()||new Date().toISOString().split('T')[0], descricao_banco: cols[1]?.trim()||'Lançamento importado', valor }
    }).filter(l => !isNaN(l.valor) && l.descricao_banco)

    if (lancamentos.length > 0) {
      await supabase.from('extrato_bancario').insert(lancamentos)
      setMsg(`${lancamentos.length} lançamentos importados! Use "Analisar com IA" para categorizar.`)
    }
    setLoading(false); load()
    setTimeout(() => setMsg(''), 5000)
    e.target.value = ''
  }

  async function analisarComIA() {
    const nao_categorizados = extrato.filter(r => !r.categoria_ia)
    if (nao_categorizados.length === 0) { setMsg('Todos os lançamentos já foram analisados.'); return }
    setAnalisando(true)
    setMsg(`Analisando ${nao_categorizados.length} lançamentos com IA...`)
    const res = await fetch('/api/extrato/analisar', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ids: nao_categorizados.map(r=>r.id) })
    })
    const json = await res.json()
    setAnalisando(false)
    setMsg(json.ok ? `✅ ${json.atualizados} lançamentos categorizados e conciliados!` : 'Erro: '+json.error)
    load(); setTimeout(() => setMsg(''), 5000)
  }

  async function marcarConciliado(id: string) {
    await supabase.from('extrato_bancario').update({status_conciliacao:'conciliado'}).eq('id',id)
    load()
  }

  return (
    <div>
      {msg && <div style={{background:msg.includes('Erro')?'#fee2e2':msg.startsWith('✅')?'#d8f3dc':'#dbeafe',color:msg.includes('Erro')?'#991b1b':msg.startsWith('✅')?'#2d6a4f':'#1d4e89',padding:'12px 16px',borderRadius:'10px',marginBottom:'16px',fontSize:'13px'}}>{msg}</div>}

      {/* Resumo */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'20px'}}>
        {[
          {label:'Créditos', val:`R$ ${resumo.creditos.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'#2d6a4f'},
          {label:'Débitos', val:`R$ ${resumo.debitos.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'#991b1b'},
          {label:'Saldo Extrato', val:`R$ ${resumo.saldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color: resumo.saldo>=0?'#2d6a4f':'#991b1b'},
          {label:'Conciliados', val:resumo.conciliados.toString(), color:'#2d6a4f'},
          {label:'Pendentes', val:resumo.pendentes.toString(), color: resumo.pendentes>0?'#92400e':'#2d6a4f'},
        ].map(m=>(
          <div key={m.label} style={{background:'#fff',border:'1px solid #e0dbd0',borderRadius:'12px',padding:'14px 16px'}}>
            <div style={{fontSize:'11px',color:'#9a9588',textTransform:'uppercase' as const,letterSpacing:'.5px',marginBottom:'4px'}}>{m.label}</div>
            <div style={{fontSize:'20px',fontWeight:600,color:m.color}}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div style={{...S.card, marginBottom:'16px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:'12px'}}>
          <div>
            <div style={{fontWeight:600, fontSize:'14px', marginBottom:'4px'}}>Importar e Analisar Extrato</div>
            <div style={{fontSize:'12px', color:'#9a9588'}}>Formatos suportados: CSV (separado por ponto-e-vírgula: Data;Descrição;Valor)</div>
          </div>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <label style={{...S.btn('#1d4e89'), cursor:'pointer'}}>
              📤 Importar CSV
              <input type="file" accept=".csv,.txt" onChange={importarCSV} style={{display:'none'}}/>
            </label>
            <button onClick={analisarComIA} disabled={analisando} style={S.btn('#5b21b6')}>
              {analisando ? '⏳ Analisando...' : '✦ Analisar com IA'}
            </button>
            <span style={S.aiBadge}>✦ IA categoriza e concilia</span>
          </div>
        </div>
        <div style={{marginTop:'12px', padding:'10px 14px', background:'#f7f5f0', borderRadius:'8px', fontSize:'12px', color:'#5c5850'}}>
          💡 A IA identifica cada lançamento, categoriza automaticamente (mensalidade, fornecedor, folha, etc.) e cruza com os títulos cadastrados para conciliação automática.
        </div>
      </div>

      {/* Tabela */}
      <div style={S.card}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#f7f5f0'}}>
              {['Data','Descrição Bancária','Categoria IA','Valor','Conciliação','Ação'].map(h=>(
                <th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {extrato.length===0 && (
              <tr><td colSpan={6} style={{padding:'40px', textAlign:'center' as const, color:'#9a9588'}}>
                Nenhum lançamento importado ainda. Importe um arquivo CSV do seu banco.
              </td></tr>
            )}
            {extrato.map(row => {
              const sc = STATUS_MAP[row.status_conciliacao]||STATUS_MAP.nao_conciliado
              return (
                <tr key={row.id} style={{borderBottom:'1px solid #e0dbd0'}}>
                  <td style={{padding:'11px 12px', whiteSpace:'nowrap' as const}}>{new Date(row.data_lancamento+'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{padding:'11px 12px', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const}}>{row.descricao_banco}</td>
                  <td style={{padding:'11px 12px'}}>
                    {row.categoria_ia ? (
                      <span style={{fontSize:'11px', background:'#f1efe8', color:'#5f5e5a', padding:'2px 8px', borderRadius:'20px'}}>{row.categoria_ia}</span>
                    ) : (
                      <span style={{fontSize:'11px', color:'#9a9588'}}>—</span>
                    )}
                  </td>
                  <td style={{padding:'11px 12px', fontWeight:600, color: row.valor>0?'#2d6a4f':'#991b1b', whiteSpace:'nowrap' as const}}>
                    {row.valor>0?'+':''} R$ {Math.abs(row.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                  </td>
                  <td style={{padding:'11px 12px'}}>
                    <span style={{display:'inline-flex', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background:sc.bg, color:sc.color}}>{sc.label}</span>
                  </td>
                  <td style={{padding:'11px 12px'}}>
                    {row.status_conciliacao !== 'conciliado' && (
                      <button onClick={() => marcarConciliado(row.id)} style={{...S.btnSec, padding:'5px 10px', fontSize:'11px'}}>Conciliar</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
