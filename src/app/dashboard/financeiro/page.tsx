'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { LancamentoFinanceiro, TipoLancamento, StatusFinanceiro, PERMISSIONS } from '@/types'
import { esc } from '@/lib/pdf-utils'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  btnPeriod: (active: boolean) => ({ padding:'6px 12px', background: active ? '#40916c' : '#f7f5f0', color: active ? '#fff' : '#5c5850', border: active ? 'none' : '1px solid #e0dbd0', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', fontWeight: active ? 600 as const : 400 as const }),
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

type IlpiCfg = { nomeIlpi: string; logoUrl?: string }

const FORM_LAN_EMPTY = { descricao:'', valor:'', data_vencimento:'', categoria_id:'', residente_id:'', observacoes:'' }
const FORM_REC_EMPTY = { descricao:'', valor:'', residente_id:'', categoria_id:'', dia_vencimento:'10', observacoes:'' }

type Tab = 'receber' | 'pagar' | 'recorrentes'
type Periodo = 'mes_atual' | 'mes_anterior' | 'trimestre' | 'ano' | 'personalizado'

function getPeriodo(p: Periodo): { ini: string; fim: string } {
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()

  if (p === 'mes_atual') {
    const ini = new Date(y, m, 1).toISOString().split('T')[0]
    const fim = new Date(y, m + 1, 0).toISOString().split('T')[0]
    return { ini, fim }
  }
  if (p === 'mes_anterior') {
    const ini = new Date(y, m - 1, 1).toISOString().split('T')[0]
    const fim = new Date(y, m, 0).toISOString().split('T')[0]
    return { ini, fim }
  }
  if (p === 'trimestre') {
    const trimestreInicio = Math.floor(m / 3) * 3
    const ini = new Date(y, trimestreInicio, 1).toISOString().split('T')[0]
    const fim = new Date(y, trimestreInicio + 3, 0).toISOString().split('T')[0]
    return { ini, fim }
  }
  if (p === 'ano') {
    return { ini: `${y}-01-01`, fim: `${y}-12-31` }
  }
  return { ini: '', fim: '' }
}

function imprimirRelatorio(
  lista: LancamentoFinanceiro[],
  categorias: any[],
  tab: Tab,
  filtroIni: string,
  filtroFim: string,
  filtroStatus: string,
  cfg: IlpiCfg
) {
  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const fmtData = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR')
  const hoje = new Date().toISOString().split('T')[0]

  const titulo = tab === 'receber' ? 'Contas a Receber' : 'Contas a Pagar'
  const totPendente = lista.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0)
  const totLiquidado = lista.filter(l => ['pago', 'recebido'].includes(l.status)).reduce((s, l) => s + l.valor, 0)
  const totCancelado = lista.filter(l => l.status === 'cancelado').reduce((s, l) => s + l.valor, 0)
  const totVencido = lista.filter(l => l.status === 'pendente' && l.data_vencimento < hoje).reduce((s, l) => s + l.valor, 0)
  const totGeral = lista.reduce((s, l) => s + l.valor, 0)

  const statusLabel: Record<string, string> = {
    pendente: 'Pendente', pago: 'Pago', recebido: 'Recebido', cancelado: 'Cancelado', vencido: 'Vencido'
  }
  const statusColors: Record<string, string> = {
    pendente: '#92400e', pago: '#2d6a4f', recebido: '#2d6a4f', cancelado: '#5f5e5a', vencido: '#991b1b'
  }
  const statusBg: Record<string, string> = {
    pendente: '#fef3c7', pago: '#d8f3dc', recebido: '#d8f3dc', cancelado: '#f1efe8', vencido: '#fee2e2'
  }

  const periodoTexto = filtroIni && filtroFim
    ? `${fmtData(filtroIni)} a ${fmtData(filtroFim)}`
    : filtroIni ? `A partir de ${fmtData(filtroIni)}`
    : filtroFim ? `Até ${fmtData(filtroFim)}`
    : 'Todo o período'

  const logoHtml = cfg.logoUrl
    ? `<img src="${esc(cfg.logoUrl)}" alt="Logo" style="height:44px;object-fit:contain;display:block;margin-bottom:4px;">`
    : ''

  const linhas = lista.map(l => {
    const vencido = l.status === 'pendente' && l.data_vencimento < hoje
    const catNome = categorias.find(c => c.id === l.categoria_id)?.nome || '—'
    const resNome = (l.residente as any)?.nome || '—'
    const rowBg = vencido ? '#fff9f9' : 'transparent'
    const sc = statusColors[l.status] || '#92400e'
    const sb = statusBg[l.status] || '#fef3c7'
    return `
      <tr style="border-bottom:1px solid #e0dbd0;background:${rowBg};">
        <td style="padding:9px 10px;font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(l.descricao)}</td>
        <td style="padding:9px 10px;font-size:11px;color:#666;">${esc(resNome)}</td>
        <td style="padding:9px 10px;font-size:11px;color:#666;">${esc(catNome)}</td>
        <td style="padding:9px 10px;font-weight:600;color:${tab === 'receber' ? '#2d6a4f' : '#991b1b'};white-space:nowrap;">${fmtBRL(l.valor)}</td>
        <td style="padding:9px 10px;font-size:11px;color:${vencido ? '#991b1b' : '#555'};font-weight:${vencido ? '600' : '400'};">${fmtData(l.data_vencimento)}${vencido ? ' ⚠' : ''}</td>
        <td style="padding:9px 10px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;background:${sb};color:${sc};">
            ${esc(statusLabel[l.status] || l.status)}
          </span>
        </td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <title>Relatório Financeiro — ${titulo}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; color: #1a1814; background:#fff; padding:28px 32px; font-size:13px; }
      @media print { body { padding:16px 20px; } .no-print { display:none; } }
    </style>
  </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #40916c;">
      <div>
        ${logoHtml}
        <div style="font-size:18px;font-weight:700;color:#40916c;">${cfg.nomeIlpi}</div>
        <div style="font-size:10px;color:#888;">Sistema de Gestão ILPI</div>
      </div>
      <div style="text-align:right;font-size:10px;color:#aaa;">
        Gerado em ${new Date().toLocaleString('pt-BR')}
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:20px;font-weight:700;color:#1a1814;margin-bottom:4px;">Relatório Financeiro — ${titulo}</div>
      <div style="font-size:12px;color:#5c5850;">
        Período: <strong>${periodoTexto}</strong>
        ${filtroStatus !== 'todos' ? ` &nbsp;·&nbsp; Status: <strong>${statusLabel[filtroStatus] || filtroStatus}</strong>` : ''}
        &nbsp;·&nbsp; ${lista.length} lançamento(s)
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      <div style="background:#f7f5f0;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#9a9588;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Total Geral</div>
        <div style="font-size:18px;font-weight:700;color:#1a1814;">${fmtBRL(totGeral)}</div>
      </div>
      <div style="background:#fef3c7;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#92400e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pendente</div>
        <div style="font-size:18px;font-weight:700;color:#92400e;">${fmtBRL(totPendente)}</div>
      </div>
      <div style="background:#d8f3dc;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Liquidado</div>
        <div style="font-size:18px;font-weight:700;color:#2d6a4f;">${fmtBRL(totLiquidado)}</div>
      </div>
      <div style="background:#fee2e2;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#991b1b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Vencido</div>
        <div style="font-size:18px;font-weight:700;color:#991b1b;">${fmtBRL(totVencido)}</div>
      </div>
    </div>

    ${lista.length === 0 ? `
      <div style="text-align:center;padding:40px;color:#9a9588;border:1px dashed #e0dbd0;border-radius:10px;">
        Nenhum lançamento encontrado para os filtros selecionados.
      </div>
    ` : `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f7f5f0;">
          <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#5c5850;text-transform:uppercase;letter-spacing:.5px;">Descrição</th>
          <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#5c5850;text-transform:uppercase;letter-spacing:.5px;">Residente</th>
          <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#5c5850;text-transform:uppercase;letter-spacing:.5px;">Categoria</th>
          <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#5c5850;text-transform:uppercase;letter-spacing:.5px;">Valor</th>
          <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#5c5850;text-transform:uppercase;letter-spacing:.5px;">Vencimento</th>
          <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#5c5850;text-transform:uppercase;letter-spacing:.5px;">Status</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
      <tfoot>
        <tr style="background:#f7f5f0;border-top:2px solid #e0dbd0;">
          <td colspan="3" style="padding:10px;font-weight:700;font-size:12px;">TOTAIS</td>
          <td style="padding:10px;font-weight:700;font-size:13px;color:${tab === 'receber' ? '#2d6a4f' : '#991b1b'};">${fmtBRL(totGeral)}</td>
          <td></td>
          <td style="padding:10px;font-size:11px;color:#5c5850;">
            Pend: ${fmtBRL(totPendente)} · Liq: ${fmtBRL(totLiquidado)}${totCancelado > 0 ? ` · Cancel: ${fmtBRL(totCancelado)}` : ''}
          </td>
        </tr>
      </tfoot>
    </table>
    `}

    <div class="no-print" style="margin-top:28px;display:flex;gap:12px;justify-content:center;">
      <button onclick="window.print()" style="padding:10px 28px;background:#40916c;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">🖨 Imprimir / Salvar PDF</button>
      <button onclick="window.close()" style="padding:10px 20px;background:#f7f5f0;color:#1a1814;border:1px solid #e0dbd0;border-radius:8px;font-size:14px;cursor:pointer;">Fechar</button>
    </div>
  </body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (w) { w.document.write(html); w.document.close() }
}

export default function FinanceiroPage() {
  const supabase = createClient()
  const { profile } = useAuth()
  const router = useRouter()
  const hoje = new Date().toISOString().split('T')[0]
  const mesAtual = hoje.slice(0, 7)

  const [tab, setTab] = useState<Tab>('receber')
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [recorrentes, setRecorrentes] = useState<CobrancaRecorrente[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [residentes, setResidentes] = useState<any[]>([])
  const [metricas, setMetricas] = useState({ receberPendente:0, pagarPendente:0, saldoMes:0, vencidos:0 })
  const [ilpiCfg, setIlpiCfg] = useState<IlpiCfg>({ nomeIlpi: 'VillaCuidar' })

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
  const [filtroIni, setFiltroIni] = useState(mesAtual + '-01')
  const [filtroFim, setFiltroFim] = useState(hoje)
  const [periodo, setPeriodo] = useState<Periodo>('mes_atual')
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)

  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (profile && !PERMISSIONS.canAccessFinanceiro(profile.role)) router.push('/dashboard')
  }, [profile])

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const updL = (k: string, v: string) => setFormLan(f => ({ ...f, [k]: v }))
  const updR = (k: string, v: string) => setFormRec(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('configuracoes')
      .select('nome_fantasia, logo_url')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIlpiCfg({ nomeIlpi: (data as any).nome_fantasia || 'VillaCuidar', logoUrl: (data as any).logo_url || undefined })
      })
  }, [])

  function aplicarPeriodo(p: Periodo) {
    setPeriodo(p)
    if (p !== 'personalizado') {
      const { ini, fim } = getPeriodo(p)
      setFiltroIni(ini)
      setFiltroFim(fim)
    }
  }

  function aplicarMes(ym: string) {
    setMesSelecionado(ym)
    setPeriodo('personalizado')
    const [y, m] = ym.split('-').map(Number)
    const ini = new Date(y, m - 1, 1).toISOString().split('T')[0]
    const fim = new Date(y, m, 0).toISOString().split('T')[0]
    setFiltroIni(ini)
    setFiltroFim(fim)
  }

  async function load() {
    const [{ data: cats }, { data: res }] = await Promise.all([
      supabase.from('categorias_financeiras').select('*').order('nome'),
      supabase.from('residentes').select('id,nome').eq('status', 'ativo').order('nome'),
    ])
    setCategorias(cats || [])
    setResidentes(res || [])

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
      setLancamentos(data || [])
    } else {
      const { data } = await supabase.from('cobrancas_recorrentes')
        .select('*, residente:residentes(nome)')
        .order('descricao')
      setRecorrentes(data || [])
    }

    const [{ data: rPend }, { data: pPend }, { data: venc }, { data: mes }] = await Promise.all([
      supabase.from('lancamentos_financeiros').select('valor').eq('tipo', 'receber').eq('status', 'pendente'),
      supabase.from('lancamentos_financeiros').select('valor').eq('tipo', 'pagar').eq('status', 'pendente'),
      supabase.from('lancamentos_financeiros').select('valor').lt('data_vencimento', hoje).eq('status', 'pendente'),
      supabase.from('lancamentos_financeiros').select('tipo,valor').in('status', ['pago', 'recebido']).gte('data_vencimento', mesAtual + '-01').lte('data_vencimento', hoje),
    ])
    const saldo = (mes || []).reduce((s, l) => l.tipo === 'receber' ? s + l.valor : s - l.valor, 0)
    setMetricas({
      receberPendente: (rPend || []).reduce((s, l) => s + l.valor, 0),
      pagarPendente:   (pPend || []).reduce((s, l) => s + l.valor, 0),
      vencidos:        (venc || []).reduce((s, l) => s + l.valor, 0),
      saldoMes: saldo,
    })
  }

  useEffect(() => { load() }, [tab, filtroStatus, filtroIni, filtroFim])

  async function salvarLancamento() {
    if (!formLan.descricao || !formLan.valor || !formLan.data_vencimento) { showMsg('Preencha descrição, valor e vencimento.'); return }
    setSavingLan(true)
    const tipo: TipoLancamento = tab === 'pagar' ? 'pagar' : 'receber'
    const { error } = await supabase.from('lancamentos_financeiros').insert({
      tipo, descricao: formLan.descricao, valor: parseFloat(formLan.valor),
      data_vencimento: formLan.data_vencimento,
      categoria_id: formLan.categoria_id || null,
      residente_id: formLan.residente_id || null,
      observacoes: formLan.observacoes || null,
      status: 'pendente', created_by: profile?.id,
    })
    setSavingLan(false)
    if (error) { showMsg('Erro: ' + error.message); return }
    showMsg('Lançamento criado!'); setFormLan({ ...FORM_LAN_EMPTY }); setShowFormLan(false); load()
  }

  async function baixar(id: string, tipo: TipoLancamento) {
    await supabase.from('lancamentos_financeiros').update({
      status: tipo === 'receber' ? 'recebido' : 'pago',
      data_pagamento: hoje,
    }).eq('id', id)
    load()
  }

  async function cancelar(id: string) {
    await supabase.from('lancamentos_financeiros').update({ status: 'cancelado' }).eq('id', id)
    load()
  }

  async function salvarRecorrente() {
    if (!formRec.descricao || !formRec.valor) { showMsg('Preencha descrição e valor.'); return }
    setSavingRec(true)
    const { error } = await supabase.from('cobrancas_recorrentes').insert({
      descricao: formRec.descricao, valor: parseFloat(formRec.valor),
      residente_id: formRec.residente_id || null,
      categoria_id: formRec.categoria_id || null,
      dia_vencimento: parseInt(formRec.dia_vencimento) || 10,
      observacoes: formRec.observacoes || null, ativa: true,
    })
    setSavingRec(false)
    if (error) { showMsg('Erro: ' + error.message); return }
    showMsg('Cobrança recorrente cadastrada!'); setFormRec({ ...FORM_REC_EMPTY }); setShowFormRec(false); load()
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
    const mesStr = String(mes).padStart(2, '0')

    const { data: jaGeradas } = await supabase.from('lancamentos_financeiros')
      .select('descricao, residente_id')
      .eq('tipo', 'receber')
      .gte('data_vencimento', `${ano}-${mesStr}-01`)
      .lte('data_vencimento', `${ano}-${mesStr}-31`)

    const geradasSet = new Set((jaGeradas || []).map(l => `${l.descricao}|${l.residente_id || ''}`))

    const novos = ativas.filter(r => !geradasSet.has(`${r.descricao}|${r.residente_id || ''}`))
      .map(r => {
        const dia = Math.min(r.dia_vencimento, new Date(ano, mes, 0).getDate())
        return {
          tipo: 'receber' as TipoLancamento,
          descricao: r.descricao,
          valor: r.valor,
          residente_id: r.residente_id,
          categoria_id: r.categoria_id,
          observacoes: r.observacoes,
          data_vencimento: `${ano}-${mesStr}-${String(dia).padStart(2, '0')}`,
          status: 'pendente' as StatusFinanceiro,
          created_by: profile?.id,
        }
      })

    if (!novos.length) { showMsg(`Todas as cobranças deste mês já foram geradas.`); setGerandoMes(false); return }

    const { error } = await supabase.from('lancamentos_financeiros').insert(novos)
    setGerandoMes(false)
    if (error) { showMsg('Erro: ' + error.message); return }
    showMsg(`${novos.length} cobrança(s) gerada(s) para ${mesStr}/${ano}!`)
    setTab('receber'); load()
  }

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const totPendente = lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor, 0)
  const totLiquidado = lancamentos.filter(l => ['pago', 'recebido'].includes(l.status)).reduce((s, l) => s + l.valor, 0)

  const tabStyle = (t: Tab) => ({
    padding:'9px 20px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer',
    background: tab === t ? '#fff' : 'transparent',
    color: tab === t ? (t === 'receber' ? '#2d6a4f' : t === 'pagar' ? '#991b1b' : '#1d4e89') : '#9a9588',
    border:'none', borderBottom: tab === t ? `2px solid ${t === 'receber' ? '#40916c' : t === 'pagar' ? '#dc2626' : '#1d4e89'}` : '2px solid transparent',
    fontFamily:'inherit',
  })

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: 'mes_atual', label: 'Este mês' },
    { key: 'mes_anterior', label: 'Mês anterior' },
    { key: 'trimestre', label: 'Trimestre' },
    { key: 'ano', label: 'Este ano' },
  ]

  return (
    <div>
      {msg && (
        <div style={{ background: msg.includes('Erro') ? '#fee2e2' : '#d8f3dc', color: msg.includes('Erro') ? '#991b1b' : '#2d6a4f', padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px' }}>
          {msg}
        </div>
      )}

      {/* Métricas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'A Receber (pendente)', val:fmtBRL(metricas.receberPendente), color:'#2d6a4f', bg:'#d8f3dc' },
          { label:'A Pagar (pendente)',   val:fmtBRL(metricas.pagarPendente),   color:'#991b1b', bg:'#fee2e2' },
          { label:'Saldo do Mês',         val:fmtBRL(metricas.saldoMes),        color:metricas.saldoMes >= 0 ? '#2d6a4f' : '#991b1b', bg:metricas.saldoMes >= 0 ? '#d8f3dc' : '#fee2e2' },
          { label:'Vencidos',             val:fmtBRL(metricas.vencidos),        color:metricas.vencidos > 0 ? '#991b1b' : '#2d6a4f', bg:metricas.vencidos > 0 ? '#fee2e2' : '#d8f3dc' },
        ].map(m => (
          <div key={m.label} style={{ background:'#fff', border:'1px solid #e0dbd0', borderRadius:'12px', padding:'16px' }}>
            <div style={{ fontSize:'11px', color:'#9a9588', textTransform:'uppercase' as const, letterSpacing:'.5px', marginBottom:'6px' }}>{m.label}</div>
            <div style={{ fontSize:'20px', fontWeight:600, color:m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', borderBottom:'1px solid #e0dbd0', marginBottom:'16px', background:'#fff', borderRadius:'12px 12px 0 0', overflow:'hidden' }}>
        <button style={tabStyle('receber')} onClick={() => setTab('receber')}>↑ Contas a Receber</button>
        <button style={tabStyle('pagar')}   onClick={() => setTab('pagar')}>↓ Contas a Pagar</button>
        <button style={tabStyle('recorrentes')} onClick={() => setTab('recorrentes')}>🔁 Mensalidades Recorrentes</button>
      </div>

      {/* ── RECEBER / PAGAR ─────────────────────────────────── */}
      {tab !== 'recorrentes' && (
        <>
          {/* Filtros + botões */}
          <div style={{ ...S.card, marginBottom:'16px' }}>

            {/* Atalhos de período */}
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' as const, marginBottom:'12px', alignItems:'center' }}>
              <span style={{ fontSize:'11px', color:'#9a9588', marginRight:'4px' }}>Período:</span>
              {PERIODOS.map(p => (
                <button key={p.key} onClick={() => aplicarPeriodo(p.key)} style={S.btnPeriod(periodo === p.key)}>
                  {p.label}
                </button>
              ))}
              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginLeft:'8px' }}>
                <span style={{ fontSize:'11px', color:'#9a9588' }}>Mês:</span>
                <input
                  type="month"
                  value={mesSelecionado}
                  onChange={e => aplicarMes(e.target.value)}
                  style={{ padding:'5px 8px', border:'1px solid #ccc8bc', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer' }}
                />
              </div>
            </div>

            <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' as const, marginBottom:'12px' }}>
              <div style={{ flex:1, minWidth:'120px' }}>
                <label style={S.label}>Status</label>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={S.select}>
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value={tab === 'receber' ? 'recebido' : 'pago'}>{tab === 'receber' ? 'Recebido' : 'Pago'}</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div style={{ flex:1 }}>
                <label style={S.label}>De</label>
                <input type="date" value={filtroIni} onChange={e => { setFiltroIni(e.target.value); setPeriodo('personalizado') }} style={S.input} />
              </div>
              <div style={{ flex:1 }}>
                <label style={S.label}>Até</label>
                <input type="date" value={filtroFim} onChange={e => { setFiltroFim(e.target.value); setPeriodo('personalizado') }} style={S.input} />
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button
                  onClick={() => imprimirRelatorio(lancamentos, categorias, tab, filtroIni, filtroFim, filtroStatus, ilpiCfg)}
                  style={S.btn('#1d4e89')}
                  title="Imprimir / salvar PDF com os filtros atuais"
                >
                  🖨 Relatório PDF
                </button>
                <button onClick={() => { setShowFormLan(s => !s); setFormLan({ ...FORM_LAN_EMPTY }) }}
                  style={S.btn(tab === 'pagar' ? '#dc2626' : '#40916c')}>
                  + {tab === 'receber' ? 'Nova Receita' : 'Nova Despesa'}
                </button>
              </div>
            </div>

            <div style={{ fontSize:'13px', color:'#5c5850', display:'flex', gap:'20px', flexWrap:'wrap' as const }}>
              <span>{lancamentos.length} lançamento(s)</span>
              <span style={{ color:'#5c5850' }}>Pendente: <strong>{fmtBRL(totPendente)}</strong></span>
              <span style={{ color:'#2d6a4f' }}>Liquidado: <strong>{fmtBRL(totLiquidado)}</strong></span>
            </div>
          </div>

          {/* Form novo lançamento */}
          {showFormLan && (
            <div style={{ ...S.card, marginBottom:'16px', borderColor: tab === 'pagar' ? '#fca5a5' : '#b7e4c7' }}>
              <div style={{ fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0' }}>
                {tab === 'receber' ? 'Nova Receita / Cobrança' : 'Nova Despesa / Conta a Pagar'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={S.label}>Descrição *</label>
                  <input value={formLan.descricao} onChange={e => updL('descricao', e.target.value)} style={S.input}
                    placeholder={tab === 'receber' ? 'Ex: Mensalidade — João Silva' : 'Ex: Fornecedor de insumos'} />
                </div>
                <div>
                  <label style={S.label}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={formLan.valor} onChange={e => updL('valor', e.target.value)} style={S.input} placeholder="0,00" />
                </div>
                <div>
                  <label style={S.label}>Vencimento *</label>
                  <input type="date" value={formLan.data_vencimento} onChange={e => updL('data_vencimento', e.target.value)} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Categoria</label>
                  <select value={formLan.categoria_id} onChange={e => updL('categoria_id', e.target.value)} style={S.select}>
                    <option value="">Selecione...</option>
                    {categorias.filter(c => c.tipo === (tab === 'receber' ? 'receber' : 'pagar')).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                {tab === 'receber' && (
                  <div>
                    <label style={S.label}>Residente</label>
                    <select value={formLan.residente_id} onChange={e => updL('residente_id', e.target.value)} style={S.select}>
                      <option value="">Selecione...</option>
                      {residentes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label style={S.label}>Observações</label>
                <textarea value={formLan.observacoes} onChange={e => updL('observacoes', e.target.value)} style={S.textarea} placeholder="Observações adicionais..." />
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={salvarLancamento} disabled={savingLan} style={S.btn(tab === 'pagar' ? '#dc2626' : '#40916c')}>
                  {savingLan ? 'Salvando...' : '💾 Salvar'}
                </button>
                <button onClick={() => setShowFormLan(false)} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div style={S.card}>
            <div style={{ overflowX:'auto' as const }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ background:'#f7f5f0' }}>
                    {['Descrição', 'Residente', 'Categoria', 'Valor', 'Vencimento', 'Status', 'Ação'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left' as const, fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.length === 0 && (
                    <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center' as const, color:'#9a9588' }}>
                      Nenhum lançamento no período selecionado.
                    </td></tr>
                  )}
                  {lancamentos.map(l => {
                    const sc = STATUS_COLORS[l.status] || STATUS_COLORS.pendente
                    const vencido = l.status === 'pendente' && l.data_vencimento < hoje
                    return (
                      <tr key={l.id} style={{ borderBottom:'1px solid #e0dbd0', background: vencido ? '#fff9f9' : 'transparent' }}>
                        <td style={{ padding:'11px 12px', fontWeight:500, maxWidth:'200px', overflow:'hidden' as const, textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{l.descricao}</td>
                        <td style={{ padding:'11px 12px', fontSize:'12px', color:'#9a9588' }}>{(l.residente as any)?.nome || '—'}</td>
                        <td style={{ padding:'11px 12px', fontSize:'12px', color:'#9a9588' }}>{categorias.find(c => c.id === l.categoria_id)?.nome || '—'}</td>
                        <td style={{ padding:'11px 12px', fontWeight:600, color: tab === 'receber' ? '#2d6a4f' : '#991b1b' }}>
                          {fmtBRL(l.valor)}
                        </td>
                        <td style={{ padding:'11px 12px', fontSize:'12px', color: vencido ? '#991b1b' : '#5c5850', fontWeight: vencido ? 600 : 400 }}>
                          {new Date(l.data_vencimento + 'T12:00').toLocaleDateString('pt-BR')}
                          {vencido && ' ⚠️'}
                        </td>
                        <td style={{ padding:'11px 12px' }}>
                          <span style={{ ...sc, display:'inline-flex' as const, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 }}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ padding:'11px 12px' }}>
                          <div style={{ display:'flex', gap:'6px' }}>
                            {l.status === 'pendente' && (
                              <button onClick={() => baixar(l.id, l.tipo)} style={{ ...S.btn('#1d4e89'), padding:'5px 10px', fontSize:'11px' }}>
                                {l.tipo === 'receber' ? 'Recebido' : 'Pago'}
                              </button>
                            )}
                            {l.status === 'pendente' && (
                              <button onClick={() => cancelar(l.id)} style={{ ...S.btnSec, fontSize:'11px', padding:'5px 8px', color:'#dc2626' }}>
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
          <div style={{ ...S.card, marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:'12px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', marginBottom:'4px' }}>Cobranças Recorrentes</div>
              <div style={{ fontSize:'12px', color:'#9a9588' }}>Configure mensalidades e cobranças fixas. Gere os lançamentos do mês com um clique.</div>
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={gerarCobrancasMes} disabled={gerandoMes} style={S.btn('#1d4e89')}>
                {gerandoMes ? 'Gerando...' : '📅 Gerar cobranças do mês'}
              </button>
              <button onClick={() => { setShowFormRec(s => !s); setFormRec({ ...FORM_REC_EMPTY }) }} style={S.btn()}>
                + Nova recorrente
              </button>
            </div>
          </div>

          {/* Form nova recorrente */}
          {showFormRec && (
            <div style={{ ...S.card, marginBottom:'16px', borderColor:'#b7e4c7' }}>
              <div style={{ fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0' }}>
                Nova Cobrança Recorrente
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={S.label}>Descrição *</label>
                  <input value={formRec.descricao} onChange={e => updR('descricao', e.target.value)} style={S.input} placeholder="Ex: Mensalidade" />
                </div>
                <div>
                  <label style={S.label}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={formRec.valor} onChange={e => updR('valor', e.target.value)} style={S.input} placeholder="0,00" />
                </div>
                <div>
                  <label style={S.label}>Residente</label>
                  <select value={formRec.residente_id} onChange={e => updR('residente_id', e.target.value)} style={S.select}>
                    <option value="">Selecione (opcional)</option>
                    {residentes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Categoria</label>
                  <select value={formRec.categoria_id} onChange={e => updR('categoria_id', e.target.value)} style={S.select}>
                    <option value="">Selecione (opcional)</option>
                    {categorias.filter(c => c.tipo === 'receber').map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Dia do Vencimento</label>
                  <input type="number" min="1" max="31" value={formRec.dia_vencimento} onChange={e => updR('dia_vencimento', e.target.value)} style={S.input} />
                </div>
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label style={S.label}>Observações</label>
                <textarea value={formRec.observacoes} onChange={e => updR('observacoes', e.target.value)} style={S.textarea} placeholder="Observações..." />
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={salvarRecorrente} disabled={savingRec} style={S.btn()}>{savingRec ? 'Salvando...' : '💾 Salvar'}</button>
                <button onClick={() => setShowFormRec(false)} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Lista de recorrentes */}
          <div style={S.card}>
            {recorrentes.length === 0 && (
              <div style={{ textAlign:'center' as const, color:'#9a9588', padding:'40px', fontSize:'13px' }}>
                Nenhuma cobrança recorrente cadastrada.<br />Clique em "+ Nova recorrente" para começar.
              </div>
            )}
            {recorrentes.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid #f0ece4', flexWrap:'wrap' as const, gap:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: r.ativa ? '#40916c' : '#ccc', flexShrink:0 }} />
                  <div>
                    <div style={{ fontWeight:500, fontSize:'13px' }}>{r.descricao}</div>
                    <div style={{ fontSize:'11px', color:'#9a9588', marginTop:'2px' }}>
                      {(r.residente as any)?.nome ? `${(r.residente as any).nome} · ` : ''}
                      Vence dia {r.dia_vencimento} · {r.ativa ? 'Ativa' : 'Inativa'}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                  <div style={{ fontWeight:600, fontSize:'15px', color:'#2d6a4f' }}>{fmtBRL(r.valor)}</div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => toggleRecorrente(r.id, r.ativa)} style={{ ...S.btnSec, fontSize:'12px', padding:'5px 10px' }}>
                      {r.ativa ? 'Pausar' : 'Ativar'}
                    </button>
                    <button onClick={() => excluirRecorrente(r.id)} style={{ ...S.btnSec, fontSize:'12px', padding:'5px 10px', color:'#dc2626' }}>
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
