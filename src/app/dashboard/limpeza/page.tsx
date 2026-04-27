'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ProdutoLimpeza = {
  id: string
  nome: string
  unidade: string
  quantidade_atual: number
  uso_diario: number
  quantidade_minima: number
  fornecedor?: string
  custo_unitario?: number
  created_at: string
  updated_at: string
}

const S = {
  card: { background: '#fff', border: '1px solid #e0dbd0', borderRadius: '16px', padding: '20px' },
  btn: (c = '#40916c') => ({ padding: '9px 18px', background: c, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500 as const, cursor: 'pointer', fontFamily: 'inherit' }),
  btnSec: { padding: '8px 14px', background: '#f7f5f0', color: '#1a1814', border: '1px solid #e0dbd0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  label: { display: 'block' as const, fontSize: '12px', fontWeight: 500 as const, color: '#5c5850', marginBottom: '5px' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #ccc8bc', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  select: { width: '100%', padding: '9px 12px', border: '1px solid #ccc8bc', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' as const },
}

function calcDias(qtd: number, usoDia: number): number | null {
  if (usoDia <= 0) return null
  return Math.floor(qtd / usoDia)
}

function nivelInfo(dias: number | null) {
  if (dias === null) return { color: '#9a9588', bg: '#f1efe8', label: 'Sem consumo' }
  if (dias <= 0) return { color: '#dc2626', bg: '#fee2e2', label: 'Esgotado' }
  if (dias <= 3) return { color: '#dc2626', bg: '#fee2e2', label: 'Crítico' }
  if (dias <= 7) return { color: '#d97706', bg: '#fef3c7', label: 'Atenção' }
  return { color: '#16a34a', bg: '#d8f3dc', label: 'OK' }
}

function dataCompra(dias: number | null): string {
  if (dias === null || dias < 0) return '—'
  const d = new Date()
  d.setDate(d.getDate() + Math.max(0, dias))
  return d.toLocaleDateString('pt-BR')
}

export default function LimpezaPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<ProdutoLimpeza[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showEntrada, setShowEntrada] = useState<ProdutoLimpeza | null>(null)
  const [qtdEntrada, setQtdEntrada] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    nome: '', unidade: 'L', quantidade_atual: '', uso_diario: '',
    quantidade_minima: '', fornecedor: '', custo_unitario: '',
  })

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function load() {
    const { data } = await supabase.from('produtos_limpeza').select('*').order('nome')
    setProdutos((data || []) as ProdutoLimpeza[])
  }

  useEffect(() => { load() }, [])

  async function salvarProduto() {
    if (!form.nome || !form.unidade) { showMsg('Preencha nome e unidade.'); return }
    const { error } = await supabase.from('produtos_limpeza').insert({
      nome: form.nome, unidade: form.unidade,
      quantidade_atual: parseFloat(form.quantidade_atual) || 0,
      uso_diario: parseFloat(form.uso_diario) || 0,
      quantidade_minima: parseFloat(form.quantidade_minima) || 0,
      fornecedor: form.fornecedor || null,
      custo_unitario: form.custo_unitario ? parseFloat(form.custo_unitario) : null,
    })
    if (error) showMsg('Erro: ' + error.message)
    else {
      showMsg('Produto cadastrado!')
      setForm({ nome: '', unidade: 'L', quantidade_atual: '', uso_diario: '', quantidade_minima: '', fornecedor: '', custo_unitario: '' })
      setShowForm(false)
      load()
    }
  }

  async function registrarEntrada() {
    if (!showEntrada || !qtdEntrada) return
    const novaQtd = showEntrada.quantidade_atual + parseFloat(qtdEntrada)
    const { error } = await supabase.from('produtos_limpeza')
      .update({ quantidade_atual: novaQtd, updated_at: new Date().toISOString() })
      .eq('id', showEntrada.id)
    if (error) showMsg('Erro: ' + error.message)
    else {
      showMsg('Entrada registrada!')
      setShowEntrada(null)
      setQtdEntrada('')
      load()
    }
  }

  const produtosComCalculo = produtos.map(p => ({
    ...p,
    dias: calcDias(p.quantidade_atual, p.uso_diario),
  }))

  const listaCompras = produtosComCalculo
    .filter(p => p.dias !== null && p.dias <= 7)
    .sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999))

  const contagens = {
    ok: produtosComCalculo.filter(p => nivelInfo(p.dias).label === 'OK').length,
    atencao: produtosComCalculo.filter(p => nivelInfo(p.dias).label === 'Atenção').length,
    critico: produtosComCalculo.filter(p => ['Crítico', 'Esgotado'].includes(nivelInfo(p.dias).label)).length,
    semConsumo: produtosComCalculo.filter(p => nivelInfo(p.dias).label === 'Sem consumo').length,
  }

  return (
    <div>
      {msg && (
        <div style={{ background: msg.includes('Erro') ? '#fee2e2' : '#d8f3dc', color: msg.includes('Erro') ? '#991b1b' : '#2d6a4f', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
          {msg}
        </div>
      )}

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Produtos', val: produtos.length, color: '#1d4e89' },
          { label: 'Estoque OK', val: contagens.ok, color: '#2d6a4f' },
          { label: 'Atenção', val: contagens.atencao, color: '#92400e' },
          { label: 'Crítico / Esgotado', val: contagens.critico, color: '#991b1b' },
        ].map(m => (
          <div key={m.label} style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', color: '#9a9588', textTransform: 'uppercase' as const, letterSpacing: '.5px', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Lista de compras */}
      {listaCompras.length > 0 && (
        <div style={{ ...S.card, marginBottom: '16px', borderColor: '#fca5a5' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#991b1b', marginBottom: '12px' }}>
            🛒 Lista de Compras — Próximos 7 dias
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {listaCompras.map(p => {
              const n = nivelInfo(p.dias)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff9f9', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <span style={{ fontWeight: 500, flex: 1 }}>{p.nome}</span>
                  <span style={{ fontSize: '12px', color: '#5c5850' }}>
                    {p.quantidade_atual} {p.unidade} restantes · uso: {p.uso_diario}/{p.unidade}/dia
                  </span>
                  <span style={{ fontSize: '12px', color: n.color, fontWeight: 600, minWidth: '160px', textAlign: 'right' as const }}>
                    {p.dias === 0 ? '⚠️ ESGOTADO — Comprar HOJE' : p.dias === 1 ? '⚠️ Comprar HOJE' : `Comprar em ${p.dias} dias (${dataCompra(p.dias)})`}
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', background: n.bg, color: n.color, fontWeight: 500 }}>{n.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Barra de ações */}
      <div style={{ ...S.card, marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(s => !s)} style={S.btn()}>+ Novo Produto</button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div style={{ ...S.card, marginBottom: '16px', borderColor: '#b7e4c7' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>
            Cadastrar Produto de Limpeza
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>Nome do Produto *</label>
              <input value={form.nome} onChange={e => upd('nome', e.target.value)} style={S.input} placeholder="Ex: Detergente, Água Sanitária, Desinfetante..." />
            </div>
            <div>
              <label style={S.label}>Unidade *</label>
              <select value={form.unidade} onChange={e => upd('unidade', e.target.value)} style={S.select}>
                <option value="L">L (litro)</option>
                <option value="ml">ml</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="unidade">unidade</option>
                <option value="pacote">pacote</option>
                <option value="frasco">frasco</option>
                <option value="galão">galão</option>
                <option value="rolo">rolo</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Qtd. Atual em Estoque</label>
              <input type="number" step="0.01" value={form.quantidade_atual} onChange={e => upd('quantidade_atual', e.target.value)} style={S.input} placeholder="0" />
            </div>
            <div>
              <label style={S.label}>Uso por Dia *</label>
              <input type="number" step="0.001" value={form.uso_diario} onChange={e => upd('uso_diario', e.target.value)} style={S.input} placeholder="Ex: 0.5 (= 500ml/dia)" />
            </div>
            <div>
              <label style={S.label}>Qtd. Mínima no Estoque</label>
              <input type="number" step="0.01" value={form.quantidade_minima} onChange={e => upd('quantidade_minima', e.target.value)} style={S.input} placeholder="Ex: 2" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>Fornecedor</label>
              <input value={form.fornecedor} onChange={e => upd('fornecedor', e.target.value)} style={S.input} placeholder="Nome do fornecedor" />
            </div>
            <div>
              <label style={S.label}>Custo Unitário (R$)</label>
              <input type="number" step="0.01" value={form.custo_unitario} onChange={e => upd('custo_unitario', e.target.value)} style={S.input} placeholder="0,00" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={salvarProduto} style={S.btn()}>💾 Salvar Produto</button>
            <button onClick={() => setShowForm(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela de produtos */}
      <div style={S.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f7f5f0' }}>
              {['Produto', 'Un.', 'Qtd. Atual', 'Uso/Dia', 'Dias Rest.', 'Comprar em', 'Fornecedor', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {produtosComCalculo.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center' as const, color: '#9a9588' }}>
                  Nenhum produto cadastrado. Clique em "Novo Produto" para começar.
                </td>
              </tr>
            )}
            {produtosComCalculo.map(p => {
              const n = nivelInfo(p.dias)
              const isCritico = ['Crítico', 'Esgotado'].includes(n.label)
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #e0dbd0', background: isCritico ? '#fff9f9' : 'transparent' }}>
                  <td style={{ padding: '11px 12px', fontWeight: 500 }}>{p.nome}</td>
                  <td style={{ padding: '11px 12px', color: '#9a9588' }}>{p.unidade}</td>
                  <td style={{ padding: '11px 12px', fontWeight: 600, color: isCritico ? '#dc2626' : '#1a1814' }}>
                    {p.quantidade_atual}
                  </td>
                  <td style={{ padding: '11px 12px', color: '#5c5850' }}>
                    {p.uso_diario > 0 ? p.uso_diario : <span style={{ color: '#9a9588' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 12px', fontWeight: p.dias !== null && p.dias <= 3 ? 700 : 400, color: p.dias !== null && p.dias <= 3 ? '#991b1b' : '#1a1814' }}>
                    {p.dias !== null ? `${p.dias} dias` : <span style={{ color: '#9a9588' }}>—</span>}
                    {p.dias !== null && p.dias <= 3 && ' ⚠️'}
                  </td>
                  <td style={{ padding: '11px 12px', fontSize: '12px', color: isCritico ? '#991b1b' : '#5c5850', fontWeight: isCritico ? 600 : 400 }}>
                    {dataCompra(p.dias)}
                  </td>
                  <td style={{ padding: '11px 12px', fontSize: '12px', color: '#5c5850' }}>{p.fornecedor || '—'}</td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: n.bg, color: n.color }}>
                      {n.label}
                    </span>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <button
                      onClick={() => { setShowEntrada(p); setQtdEntrada('') }}
                      style={{ ...S.btn('#1d4e89'), padding: '5px 10px', fontSize: '11px' }}
                    >
                      + Entrada
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de entrada */}
      {showEntrada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Entrada de Estoque</div>
            <div style={{ fontSize: '13px', color: '#5c5850', marginBottom: '16px' }}>
              {showEntrada.nome} · Atual: {showEntrada.quantidade_atual} {showEntrada.unidade}
            </div>
            <label style={S.label}>Quantidade recebida ({showEntrada.unidade})</label>
            <input
              type="number"
              step="0.01"
              value={qtdEntrada}
              onChange={e => setQtdEntrada(e.target.value)}
              style={{ ...S.input, fontSize: '18px', textAlign: 'center' as const, marginBottom: '16px' }}
              placeholder="0"
            />
            {qtdEntrada && (
              <div style={{ fontSize: '12px', color: '#9a9588', marginBottom: '16px' }}>
                Novo total: {showEntrada.quantidade_atual + parseFloat(qtdEntrada || '0')} {showEntrada.unidade}
                {showEntrada.uso_diario > 0 && (
                  <span style={{ marginLeft: '8px', color: '#40916c' }}>
                    ≈ {Math.floor((showEntrada.quantidade_atual + parseFloat(qtdEntrada || '0')) / showEntrada.uso_diario)} dias
                  </span>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={registrarEntrada} style={{ ...S.btn(), flex: 1 }}>✅ Confirmar</button>
              <button onClick={() => setShowEntrada(null)} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
