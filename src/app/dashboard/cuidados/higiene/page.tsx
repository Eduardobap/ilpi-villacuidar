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

function nivelInfo(qtd: number, min: number) {
  if (qtd <= 0) return { color: '#dc2626', bg: '#fee2e2', label: 'Esgotado' }
  if (qtd <= min * 0.5) return { color: '#dc2626', bg: '#fee2e2', label: 'Crítico' }
  if (qtd <= min) return { color: '#d97706', bg: '#fef3c7', label: 'Baixo' }
  return { color: '#16a34a', bg: '#d8f3dc', label: 'OK' }
}

export default function HigienePage() {
  const supabase = createClient()
  const [residentes, setResidentes] = useState<Pick<Residente, 'id' | 'nome' | 'quarto'>[]>([])
  const [residenteId, setResidenteId] = useState('')
  const [itens, setItens] = useState<ItemHigiene[]>([])
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showMovimento, setShowMovimento] = useState<{ item: ItemHigiene; tipo: 'entrada' | 'uso' } | null>(null)
  const [qtdMovimento, setQtdMovimento] = useState('')
  const [form, setForm] = useState({ item_nome: '', unidade: 'unidade', quantidade_atual: '', quantidade_minima: '5', observacoes: '' })

  async function loadResidentes() {
    const { data } = await supabase.from('residentes').select('id,nome,quarto').eq('status', 'ativo').order('nome')
    setResidentes(data || [])
    if (data?.length && !residenteId) setResidenteId(data[0].id)
  }

  async function loadItens(rid: string) {
    if (!rid) return
    const { data } = await supabase.from('materiais_higiene_residente').select('*').eq('residente_id', rid).order('item_nome')
    setItens((data || []) as ItemHigiene[])
  }

  useEffect(() => { loadResidentes() }, [])
  useEffect(() => { if (residenteId) loadItens(residenteId) }, [residenteId])

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function salvarItem() {
    if (!form.item_nome || !residenteId) { showMsg('Preencha o nome do item.'); return }
    const { error } = await supabase.from('materiais_higiene_residente').insert({
      residente_id: residenteId,
      item_nome: form.item_nome,
      unidade: form.unidade,
      quantidade_atual: parseFloat(form.quantidade_atual) || 0,
      quantidade_minima: parseFloat(form.quantidade_minima) || 5,
      observacoes: form.observacoes || null,
    })
    if (error) showMsg('Erro: ' + error.message)
    else {
      showMsg('Item cadastrado!')
      setForm({ item_nome: '', unidade: 'unidade', quantidade_atual: '', quantidade_minima: '5', observacoes: '' })
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
    const { error } = await supabase.from('materiais_higiene_residente')
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

  async function adicionarItensPadrao() {
    if (!residenteId) return
    const existentes = itens.map(i => i.item_nome)
    const novos = ITENS_PADRAO
      .filter(i => !existentes.includes(i.nome))
      .map(i => ({ residente_id: residenteId, item_nome: i.nome, unidade: i.unidade, quantidade_atual: 0, quantidade_minima: 5 }))
    if (!novos.length) { showMsg('Todos os itens padrão já estão cadastrados.'); return }
    const { error } = await supabase.from('materiais_higiene_residente').insert(novos)
    if (error) showMsg('Erro: ' + error.message)
    else { showMsg(`${novos.length} itens adicionados!`); loadItens(residenteId) }
  }

  const residenteAtual = residentes.find(r => r.id === residenteId)
  const criticos = itens.filter(i => nivelInfo(i.quantidade_atual, i.quantidade_minima).label !== 'OK')

  return (
    <div>
      {msg && (
        <div style={{ background: msg.includes('Erro') ? '#fee2e2' : '#d8f3dc', color: msg.includes('Erro') ? '#991b1b' : '#2d6a4f', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
          {msg}
        </div>
      )}

      {/* Seletor de residente */}
      <div style={{ ...S.card, marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <label style={S.label}>Residente</label>
          <select value={residenteId} onChange={e => setResidenteId(e.target.value)} style={S.select}>
            <option value="">Selecione...</option>
            {residentes.map(r => <option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
          </select>
        </div>
        <button onClick={adicionarItensPadrao} style={S.btnSec}>📋 Adicionar Itens Padrão</button>
        <button onClick={() => setShowForm(s => !s)} style={S.btn()}>+ Adicionar Item</button>
      </div>

      {/* Alertas de estoque baixo */}
      {criticos.length > 0 && residenteId && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
            ⚠️ Itens com estoque baixo — {residenteAtual?.nome}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {criticos.map(i => {
              const n = nivelInfo(i.quantidade_atual, i.quantidade_minima)
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
              <input type="number" value={form.quantidade_atual} onChange={e => upd('quantidade_atual', e.target.value)} style={S.input} placeholder="0" />
            </div>
            <div>
              <label style={S.label}>Qtd. Mínima (alerta)</label>
              <input type="number" value={form.quantidade_minima} onChange={e => upd('quantidade_minima', e.target.value)} style={S.input} placeholder="5" />
            </div>
            <div>
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
              <span style={{ fontSize: '13px' }}>Clique em "Adicionar Itens Padrão" para começar ou "Adicionar Item" para personalizar.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f7f5f0' }}>
                  {['Item', 'Unidade', 'Qtd. Atual', 'Mínimo', 'Status', 'Observações', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase' as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map(item => {
                  const n = nivelInfo(item.quantidade_atual, item.quantidade_minima)
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e0dbd0', background: n.label === 'Crítico' || n.label === 'Esgotado' ? '#fff9f9' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.item_nome}</td>
                      <td style={{ padding: '10px 12px', color: '#9a9588' }}>{item.unidade}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: n.label === 'Esgotado' ? '#dc2626' : '#1a1814' }}>
                        {item.quantidade_atual}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#9a9588' }}>{item.quantidade_minima}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: n.bg, color: n.color }}>
                          {n.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#9a9588' }}>{item.observacoes || '—'}</td>
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
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
              {showMovimento.tipo === 'entrada' ? '+ Entrada de Material' : '− Registrar Uso'}
            </div>
            <div style={{ fontSize: '13px', color: '#5c5850', marginBottom: '16px' }}>
              {showMovimento.item.item_nome} · Atual: {showMovimento.item.quantidade_atual} {showMovimento.item.unidade}
            </div>
            <label style={S.label}>Quantidade ({showMovimento.item.unidade})</label>
            <input
              type="number"
              value={qtdMovimento}
              onChange={e => setQtdMovimento(e.target.value)}
              style={{ ...S.input, fontSize: '18px', textAlign: 'center' as const, marginBottom: '16px' }}
              placeholder="0"
              autoFocus
            />
            {qtdMovimento && (
              <div style={{ fontSize: '12px', color: '#9a9588', marginBottom: '16px' }}>
                Novo total:{' '}
                {showMovimento.tipo === 'entrada'
                  ? showMovimento.item.quantidade_atual + parseFloat(qtdMovimento || '0')
                  : Math.max(0, showMovimento.item.quantidade_atual - parseFloat(qtdMovimento || '0'))
                } {showMovimento.item.unidade}
              </div>
            )}
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
