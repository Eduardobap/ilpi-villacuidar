'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Residente } from '@/types'

type ItemHigiene = {
  id: string
  residente_id: string
  item_nome: string
  unidade: string
  quantidade_atual: number
  quantidade_minima: number
  uso_diario: number
  observacoes?: string
}

const ITENS_PADRAO = [
  { nome: 'Fralda Geriátrica G', unidade: 'unidade' },
  { nome: 'Fralda Geriátrica M', unidade: 'unidade' },
  { nome: 'Fralda Geriátrica P', unidade: 'unidade' },
  { nome: 'Lenço Umedecido', unidade: 'unidade' },
  { nome: 'Sabonete Líquido', unidade: 'ml' },
  { nome: 'Shampoo', unidade: 'ml' },
  { nome: 'Condicionador', unidade: 'ml' },
  { nome: 'Creme Hidratante', unidade: 'ml' },
  { nome: 'Talco', unidade: 'g' },
  { nome: 'Creme Dental', unidade: 'unidade' },
  { nome: 'Escova de Dentes', unidade: 'unidade' },
  { nome: 'Absorvente', unidade: 'unidade' },
  { nome: 'Colônia / Perfume', unidade: 'unidade' },
  { nome: 'Protetor Solar', unidade: 'ml' },
]

const S = {
  card: { background: '#fff', border: '1px solid #e0dbd0', borderRadius: '16px', padding: '20px' },
  btn: (c = '#40916c') => ({ padding: '9px 18px', background: c, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500 as const, cursor: 'pointer', fontFamily: 'inherit' }),
  btnSec: { padding: '8px 14px', background: '#f7f5f0', color: '#1a1814', border: '1px solid #e0dbd0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  label: { display: 'block' as const, fontSize: '12px', fontWeight: 500 as const, color: '#5c5850', marginBottom: '5px' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #ccc8bc', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  select: { width: '100%', padding: '9px 12px', border: '1px solid #ccc8bc', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' as const },
}

function calcDias(qtd: number, uso: number): number | null {
  if (uso <= 0) return null
  return Math.floor(qtd / uso)
}

function dataFim(dias: number | null): string {
  if (dias === null || dias < 0) return '—'
  const d = new Date()
  d.setDate(d.getDate() + Math.max(0, dias))
  return d.toLocaleDateString('pt-BR')
}

function nivelInfo(qtd: number, min: number, uso: number) {
  const dias = calcDias(qtd, uso)
  if (qtd <= 0) return { color: '#dc2626', bg: '#fee2e2', label: 'Esgotado', dias: 0 as number | null }
  if (dias !== null) {
    if (dias <= 3) return { color: '#dc2626', bg: '#fee2e2', label: 'Crítico', dias }
    if (dias <= 7) return { color: '#d97706', bg: '#fef3c7', label: 'Atenção', dias }
    if (dias <= 14) return { color: '#b45309', bg: '#fef9c3', label: 'Baixo', dias }
    return { color: '#16a34a', bg: '#d8f3dc', label: 'OK', dias }
  }
  // sem uso_diario — usa qtd vs mínimo
  if (qtd <= 0) return { color: '#dc2626', bg: '#fee2e2', label: 'Esgotado', dias: null }
  if (qtd <= min * 0.5) return { color: '#dc2626', bg: '#fee2e2', label: 'Crítico', dias: null }
  if (qtd <= min) return { color: '#d97706', bg: '#fef3c7', label: 'Baixo', dias: null }
  return { color: '#16a34a', bg: '#d8f3dc', label: 'OK', dias: null }
}

export default function HigienePage() {
  const supabase = createClient()
  const [residentes, setResidentes] = useState<Pick<Residente, 'id' | 'nome' | 'quarto'>[]>([])
  const [residenteId, setResidenteId] = useState('')
  const [itens, setItens] = useState<ItemHigiene[]>([])
  const [adicionandoTodos, setAdicionandoTodos] = useState(false)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showMovimento, setShowMovimento] = useState<{ item: ItemHigiene; tipo: 'entrada' | 'uso' } | null>(null)
  const [qtdMovimento, setQtdMovimento] = useState('')
  const [form, setForm] = useState({
    item_nome: '', unidade: 'unidade', quantidade_atual: '',
    quantidade_minima: '5', uso_diario: '', observacoes: '',
  })

  async function loadResidentes() {
    const { data } = await supabase.from('residentes').select('id,nome,quarto').eq('status', 'ativo').order('nome')
    setResidentes(data || [])
    if (data?.length && !residenteId) setResidenteId(data[0].id)
  }

  async function loadItens(rid: string) {
    if (!rid) return
    const { data } = await supabase
      .from('materiais_higiene_residente')
      .select('*')
      .eq('residente_id', rid)
      .order('item_nome')
    setItens((data || []) as ItemHigiene[])
  }

  useEffect(() => { loadResidentes() }, [])
  useEffect(() => { if (residenteId) loadItens(residenteId) }, [residenteId])

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  async function salvarItem() {
    if (!form.item_nome || !residenteId) { showMsg('Preencha o nome do item.'); return }
    const { error } = await supabase.from('materiais_higiene_residente').insert({
      residente_id: residenteId,
      item_nome: form.item_nome,
      unidade: form.unidade,
      quantidade_atual: parseFloat(form.quantidade_atual) || 0,
      quantidade_minima: parseFloat(form.quantidade_minima) || 5,
      uso_diario: parseFloat(form.uso_diario) || 0,
      observacoes: form.observacoes || null,
    })
    if (error) showMsg('Erro: ' + error.message)
    else {
      showMsg('Item cadastrado!')
      setForm({ item_nome: '', unidade: 'unidade', quantidade_atual: '', quantidade_minima: '5', uso_diario: '', observacoes: '' })
      setShowForm(false)
      loadItens(residenteId)
    }
  }

  async function registrarMovimento() {
    if (!showMovimento || !qtdMovimento) return
    const { item, tipo } = showMovimento
    const delta = parseFloat(qtdMovimento)
    const novaQtd = tipo === 'entrada'
      ? item.quantidade_atual + delta
      : Math.max(0, item.quantidade_atual - delta)
    const { error } = await supabase
      .from('materiais_higiene_residente')
      .update({ quantidade_atual: novaQtd, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) showMsg('Erro: ' + error.message)
    else {
      showMsg(tipo === 'entrada' ? 'Entrada registrada!' : 'Uso registrado!')
      setShowMovimento(null)
      setQtdMovimento('')
      loadItens(residenteId)
    }
  }

  // Adiciona itens padrão para o residente selecionado
  async function adicionarItensPadraoResidente() {
    if (!residenteId) return
    const existentes = new Set(itens.map(i => i.item_nome))
    const novos = ITENS_PADRAO
      .filter(i => !existentes.has(i.nome))
      .map(i => ({ residente_id: residenteId, item_nome: i.nome, unidade: i.unidade, quantidade_atual: 0, quantidade_minima: 5, uso_diario: 0 }))
    if (!novos.length) { showMsg('Todos os itens padrão já estão cadastrados para este residente.'); return }
    const { error } = await supabase.from('materiais_higiene_residente').insert(novos)
    if (error) showMsg('Erro: ' + error.message)
    else { showMsg(`${novos.length} itens adicionados!`); loadItens(residenteId) }
  }

  // Adiciona itens padrão para TODOS os residentes
  async function adicionarItensPadraoTodos() {
    if (!residentes.length) { showMsg('Nenhum residente ativo encontrado.'); return }
    setAdicionandoTodos(true)
    const ids = residentes.map(r => r.id)

    // Busca todos os itens existentes de todos os residentes de uma vez
    const { data: existentes } = await supabase
      .from('materiais_higiene_residente')
      .select('residente_id, item_nome')
      .in('residente_id', ids)

    const existentesSet = new Set((existentes || []).map(e => `${e.residente_id}|${e.item_nome}`))

    const novos = []
    for (const res of residentes) {
      for (const item of ITENS_PADRAO) {
        if (!existentesSet.has(`${res.id}|${item.nome}`)) {
          novos.push({
            residente_id: res.id,
            item_nome: item.nome,
            unidade: item.unidade,
            quantidade_atual: 0,
            quantidade_minima: 5,
            uso_diario: 0,
          })
        }
      }
    }

    if (!novos.length) {
      showMsg(`Todos os ${residentes.length} residentes já têm os itens padrão cadastrados.`)
      setAdicionandoTodos(false)
      return
    }

    const { error } = await supabase.from('materiais_higiene_residente').insert(novos)
    setAdicionandoTodos(false)
    if (error) showMsg('Erro: ' + error.message)
    else {
      showMsg(`✅ ${novos.length} itens adicionados para ${residentes.length} residentes!`)
      if (residenteId) loadItens(residenteId)
    }
  }

  const residenteAtual = residentes.find(r => r.id === residenteId)

  // Itens com problema (crítico/atenção/esgotado)
  const itensAlerta = itens.filter(i => {
    const n = nivelInfo(i.quantidade_atual, i.quantidade_minima, i.uso_diario)
    return n.label !== 'OK' && n.label !== 'Sem consumo'
  })

  // Lista de compras: itens que acabam em até 7 dias (com uso_diario definido)
  const listaCompras = itens
    .map(i => ({ ...i, dias: calcDias(i.quantidade_atual, i.uso_diario) }))
    .filter(i => i.dias !== null && i.dias <= 7)
    .sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999))

  return (
    <div>
      {msg && (
        <div style={{ background: msg.includes('Erro') ? '#fee2e2' : '#d8f3dc', color: msg.includes('Erro') ? '#991b1b' : '#2d6a4f', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
          {msg}
        </div>
      )}

      {/* Seletor de residente + ações */}
      <div style={{ ...S.card, marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <label style={S.label}>Residente</label>
            <select value={residenteId} onChange={e => setResidenteId(e.target.value)} style={S.select}>
              <option value="">Selecione...</option>
              {residentes.map(r => <option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
            <button
              onClick={adicionarItensPadraoResidente}
              disabled={!residenteId}
              style={{ ...S.btnSec, opacity: residenteId ? 1 : 0.5 }}
              title="Adiciona os itens padrão ao residente selecionado"
            >
              📋 Padrão (Este Residente)
            </button>
            <button
              onClick={adicionarItensPadraoTodos}
              disabled={adicionandoTodos}
              style={{ ...S.btnSec, borderColor: '#1d4e89', color: '#1d4e89' }}
              title="Adiciona os itens padrão para todos os residentes ativos"
            >
              {adicionandoTodos ? '⏳ Adicionando...' : '👥 Padrão (Todos os Residentes)'}
            </button>
            <button onClick={() => setShowForm(s => !s)} style={S.btn()}>+ Adicionar Item</button>
          </div>
        </div>
      </div>

      {/* Lista de compras urgente */}
      {listaCompras.length > 0 && (
        <div style={{ ...S.card, marginBottom: '16px', borderColor: '#fca5a5' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#991b1b', marginBottom: '12px' }}>
            🛒 Lista de Compras — Acaba em até 7 dias ({residenteAtual?.nome})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
            {listaCompras.map(i => {
              const n = nivelInfo(i.quantidade_atual, i.quantidade_minima, i.uso_diario)
              return (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#fff9f9', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <span style={{ fontWeight: 500, flex: 1 }}>{i.item_nome}</span>
                  <span style={{ fontSize: '12px', color: '#5c5850' }}>Restam: {i.quantidade_atual} {i.unidade}</span>
                  <span style={{ fontSize: '12px', color: n.color, fontWeight: 600 }}>
                    {i.dias === 0 ? '⚠️ ESGOTADO hoje' : i.dias === 1 ? '⚠️ Acaba amanhã' : `Acaba em ${i.dias} dias — ${dataFim(i.dias)}`}
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', background: n.bg, color: n.color, fontWeight: 500 }}>{n.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alertas gerais (sem uso_diario definido) */}
      {itensAlerta.length > 0 && listaCompras.length === 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
            ⚠️ Itens com estoque baixo — {residenteAtual?.nome}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {itensAlerta.map(i => {
              const n = nivelInfo(i.quantidade_atual, i.quantidade_minima, i.uso_diario)
              return (
                <span key={i.id} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: n.bg, color: n.color, fontWeight: 500 }}>
                  {i.item_nome}: {i.quantidade_atual} {i.unidade}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Formulário novo item */}
      {showForm && (
        <div style={{ ...S.card, marginBottom: '16px', borderColor: '#b7e4c7' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>
            Adicionar Item de Higiene
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>Nome do Item *</label>
              <input
                list="itens-padrao-list"
                value={form.item_nome}
                onChange={e => upd('item_nome', e.target.value)}
                style={S.input}
                placeholder="Ex: Fralda Geriátrica G"
              />
              <datalist id="itens-padrao-list">
                {ITENS_PADRAO.map(i => <option key={i.nome} value={i.nome} />)}
              </datalist>
            </div>
            <div>
              <label style={S.label}>Unidade</label>
              <select value={form.unidade} onChange={e => upd('unidade', e.target.value)} style={S.select}>
                <option value="unidade">unidade</option>
                <option value="ml">ml</option>
                <option value="g">g</option>
                <option value="pacote">pacote</option>
                <option value="frasco">frasco</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Qtd. Atual</label>
              <input type="number" step="0.1" value={form.quantidade_atual} onChange={e => upd('quantidade_atual', e.target.value)} style={S.input} placeholder="0" />
            </div>
            <div>
              <label style={S.label}>Uso por Dia</label>
              <input type="number" step="0.1" value={form.uso_diario} onChange={e => upd('uso_diario', e.target.value)} style={S.input} placeholder="Ex: 4 fraldas/dia" />
            </div>
            <div>
              <label style={S.label}>Qtd. Mínima (alerta)</label>
              <input type="number" step="1" value={form.quantidade_minima} onChange={e => upd('quantidade_minima', e.target.value)} style={S.input} placeholder="5" />
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <label style={S.label}>Observações</label>
              <input value={form.observacoes} onChange={e => upd('observacoes', e.target.value)} style={S.input} placeholder="Opcional" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={salvarItem} style={S.btn()}>💾 Salvar</button>
            <button onClick={() => setShowForm(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela de itens do residente */}
      {residenteId ? (
        <div style={S.card}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>
            🧴 Materiais de Higiene — {residenteAtual?.nome || ''}
            <span style={{ marginLeft: '12px', fontSize: '12px', color: '#9a9588', fontWeight: 400 }}>
              {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          {itens.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' as const, color: '#9a9588', fontSize: '14px' }}>
              Nenhum item cadastrado.<br />
              <span style={{ fontSize: '13px' }}>Use "Padrão (Este Residente)" ou "Padrão (Todos os Residentes)" para começar.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f7f5f0' }}>
                  {['Item', 'Un.', 'Qtd. Atual', 'Uso/Dia', 'Dias Rest.', 'Acaba em', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map(item => {
                  const dias = calcDias(item.quantidade_atual, item.uso_diario)
                  const n = nivelInfo(item.quantidade_atual, item.quantidade_minima, item.uso_diario)
                  const isCritico = n.label === 'Crítico' || n.label === 'Esgotado'
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e0dbd0', background: isCritico ? '#fff9f9' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.item_nome}</td>
                      <td style={{ padding: '10px 12px', color: '#9a9588' }}>{item.unidade}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: isCritico ? '#dc2626' : '#1a1814' }}>
                        {item.quantidade_atual}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#5c5850' }}>
                        {item.uso_diario > 0 ? item.uso_diario : <span style={{ color: '#ccc8bc' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: dias !== null && dias <= 7 ? 700 : 400, color: dias !== null && dias <= 3 ? '#dc2626' : dias !== null && dias <= 7 ? '#92400e' : '#1a1814' }}>
                        {dias !== null ? `${dias} dias` : <span style={{ color: '#ccc8bc' }}>—</span>}
                        {dias !== null && dias <= 3 && ' ⚠️'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: isCritico ? '#991b1b' : '#5c5850', fontWeight: isCritico ? 600 : 400 }}>
                        {dataFim(dias)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: n.bg, color: n.color }}>
                          {n.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => { setShowMovimento({ item, tipo: 'entrada' }); setQtdMovimento('') }}
                            style={{ ...S.btn('#1d4e89'), padding: '5px 10px', fontSize: '11px' }}
                          >
                            + Entrada
                          </button>
                          <button
                            onClick={() => { setShowMovimento({ item, tipo: 'uso' }); setQtdMovimento('') }}
                            style={{ ...S.btn('#dc2626'), padding: '5px 10px', fontSize: '11px' }}
                          >
                            − Uso
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center' as const, color: '#9a9588', padding: '40px' }}>
          Selecione um residente para ver os materiais de higiene.
        </div>
      )}

      {/* Modal de movimento (entrada / uso) */}
      {showMovimento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
              {showMovimento.tipo === 'entrada' ? '+ Entrada de Material' : '− Registrar Uso'}
            </div>
            <div style={{ fontSize: '13px', color: '#5c5850', marginBottom: '16px' }}>
              {showMovimento.item.item_nome} · Atual: {showMovimento.item.quantidade_atual} {showMovimento.item.unidade}
            </div>
            <label style={S.label}>Quantidade ({showMovimento.item.unidade})</label>
            <input
              type="number"
              step="0.1"
              value={qtdMovimento}
              onChange={e => setQtdMovimento(e.target.value)}
              style={{ ...S.input, fontSize: '18px', textAlign: 'center' as const, marginBottom: '12px' }}
              placeholder="0"
              autoFocus
            />
            {qtdMovimento && (() => {
              const delta = parseFloat(qtdMovimento || '0')
              const novaQtd = showMovimento.tipo === 'entrada'
                ? showMovimento.item.quantidade_atual + delta
                : Math.max(0, showMovimento.item.quantidade_atual - delta)
              const novosDias = calcDias(novaQtd, showMovimento.item.uso_diario)
              return (
                <div style={{ fontSize: '12px', color: '#5c5850', marginBottom: '16px', padding: '8px 12px', background: '#f7f5f0', borderRadius: '8px' }}>
                  <div>Novo total: <strong>{novaQtd} {showMovimento.item.unidade}</strong></div>
                  {novosDias !== null && (
                    <div style={{ marginTop: '4px', color: novosDias <= 7 ? '#92400e' : '#2d6a4f' }}>
                      Duração estimada: <strong>{novosDias} dias</strong> · Acaba em: <strong>{dataFim(novosDias)}</strong>
                    </div>
                  )}
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={registrarMovimento}
                style={{ ...S.btn(showMovimento.tipo === 'entrada' ? '#1d4e89' : '#dc2626'), flex: 1 }}
              >
                ✅ Confirmar
              </button>
              <button onClick={() => setShowMovimento(null)} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
