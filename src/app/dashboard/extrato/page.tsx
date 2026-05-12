'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { PERMISSIONS } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit', display:'inline-flex' as const, alignItems:'center' as const, gap:'6px' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'8px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'8px 10px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'12px', fontFamily:'inherit', boxSizing:'border-box' as const, background:'#fff' },
}

const STATUS_MAP: Record<string,{label:string,bg:string,color:string}> = {
  conciliado:    { label:'✓ Lançado',        bg:'#d8f3dc', color:'#2d6a4f' },
  nao_conciliado:{ label:'Aguardando',        bg:'#fef3c7', color:'#92400e' },
  divergencia:   { label:'⚠ Divergência',    bg:'#fef3c7', color:'#92400e' },
}

type Tab = 'extrato' | 'categorias'

export default function ExtratoPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('extrato')
  const [extrato, setExtrato] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [msg, setMsg] = useState('')
  const [resumo, setResumo] = useState({ creditos:0, debitos:0, saldo:0, lancados:0, pendentes:0 })

  // seleções locais: extrato_id → categoria_id
  const [selecoes, setSelecoes] = useState<Record<string, string>>({})

  // form nova categoria
  const [formCat, setFormCat] = useState({ nome:'', tipo:'pagar' })
  const [salvandoCat, setSalvandoCat] = useState(false)

  useEffect(() => {
    if (profile && !PERMISSIONS.canAccessFinanceiro(profile.role)) router.push('/dashboard')
  }, [profile])

  useEffect(() => { loadExtrato(); loadCategorias() }, [])

  async function loadExtrato() {
    const { data } = await supabase
      .from('extrato_bancario')
      .select('*')
      .order('data_lancamento', { ascending: false })
      .limit(200)
    const rows = data || []
    setExtrato(rows)
    setResumo({
      creditos:  rows.filter(r => r.valor > 0).reduce((s:number, r:any) => s + r.valor, 0),
      debitos:   rows.filter(r => r.valor < 0).reduce((s:number, r:any) => s + Math.abs(r.valor), 0),
      saldo:     rows.reduce((s:number, r:any) => s + r.valor, 0),
      lancados:  rows.filter(r => r.status_conciliacao === 'conciliado').length,
      pendentes: rows.filter(r => r.status_conciliacao !== 'conciliado').length,
    })
  }

  async function loadCategorias() {
    const { data } = await supabase.from('categorias_financeiras').select('*').order('tipo').order('nome')
    setCategorias(data || [])
  }

  const showMsg = (m: string, dur = 6000) => { setMsg(m); setTimeout(() => setMsg(''), dur) }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    const text = await file.text()
    const linhas = text.trim().split('\n').slice(1)
    const lancamentos = linhas.map(row => {
      const cols = row.split(';')
      const valor = parseFloat((cols[2] || '0').replace(',', '.').replace('R$', '').trim())
      return {
        data_lancamento: cols[0]?.trim() || new Date().toISOString().split('T')[0],
        descricao_banco: cols[1]?.trim() || 'Lançamento importado',
        valor,
        status_conciliacao: 'nao_conciliado',
      }
    }).filter(l => !isNaN(l.valor) && l.descricao_banco)

    if (lancamentos.length > 0) {
      await supabase.from('extrato_bancario').insert(lancamentos)
      showMsg(`${lancamentos.length} lançamento(s) importado(s). Selecione as categorias e confirme abaixo.`)
    } else {
      showMsg('Nenhum lançamento válido encontrado. Verifique o formato do CSV.')
    }
    setLoading(false)
    loadExtrato()
    e.target.value = ''
  }

  async function confirmarLancamentos() {
    const paraConfirmar = extrato.filter(r => r.status_conciliacao !== 'conciliado' && selecoes[r.id])
    if (!paraConfirmar.length) {
      showMsg('Selecione pelo menos uma categoria para confirmar.')
      return
    }
    setConfirmando(true)
    let criados = 0

    for (const row of paraConfirmar) {
      const catId = selecoes[row.id]
      const cat = categorias.find(c => c.id === catId)
      const tipo = row.valor > 0 ? 'receber' : 'pagar'

      const { data: novoLan } = await supabase
        .from('lancamentos_financeiros')
        .insert({
          tipo,
          descricao: row.descricao_banco,
          valor: Math.abs(row.valor),
          data_vencimento: row.data_lancamento,
          data_pagamento: row.data_lancamento,
          status: tipo === 'receber' ? 'recebido' : 'pago',
          categoria_id: catId,
          conciliado: true,
          observacoes: 'Importado do extrato bancário',
          created_by: profile?.id,
        })
        .select('id')
        .single()

      await supabase.from('extrato_bancario').update({
        categoria_ia: cat?.nome || null,
        status_conciliacao: 'conciliado',
        lancamento_id: novoLan?.id || null,
      }).eq('id', row.id)

      criados++
    }

    setConfirmando(false)
    setSelecoes({})
    showMsg(`✅ ${criados} lançamento(s) criado(s) em Financeiro > Contas a Receber/Pagar!`)
    loadExtrato()
  }

  async function criarCategoria() {
    if (!formCat.nome.trim()) { showMsg('Digite o nome da categoria.'); return }
    setSalvandoCat(true)
    const { error } = await supabase.from('categorias_financeiras').insert({
      nome: formCat.nome.trim(), tipo: formCat.tipo,
    })
    setSalvandoCat(false)
    if (error) { showMsg('Erro: ' + error.message); return }
    showMsg('Categoria criada!')
    setFormCat({ nome: '', tipo: 'pagar' })
    loadCategorias()
  }

  async function excluirCategoria(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    await supabase.from('categorias_financeiras').delete().eq('id', id)
    loadCategorias()
  }

  async function excluirExtrato(id: string) {
    if (!confirm('Remover este lançamento do extrato?')) return
    await supabase.from('extrato_bancario').delete().eq('id', id)
    loadExtrato()
  }

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const fmtData = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR')

  const selecionados = extrato.filter(r => r.status_conciliacao !== 'conciliado' && selecoes[r.id]).length
  const pendentes = extrato.filter(r => r.status_conciliacao !== 'conciliado')

  const tabStyle = (t: Tab) => ({
    padding:'9px 20px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer',
    background: tab === t ? '#fff' : 'transparent',
    color: tab === t ? '#2d6a4f' : '#9a9588',
    border:'none',
    borderBottom: tab === t ? '2px solid #40916c' : '2px solid transparent',
    fontFamily:'inherit',
  })

  return (
    <div>
      {msg && (
        <div style={{ background: msg.includes('Erro') ? '#fee2e2' : msg.startsWith('✅') ? '#d8f3dc' : '#dbeafe', color: msg.includes('Erro') ? '#991b1b' : msg.startsWith('✅') ? '#2d6a4f' : '#1d4e89', padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px' }}>
          {msg}
        </div>
      )}

      {/* Métricas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Créditos',     val: fmtBRL(resumo.creditos),   color:'#2d6a4f' },
          { label:'Débitos',      val: fmtBRL(resumo.debitos),    color:'#991b1b' },
          { label:'Saldo Extrato',val: fmtBRL(resumo.saldo),      color: resumo.saldo >= 0 ? '#2d6a4f' : '#991b1b' },
          { label:'Lançados',     val: resumo.lancados.toString(), color:'#2d6a4f' },
          { label:'Aguardando',   val: resumo.pendentes.toString(),color: resumo.pendentes > 0 ? '#92400e' : '#2d6a4f' },
        ].map(m => (
          <div key={m.label} style={{ background:'#fff', border:'1px solid #e0dbd0', borderRadius:'12px', padding:'14px 16px' }}>
            <div style={{ fontSize:'11px', color:'#9a9588', textTransform:'uppercase' as const, letterSpacing:'.5px', marginBottom:'4px' }}>{m.label}</div>
            <div style={{ fontSize:'20px', fontWeight:600, color:m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', borderBottom:'1px solid #e0dbd0', marginBottom:'16px', background:'#fff', borderRadius:'12px 12px 0 0', overflow:'hidden' }}>
        <button style={tabStyle('extrato')} onClick={() => setTab('extrato')}>📄 Extrato Bancário</button>
        <button style={tabStyle('categorias')} onClick={() => setTab('categorias')}>🏷 Categorias</button>
      </div>

      {/* ── ABA EXTRATO ─────────────────────────────────────── */}
      {tab === 'extrato' && (
        <>
          {/* Importar + Confirmar */}
          <div style={{ ...S.card, marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap' as const, gap:'16px' }}>
              <div style={{ flex:1, minWidth:'260px' }}>
                <div style={{ fontWeight:600, fontSize:'14px', marginBottom:'4px' }}>Importar Extrato CSV</div>
                <div style={{ fontSize:'12px', color:'#9a9588', marginBottom:'10px' }}>
                  Formato: <code style={{ background:'#f7f5f0', padding:'1px 6px', borderRadius:'4px' }}>Data;Descrição;Valor</code> — separado por ponto-e-vírgula, uma linha por transação.
                </div>
                <label style={{ ...S.btn('#1d4e89'), cursor:'pointer' }}>
                  {loading ? '⏳ Importando...' : '📤 Importar CSV'}
                  <input type="file" accept=".csv,.txt" onChange={importarCSV} style={{ display:'none' }} disabled={loading} />
                </label>
              </div>

              {selecionados > 0 && (
                <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'12px', padding:'14px 18px', display:'flex', alignItems:'center', gap:'16px' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'13px', color:'#2d6a4f' }}>{selecionados} lançamento(s) prontos</div>
                    <div style={{ fontSize:'11px', color:'#5c5850', marginTop:'2px' }}>Serão criados em Contas a Receber/Pagar já como pagos/recebidos</div>
                  </div>
                  <button
                    onClick={confirmarLancamentos}
                    disabled={confirmando}
                    style={{ ...S.btn('#40916c'), opacity: confirmando ? 0.7 : 1 }}
                  >
                    {confirmando ? '⏳ Criando...' : `✔ Confirmar ${selecionados}`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Instrução quando tem pendentes */}
          {pendentes.length > 0 && selecionados === 0 && (
            <div style={{ padding:'10px 14px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'8px', fontSize:'12px', color:'#92400e', marginBottom:'12px' }}>
              💡 Selecione a categoria de cada transação abaixo. Apenas os que tiverem categoria selecionada serão criados como lançamentos financeiros.
            </div>
          )}

          {/* Tabela */}
          <div style={S.card}>
            <div style={{ overflowX:'auto' as const }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ background:'#f7f5f0' }}>
                    {['Data', 'Descrição Bancária', 'Valor', 'Tipo', 'Categoria', 'Status', ''].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left' as const, fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extrato.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding:'48px', textAlign:'center' as const, color:'#9a9588' }}>
                        Nenhum lançamento importado ainda.<br />
                        <span style={{ fontSize:'12px' }}>Importe um arquivo CSV do seu banco para começar.</span>
                      </td>
                    </tr>
                  )}
                  {extrato.map(row => {
                    const isConciliado = row.status_conciliacao === 'conciliado'
                    const tipo = row.valor > 0 ? 'receber' : 'pagar'
                    const sc = STATUS_MAP[row.status_conciliacao] || STATUS_MAP.nao_conciliado
                    const catsFiltradas = categorias.filter(c => c.tipo === tipo)

                    return (
                      <tr key={row.id} style={{ borderBottom:'1px solid #e0dbd0', background: isConciliado ? '#fafffe' : selecoes[row.id] ? '#f0fdf4' : 'transparent' }}>
                        <td style={{ padding:'10px 12px', whiteSpace:'nowrap' as const, fontSize:'12px' }}>
                          {fmtData(row.data_lancamento)}
                        </td>
                        <td style={{ padding:'10px 12px', maxWidth:'240px', overflow:'hidden' as const, textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                          {row.descricao_banco}
                        </td>
                        <td style={{ padding:'10px 12px', fontWeight:600, whiteSpace:'nowrap' as const, color: row.valor > 0 ? '#2d6a4f' : '#991b1b' }}>
                          {row.valor > 0 ? '+' : ''}{fmtBRL(Math.abs(row.valor))}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'20px', background: tipo === 'receber' ? '#d8f3dc' : '#fee2e2', color: tipo === 'receber' ? '#2d6a4f' : '#991b1b', fontWeight:500 }}>
                            {tipo === 'receber' ? '↑ Receber' : '↓ Pagar'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px', minWidth:'180px' }}>
                          {isConciliado ? (
                            <span style={{ fontSize:'12px', color:'#5c5850' }}>{row.categoria_ia || '—'}</span>
                          ) : (
                            <select
                              value={selecoes[row.id] || ''}
                              onChange={e => setSelecoes(s => ({ ...s, [row.id]: e.target.value }))}
                              style={{ ...S.select, borderColor: selecoes[row.id] ? '#40916c' : '#ccc8bc' }}
                            >
                              <option value="">— Selecionar categoria —</option>
                              {catsFiltradas.length === 0 && (
                                <option disabled value="">Crie categorias na aba Categorias</option>
                              )}
                              {catsFiltradas.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background:sc.bg, color:sc.color }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          {!isConciliado && (
                            <button onClick={() => excluirExtrato(row.id)} style={{ ...S.btnSec, padding:'4px 8px', fontSize:'11px', color:'#dc2626' }} title="Remover">✕</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Botão confirmar no final da tabela */}
            {selecionados > 0 && (
              <div style={{ padding:'16px 0 4px', borderTop:'1px solid #e0dbd0', marginTop:'8px', display:'flex', justifyContent:'flex-end' }}>
                <button
                  onClick={confirmarLancamentos}
                  disabled={confirmando}
                  style={{ ...S.btn('#40916c'), opacity: confirmando ? 0.7 : 1 }}
                >
                  {confirmando ? '⏳ Criando lançamentos...' : `✔ Confirmar ${selecionados} lançamento(s)`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ABA CATEGORIAS ─────────────────────────────────── */}
      {tab === 'categorias' && (
        <>
          {/* Form nova categoria */}
          <div style={{ ...S.card, marginBottom:'16px' }}>
            <div style={{ fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0' }}>
              Nova Categoria
            </div>
            <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' as const }}>
              <div style={{ flex:2, minWidth:'200px' }}>
                <label style={S.label}>Nome da Categoria *</label>
                <input
                  value={formCat.nome}
                  onChange={e => setFormCat(f => ({ ...f, nome: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && criarCategoria()}
                  placeholder="Ex: Mensalidade, Folha de Pagamento, Energia..."
                  style={S.input}
                />
              </div>
              <div style={{ flex:1, minWidth:'160px' }}>
                <label style={S.label}>Tipo</label>
                <select value={formCat.tipo} onChange={e => setFormCat(f => ({ ...f, tipo: e.target.value }))} style={{ ...S.select, padding:'9px 12px' }}>
                  <option value="pagar">↓ Contas a Pagar (débito)</option>
                  <option value="receber">↑ Contas a Receber (crédito)</option>
                </select>
              </div>
              <button onClick={criarCategoria} disabled={salvandoCat} style={S.btn()}>
                {salvandoCat ? 'Salvando...' : '+ Criar Categoria'}
              </button>
            </div>
          </div>

          {/* Lista de categorias */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            {['pagar', 'receber'].map(tipo => {
              const lista = categorias.filter(c => c.tipo === tipo)
              return (
                <div key={tipo} style={S.card}>
                  <div style={{ fontWeight:600, fontSize:'13px', marginBottom:'14px', paddingBottom:'10px', borderBottom:`2px solid ${tipo === 'receber' ? '#40916c' : '#dc2626'}`, color: tipo === 'receber' ? '#2d6a4f' : '#991b1b', textTransform:'uppercase' as const, letterSpacing:'0.5px', fontSize:'11px' as const }}>
                    {tipo === 'receber' ? '↑ Contas a Receber (créditos)' : '↓ Contas a Pagar (débitos)'}
                  </div>

                  {lista.length === 0 && (
                    <div style={{ color:'#9a9588', fontSize:'13px', padding:'16px 0', textAlign:'center' as const }}>
                      Nenhuma categoria cadastrada.
                    </div>
                  )}

                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'2px' }}>
                    {lista.map(cat => (
                      <div key={cat.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:'8px', background:'#f7f5f0' }}>
                        <div style={{ fontSize:'13px', fontWeight:500 }}>{cat.nome}</div>
                        <button onClick={() => excluirCategoria(cat.id)} style={{ ...S.btnSec, padding:'3px 8px', fontSize:'11px', color:'#dc2626', border:'none', background:'transparent' }} title="Excluir">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
