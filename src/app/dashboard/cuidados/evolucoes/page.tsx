'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { Residente, PostoEnfermagem, POSTO_LABELS, PERMISSIONS, EvolucaoDiaria } from '@/types'

// ── tipos ────────────────────────────────────────────────────
type FormData = {
  hora_sinais: string
  temperatura: string
  fc: string
  fr: string
  pa_s: string
  pa_d: string
  spo2: string
  afebril: boolean
  ritmo: 'normal' | 'taquicardia' | 'bradicardia'
  respiracao: 'eupneia' | 'dispneia'
  hipertenso: boolean
  diabetico: boolean
  hgt: string
  hora_hgt: string
  banho: 'aspersao' | 'leito'
  curativo: boolean
  regiao_curativo: string
  pos_banho: 'leito' | 'sala_tv'
  acamado: boolean
  mudanca_decubito: boolean
  deambula_auxilio: boolean
  agitado: boolean
  dormiu: boolean
  dieta: 'vo' | 'gtt'
  troca_fralda: boolean
  evacuou: boolean
  diurese: boolean
  aceitou_medicacao: boolean
  obs: string
}

const FORM0: FormData = {
  hora_sinais: '', temperatura: '', fc: '', fr: '', pa_s: '', pa_d: '', spo2: '',
  afebril: true, ritmo: 'normal', respiracao: 'eupneia',
  hipertenso: false, diabetico: false, hgt: '', hora_hgt: '',
  banho: 'aspersao', curativo: false, regiao_curativo: '', pos_banho: 'sala_tv',
  acamado: false, mudanca_decubito: false, deambula_auxilio: false, agitado: false,
  dormiu: true, dieta: 'vo', troca_fralda: true, evacuou: false, diurese: true,
  aceitou_medicacao: true, obs: ''
}

function gerarTexto(f: FormData): string {
  const p: string[] = []
  const vitais: string[] = []
  if (f.temperatura) vitais.push(`T: ${f.temperatura}°C`)
  if (f.fc) vitais.push(`FC: ${f.fc}bpm`)
  if (f.fr) vitais.push(`R: ${f.fr}mrpm`)
  if (f.pa_s && f.pa_d) vitais.push(`PA: ${f.pa_s}x${f.pa_d}mmHg`)
  if (f.spo2) vitais.push(`SpO2: ${f.spo2}%`)
  if (vitais.length) p.push(vitais.join(' | ') + '.')
  p.push(f.afebril ? 'Afebril.' : 'Febril.')
  if (f.ritmo === 'taquicardia') p.push('Taquicardia.')
  else if (f.ritmo === 'bradicardia') p.push('Bradicardia.')
  p.push(f.respiracao === 'eupneia' ? 'Eupnéia.' : 'Dispnéia.')
  p.push(f.hipertenso ? 'Hipertenso(a).' : 'Normotenso(a).')
  if (f.diabetico) p.push(`Diabético(a). HGT: ${f.hgt || 'NR'}${f.hora_hgt ? ` às ${f.hora_hgt}h` : ''}.`)
  p.push(`Banho de ${f.banho === 'aspersao' ? 'aspersão' : 'leito'}.`)
  if (f.curativo) p.push(`Curativo realizado${f.regiao_curativo ? ` na região: ${f.regiao_curativo}` : ''}.`)
  p.push(`Após o banho permaneceu em ${f.pos_banho === 'leito' ? 'leito' : 'sala de TV'}.`)
  if (f.acamado) p.push(`Acamado(a). Mudança de decúbito: ${f.mudanca_decubito ? 'realizada' : 'não realizada'}.`)
  if (f.deambula_auxilio) p.push('Deambula com auxílio.')
  if (f.agitado) p.push('Agitado(a).')
  p.push(f.dormiu ? 'Dormiu.' : 'Não dormiu.')
  p.push(`Dieta ${f.dieta === 'vo' ? 'V.O.' : 'GTT'}.`)
  p.push(`Troca de fralda: ${f.troca_fralda ? 'Sim' : 'Não'}. ${f.evacuou ? 'Evacuou.' : 'Não evacuou.'} Diurese ${f.diurese ? 'presente' : 'ausente'}.`)
  p.push(`${f.aceitou_medicacao ? 'Aceitou' : 'Não aceitou'} medicação conforme prescrição.`)
  if (f.obs) p.push(`Obs: ${f.obs}`)
  return p.join(' ')
}

// ── PDF ───────────────────────────────────────────────────────
type EvolucaoComResidente = EvolucaoDiaria & {
  residente?: Pick<Residente, 'id' | 'nome' | 'quarto' | 'posto'>
  assinado_por_profile?: { full_name: string; coren?: string }
  preenchido_por_profile?: { full_name: string; coren?: string }
}

function htmlEvolucao(ev: EvolucaoComResidente): string {
  const dataBR = new Date(ev.data + 'T12:00').toLocaleDateString('pt-BR')
  const turnoLabel = ev.turno === 'diurno' ? 'Diurno (07h–19h)' : 'Noturno (19h–07h)'
  const statusLabel = ev.status === 'assinada' ? 'Assinada' : ev.status === 'pendente' ? 'Pendente' : 'Rascunho'

  const assinante = ev.assinado_por_profile
  const preencheu = ev.preenchido_por_profile
  const assinadoEmBR = ev.assinado_em ? new Date(ev.assinado_em).toLocaleDateString('pt-BR') : '—'
  const signBlock = assinante
    ? `<div style="display:inline-block;text-align:center;margin-top:24px;min-width:220px"><div style="border-top:1px solid #333;padding-top:6px"><div style="font-size:11px;font-weight:700">${assinante.full_name}</div>${assinante.coren ? `<div style="font-size:10px;color:#555">COREN: ${assinante.coren}</div>` : ''}<div style="font-size:10px;color:#666">Assinado em: ${assinadoEmBR}</div></div></div>`
    : `<div style="display:inline-block;text-align:center;margin-top:32px;min-width:220px"><div style="border-top:1px solid #aaa;padding-top:6px">${preencheu ? `<div style="font-size:11px">${preencheu.full_name}${preencheu.coren ? ' · COREN: ' + preencheu.coren : ''}</div>` : ''}<div style="font-size:10px;color:#999">Aguardando assinatura</div></div></div>`

  const campos: [string, string | undefined | null][] = [
    ['Data', dataBR],
    ['Turno', turnoLabel],
    ['Posto', ev.posto ? POSTO_LABELS[ev.posto] : '—'],
    ['Pressão Arterial', ev.pressao_arterial ? ev.pressao_arterial + ' mmHg' : null],
    ['Temperatura', ev.temperatura != null ? ev.temperatura + ' °C' : null],
    ['FC', ev.frequencia_cardiaca != null ? ev.frequencia_cardiaca + ' bpm' : null],
    ['FR', ev.frequencia_respiratoria != null ? ev.frequencia_respiratoria + ' mrpm' : null],
    ['SpO₂', ev.saturacao_o2 != null ? ev.saturacao_o2 + ' %' : null],
    ['Glicemia', ev.glicemia != null ? ev.glicemia + ' mg/dL' : null],
    ['Condição Geral', ev.condicao_geral],
    ['Sono', ev.sono],
    ['Humor', ev.humor],
    ['Alimentação', ev.alimentacao],
    ['Eliminações', ev.eliminacoes],
    ['Higiene', ev.higiene],
    ['Posicionamento', ev.posicionamento],
    ['Hidratação', ev.hidratacao],
  ]

  const vitaisHtml = campos.filter(([, v]) => v).map(([k, v]) =>
    `<tr><td style="padding:4px 8px;font-size:11px;color:#666;width:140px">${k}</td><td style="padding:4px 8px;font-size:11px">${v}</td></tr>`
  ).join('')

  return `
    <div style="border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:24px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div>
          <div style="font-size:16px;font-weight:700;color:#1a1814">${ev.residente?.nome || '—'}</div>
          <div style="font-size:12px;color:#666;margin-top:2px">Quarto ${ev.residente?.quarto || '—'} · ${ev.residente?.posto ? POSTO_LABELS[ev.residente.posto] : '—'}</div>
        </div>
        <div style="font-size:11px;background:#f5f5f5;border-radius:4px;padding:4px 10px;color:#444">${statusLabel}</div>
      </div>
      ${vitaisHtml ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;background:#f9f9f9;border-radius:4px">${vitaisHtml}</table>` : ''}
      <div style="margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:#40916c;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Evolução</div>
        <div style="font-size:12px;line-height:1.8;color:#1a1814">${ev.evolucao_texto}</div>
      </div>
      ${ev.intercorrencias ? `<div style="margin-top:8px;padding:8px 12px;background:#fff8f0;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0"><div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:4px">Intercorrências</div><div style="font-size:12px;color:#1a1814">${ev.intercorrencias}</div></div>` : ''}
      ${ev.pendencias_proximo_turno ? `<div style="margin-top:8px;padding:8px 12px;background:#eff6ff;border-left:3px solid #3b82f6;border-radius:0 4px 4px 0"><div style="font-size:10px;font-weight:700;color:#1d4e89;text-transform:uppercase;margin-bottom:4px">Pendências Próximo Turno</div><div style="font-size:12px;color:#1a1814">${ev.pendencias_proximo_turno}</div></div>` : ''}
      ${ev.medicacoes_administradas ? `<div style="margin-top:8px"><div style="font-size:10px;font-weight:700;color:#5c5850;text-transform:uppercase;margin-bottom:4px">Medicações Administradas</div><div style="font-size:12px;color:#1a1814">${ev.medicacoes_administradas}</div></div>` : ''}
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0">${signBlock}</div>
    </div>`
}

function imprimirEvolucoes(lista: EvolucaoComResidente[]) {
  const w = window.open('', '_blank', 'width=860,height=700')
  if (!w) return
  const corpo = lista.map(htmlEvolucao).join('')
  const titulo = lista.length === 1
    ? `Evolução – ${lista[0].residente?.nome || ''} – ${new Date(lista[0].data + 'T12:00').toLocaleDateString('pt-BR')}`
    : `Evoluções Diárias – ${lista.length} registros`

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>
      @page { margin: 20mm 15mm }
      body { font-family: 'Segoe UI', sans-serif; color: #1a1814; padding: 20px }
      .header { text-align: center; border-bottom: 2px solid #40916c; padding-bottom: 16px; margin-bottom: 24px }
      .brand { font-size: 22px; font-weight: 700; color: #1a1814 }
      .brand span { color: #40916c; font-style: italic }
      .subtitle { font-size: 12px; color: #666; margin-top: 4px }
      @media print { button { display: none } }
    </style>
    </head><body>
    <div class="header">
      <div class="brand">Villa<span>Cuidar</span></div>
      <div class="subtitle">Sistema ILPI · ${titulo}</div>
      <div class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    ${corpo}
    <div style="text-align:center;margin-top:30px">
      <button onclick="window.print()" style="padding:10px 24px;background:#40916c;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">Imprimir / Salvar PDF</button>
    </div>
    </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 600)
}

// ── sub-componentes ───────────────────────────────────────────
function Opc({ label, ativo, onClick }: { label: string; ativo: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
      fontSize: '13px', userSelect: 'none', color: ativo ? '#1a1814' : '#9a9588',
      fontWeight: ativo ? 600 : 400,
    }}>
      <span style={{
        width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${ativo ? '#40916c' : '#ccc8bc'}`,
        background: ativo ? '#40916c' : '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {ativo && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff' }} />}
      </span>
      {label}
    </span>
  )
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span onClick={() => onChange(!checked)} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
      fontSize: '13px', userSelect: 'none', color: checked ? '#1a1814' : '#9a9588',
      fontWeight: checked ? 600 : 400,
    }}>
      <span style={{
        width: '15px', height: '15px', borderRadius: '3px', flexShrink: 0,
        border: `2px solid ${checked ? '#40916c' : '#ccc8bc'}`,
        background: checked ? '#40916c' : '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', color: '#fff',
      }}>
        {checked && '✓'}
      </span>
      {label}
    </span>
  )
}

const inp: React.CSSProperties = {
  border: 'none', borderBottom: '1px solid #ccc8bc', outline: 'none',
  fontSize: '13px', fontFamily: 'inherit', background: 'transparent',
  padding: '2px 4px', width: '60px', textAlign: 'center',
}

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
  padding: '10px 0', borderBottom: '1px solid #f1efe8',
}

const lbl: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#5c5850',
  textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '100px',
}

// ── aba histórico ─────────────────────────────────────────────
function AbaHistorico() {
  const { profile } = useAuth()
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]
  const trintaDias = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [residentes, setResidentes] = useState<Pick<Residente, 'id' | 'nome'>[]>([])
  const [lista, setLista] = useState<EvolucaoComResidente[]>([])
  const [loading, setLoading] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const [filtros, setFiltros] = useState({
    residente_id: '',
    dataInicio: trintaDias,
    dataFim: today,
    turno: '' as '' | 'diurno' | 'noturno',
    status: '' as '' | 'assinada' | 'pendente' | 'rascunho',
  })

  const postoFix = profile?.role === 'cuidador' ? profile.posto : undefined

  useEffect(() => {
    async function loadResidentes() {
      let q = supabase.from('residentes').select('id, nome').eq('status', 'ativo').order('nome')
      if (postoFix) q = q.eq('posto', postoFix)
      const { data } = await q
      setResidentes(data || [])
    }
    loadResidentes()
  }, [])

  const buscar = useCallback(async () => {
    setLoading(true)
    setSelecionados(new Set())
    let q = supabase
      .from('evolucoes_diarias')
      .select('*, residente:residentes(id, nome, quarto, posto), assinado_por_profile:profiles!assinado_por(full_name,coren), preenchido_por_profile:profiles!preenchido_por(full_name,coren)')
      .gte('data', filtros.dataInicio)
      .lte('data', filtros.dataFim)
      .order('data', { ascending: false })
      .order('turno')
      .limit(200)

    if (filtros.residente_id) q = q.eq('residente_id', filtros.residente_id)
    if (filtros.turno) q = q.eq('turno', filtros.turno)
    if (filtros.status) q = q.eq('status', filtros.status)
    if (postoFix) q = q.eq('posto', postoFix)

    const { data } = await q
    setLista((data || []) as EvolucaoComResidente[])
    setLoading(false)
  }, [filtros, postoFix])

  useEffect(() => { buscar() }, [buscar])

  const toggleSel = (id: string) => setSelecionados(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })
  const toggleTodos = () => {
    if (selecionados.size === lista.length) setSelecionados(new Set())
    else setSelecionados(new Set(lista.map(e => e.id)))
  }

  const baixarSelecionados = () => {
    const sel = lista.filter(e => selecionados.has(e.id))
    if (!sel.length) return
    imprimirEvolucoes(sel)
  }

  const corStatus = (s: string) =>
    s === 'assinada' ? '#d8f3dc' : s === 'pendente' ? '#fef3c7' : '#f1efe8'
  const txtStatus = (s: string) =>
    s === 'assinada' ? '#2d6a4f' : s === 'pendente' ? '#92400e' : '#9a9588'
  const labelStatus = (s: string) =>
    s === 'assinada' ? '✅ Assinada' : s === 'pendente' ? '⏳ Pendente' : '📝 Rascunho'

  const updF = (k: string, v: string) => setFiltros(f => ({ ...f, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* filtros */}
      <div style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={lbl as React.CSSProperties}>Residente</div>
            <select value={filtros.residente_id} onChange={e => updF('residente_id', e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #ccc8bc', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}>
              <option value="">Todos</option>
              {residentes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl as React.CSSProperties}>De</div>
            <input type="date" value={filtros.dataInicio} onChange={e => updF('dataInicio', e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #ccc8bc', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }} />
          </div>
          <div>
            <div style={lbl as React.CSSProperties}>Até</div>
            <input type="date" value={filtros.dataFim} onChange={e => updF('dataFim', e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #ccc8bc', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }} />
          </div>
          <div>
            <div style={lbl as React.CSSProperties}>Turno</div>
            <select value={filtros.turno} onChange={e => updF('turno', e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #ccc8bc', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}>
              <option value="">Todos</option>
              <option value="diurno">☀️ Diurno</option>
              <option value="noturno">🌙 Noturno</option>
            </select>
          </div>
          <div>
            <div style={lbl as React.CSSProperties}>Status</div>
            <select value={filtros.status} onChange={e => updF('status', e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #ccc8bc', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}>
              <option value="">Todos</option>
              <option value="assinada">Assinada</option>
              <option value="pendente">Pendente</option>
              <option value="rascunho">Rascunho</option>
            </select>
          </div>
        </div>
      </div>

      {/* barra de ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: '#5c5850' }}>
          {loading ? 'Carregando...' : `${lista.length} registros encontrados`}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {selecionados.size > 0 && (
            <button onClick={baixarSelecionados} style={{
              padding: '8px 16px', background: '#40916c', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
            }}>
              📄 Baixar PDF ({selecionados.size} selecionados)
            </button>
          )}
          {lista.length > 0 && (
            <button onClick={() => imprimirEvolucoes(lista)} style={{
              padding: '8px 16px', background: '#fff', color: '#1a1814', border: '1px solid #e0dbd0',
              borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
            }}>
              📄 Baixar todos ({lista.length})
            </button>
          )}
        </div>
      </div>

      {/* tabela */}
      <div style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', overflow: 'hidden' }}>
        {lista.length === 0 && !loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9a9588', fontSize: '14px' }}>
            Nenhuma evolução encontrada para este filtro.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f5f0', borderBottom: '1px solid #e0dbd0' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: '36px' }}>
                  <input type="checkbox"
                    checked={lista.length > 0 && selecionados.size === lista.length}
                    onChange={toggleTodos}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Residente</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turno</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Evolução (resumo)</th>
                <th style={{ padding: '10px 14px', width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((ev, i) => {
                const sel = selecionados.has(ev.id)
                const dataBR = new Date(ev.data + 'T12:00').toLocaleDateString('pt-BR')
                return (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f1efe8', background: sel ? '#f0faf4' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleSel(ev.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#1a1814', whiteSpace: 'nowrap' }}>{dataBR}</td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#1a1814', fontWeight: 500 }}>
                      {ev.residente?.nome || '—'}
                      <div style={{ fontSize: '11px', color: '#9a9588', fontWeight: 400 }}>Q.{ev.residente?.quarto || '?'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#5c5850', whiteSpace: 'nowrap' }}>
                      {ev.turno === 'diurno' ? '☀️ Diurno' : '🌙 Noturno'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '20px', background: corStatus(ev.status), color: txtStatus(ev.status), fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {labelStatus(ev.status)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#5c5850', maxWidth: '320px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.evolucao_texto}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button onClick={() => imprimirEvolucoes([ev])}
                        title="Baixar PDF"
                        style={{ padding: '5px 10px', background: '#f7f5f0', border: '1px solid #e0dbd0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        📄
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── página principal ──────────────────────────────────────────
export default function EvolucoesPagina() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [aba, setAba] = useState<'novo' | 'historico'>('novo')

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [turno, setTurno] = useState<'diurno' | 'noturno'>(
    new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'diurno' : 'noturno'
  )
  const [posto, setPosto] = useState<PostoEnfermagem | 'todos'>(
    (profile?.posto as PostoEnfermagem) || 'todos'
  )

  const [residentes, setResidentes] = useState<Residente[]>([])
  const [idxAtual, setIdxAtual] = useState(0)
  const [form, setForm] = useState<FormData>({ ...FORM0 })
  const [evolucaoExistente, setEvolucaoExistente] = useState<any>(null)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const canSign = profile && PERMISSIONS.canSignEvolucao(profile.role)
  const canFill = profile && ['admin', 'enfermeira', 'tecnico', 'cuidador'].includes(profile.role)
  const postoFix = profile?.role === 'cuidador' ? profile.posto : undefined

  const loadResidentes = useCallback(async () => {
    let q = supabase.from('residentes').select('*').eq('status', 'ativo').order('nome')
    if (postoFix) q = q.eq('posto', postoFix)
    else if (posto !== 'todos') q = q.eq('posto', posto as PostoEnfermagem)
    const { data: res } = await q
    setResidentes(res || [])
    setIdxAtual(0)
  }, [posto, postoFix])

  const loadStatus = useCallback(async () => {
    if (!residentes.length) return
    const ids = residentes.map(r => r.id)
    const { data: evs } = await supabase
      .from('evolucoes_diarias')
      .select('residente_id, status')
      .eq('data', data)
      .eq('turno', turno)
      .in('residente_id', ids)
    const map: Record<string, string> = {}
    ;(evs || []).forEach(e => { map[e.residente_id] = e.status })
    setStatusMap(map)
  }, [residentes, data, turno])

  const loadEvolucaoAtual = useCallback(async () => {
    const res = residentes[idxAtual]
    if (!res) return
    const { data: ev } = await supabase
      .from('evolucoes_diarias')
      .select('*')
      .eq('residente_id', res.id)
      .eq('data', data)
      .eq('turno', turno)
      .maybeSingle()

    if (ev) {
      setEvolucaoExistente(ev)
      const pa = ev.pressao_arterial?.split('x') || []
      setForm({
        hora_sinais: '',
        temperatura: ev.temperatura?.toString() || '',
        fc: ev.frequencia_cardiaca?.toString() || '',
        fr: ev.frequencia_respiratoria?.toString() || '',
        pa_s: pa[0] || '', pa_d: pa[1] || '',
        spo2: ev.saturacao_o2?.toString() || '',
        afebril: !ev.condicao_geral?.includes('febril') || true,
        ritmo: 'normal', respiracao: 'eupneia',
        hipertenso: false, diabetico: !!ev.glicemia,
        hgt: ev.glicemia?.toString() || '', hora_hgt: '',
        banho: 'aspersao', curativo: false, regiao_curativo: '',
        pos_banho: 'sala_tv', acamado: false, mudanca_decubito: false,
        deambula_auxilio: false, agitado: false,
        dormiu: ev.sono !== 'nao_dormiu',
        dieta: ev.alimentacao === 'gtt' ? 'gtt' : 'vo',
        troca_fralda: true,
        evacuou: ev.eliminacoes?.includes('evacuou') || false,
        diurese: ev.eliminacoes !== 'diurese_ausente',
        aceitou_medicacao: true,
        obs: ev.intercorrencias || '',
      })
    } else {
      setEvolucaoExistente(null)
      setForm({ ...FORM0 })
    }
  }, [residentes, idxAtual, data, turno])

  useEffect(() => { loadResidentes() }, [loadResidentes])
  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { loadEvolucaoAtual() }, [loadEvolucaoAtual])

  const upd = (k: keyof FormData, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function salvar(assinar = false) {
    const res = residentes[idxAtual]
    if (!res) return
    setSaving(true)

    const pa = form.pa_s && form.pa_d ? `${form.pa_s}x${form.pa_d}` : null
    const elimStr = [
      form.evacuou ? 'evacuou' : 'nao_evacuou',
      form.diurese ? 'diurese_presente' : 'diurese_ausente',
    ].join(', ')

    const payload: any = {
      residente_id: res.id,
      data, turno,
      posto: postoFix || (posto !== 'todos' ? posto : res.posto),
      pressao_arterial: pa,
      temperatura: form.temperatura ? parseFloat(form.temperatura) : null,
      saturacao_o2: form.spo2 ? parseFloat(form.spo2) : null,
      frequencia_cardiaca: form.fc ? parseInt(form.fc) : null,
      frequencia_respiratoria: form.fr ? parseInt(form.fr) : null,
      glicemia: form.diabetico && form.hgt ? parseInt(form.hgt) : null,
      condicao_geral: form.afebril ? 'afebril' : 'febril',
      alimentacao: form.dieta,
      eliminacoes: elimStr,
      sono: form.dormiu ? 'dormiu' : 'nao_dormiu',
      humor: form.agitado ? 'agitado' : 'calmo',
      evolucao_texto: gerarTexto(form),
      intercorrencias: form.obs || null,
      status: assinar ? 'assinada' : 'pendente',
      preenchido_por: profile?.id,
      ...(assinar ? { assinado_por: profile?.id, assinado_em: new Date().toISOString() } : {}),
    }

    const { error } = await supabase
      .from('evolucoes_diarias')
      .upsert(payload, { onConflict: 'residente_id,data,turno' })

    setSaving(false)
    if (error) { setMsg('Erro: ' + error.message); return }

    setMsg(assinar ? '✅ Assinada!' : '💾 Salvo!')
    await loadStatus()
    setTimeout(() => {
      setMsg('')
      if (idxAtual < residentes.length - 1) setIdxAtual(i => i + 1)
    }, 800)
  }

  const resAtual = residentes[idxAtual]
  const statusAtual = resAtual ? (statusMap[resAtual.id] || 'vazio') : 'vazio'

  const corStatus = (s: string) =>
    s === 'assinada' ? '#d8f3dc' : s === 'pendente' ? '#fef3c7' : s === 'editada_enfermeira' ? '#dbeafe' : '#f1efe8'
  const txtStatus = (s: string) =>
    s === 'assinada' ? '#2d6a4f' : s === 'pendente' ? '#92400e' : s === 'editada_enfermeira' ? '#1d4e89' : '#9a9588'
  const labelStatus = (s: string) =>
    s === 'assinada' ? '✅ Assinada' : s === 'pendente' ? '⏳ Pendente' : s === 'editada_enfermeira' ? '✏️ Editada' : '— Vazio'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>

      {/* abas */}
      <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', padding: '6px', alignSelf: 'flex-start' }}>
        {([['novo', '📋 Novo Registro'], ['historico', '📜 Histórico']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} style={{
            padding: '7px 18px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            background: aba === id ? '#40916c' : 'transparent',
            color: aba === id ? '#fff' : '#5c5850',
          }}>{label}</button>
        ))}
      </div>

      {aba === 'historico' ? <AbaHistorico /> : (
        <>
          {/* filtros */}
          <div style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', padding: '14px 20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={lbl}>Data</span>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                style={{ border: '1px solid #ccc8bc', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={lbl}>Turno</span>
              <Opc label="☀️ Diurno" ativo={turno === 'diurno'} onClick={() => setTurno('diurno')} />
              <Opc label="🌙 Noturno" ativo={turno === 'noturno'} onClick={() => setTurno('noturno')} />
            </div>
            {!postoFix && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={lbl}>Posto</span>
                <Opc label="Todos" ativo={posto === 'todos'} onClick={() => setPosto('todos')} />
                <Opc label="1º" ativo={posto === 'posto_1'} onClick={() => setPosto('posto_1')} />
                <Opc label="2º" ativo={posto === 'posto_2'} onClick={() => setPosto('posto_2')} />
                <Opc label="3º" ativo={posto === 'posto_3'} onClick={() => setPosto('posto_3')} />
              </div>
            )}
            <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#9a9588' }}>
              {residentes.filter(r => statusMap[r.id] === 'assinada').length}/{residentes.length} assinadas
            </div>
          </div>

          {/* corpo */}
          <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>

            {/* lista de residentes */}
            <div style={{ width: '210px', minWidth: '210px', background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', overflowY: 'auto' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #e0dbd0', fontSize: '11px', fontWeight: 600, color: '#9a9588', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {residentes.length} Idosos
              </div>
              {residentes.length === 0 && (
                <div style={{ padding: '20px', fontSize: '12px', color: '#9a9588', textAlign: 'center' }}>
                  Nenhum residente<br />para este filtro
                </div>
              )}
              {residentes.map((r, i) => {
                const s = statusMap[r.id] || 'vazio'
                const ativo = i === idxAtual
                return (
                  <div key={r.id} onClick={() => setIdxAtual(i)} style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1efe8',
                    background: ativo ? '#f0faf4' : 'transparent',
                    borderLeft: `3px solid ${ativo ? '#40916c' : 'transparent'}`,
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: ativo ? 600 : 400, color: '#1a1814' }}>
                      {r.nome.split(' ').slice(0, 2).join(' ')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9a9588', marginTop: '2px' }}>
                      Q.{r.quarto} · {POSTO_LABELS[r.posto]}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '20px', background: corStatus(s), color: txtStatus(s), fontWeight: 500 }}>
                        {labelStatus(s)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* formulário */}
            {resAtual ? (
              <div style={{ flex: 1, background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', overflowY: 'auto' }}>

                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e0dbd0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1814' }}>{resAtual.nome}</div>
                    <div style={{ fontSize: '12px', color: '#9a9588', marginTop: '2px' }}>
                      Quarto {resAtual.quarto} · {POSTO_LABELS[resAtual.posto]} · {turno === 'diurno' ? '☀️ Diurno' : '🌙 Noturno'} · {new Date(data + 'T12:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: corStatus(statusAtual), color: txtStatus(statusAtual), fontWeight: 500 }}>
                      {labelStatus(statusAtual)}
                    </span>
                    <button disabled={idxAtual === 0} onClick={() => setIdxAtual(i => i - 1)}
                      style={{ padding: '6px 10px', border: '1px solid #e0dbd0', borderRadius: '6px', background: '#f7f5f0', cursor: idxAtual === 0 ? 'not-allowed' : 'pointer', opacity: idxAtual === 0 ? 0.4 : 1, fontSize: '14px' }}>←</button>
                    <span style={{ fontSize: '12px', color: '#9a9588' }}>{idxAtual + 1}/{residentes.length}</span>
                    <button disabled={idxAtual === residentes.length - 1} onClick={() => setIdxAtual(i => i + 1)}
                      style={{ padding: '6px 10px', border: '1px solid #e0dbd0', borderRadius: '6px', background: '#f7f5f0', cursor: idxAtual === residentes.length - 1 ? 'not-allowed' : 'pointer', opacity: idxAtual === residentes.length - 1 ? 0.4 : 1, fontSize: '14px' }}>→</button>
                  </div>
                </div>

                {msg && (
                  <div style={{ margin: '12px 24px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: msg.includes('Erro') ? '#fee2e2' : '#d8f3dc', color: msg.includes('Erro') ? '#991b1b' : '#2d6a4f' }}>
                    {msg}
                  </div>
                )}

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '0' }}>

                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#40916c', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '8px', borderBottom: '2px solid #40916c', marginBottom: '4px' }}>
                    Sinais Vitais
                  </div>

                  <div style={row}>
                    <span style={lbl}>Horário</span>
                    <input value={form.hora_sinais} onChange={e => upd('hora_sinais', e.target.value)}
                      placeholder="07:00" style={{ ...inp, width: '70px' }} />
                    <span style={{ fontSize: '13px', color: '#5c5850' }}>h</span>
                  </div>

                  <div style={row}>
                    <span style={lbl}>Temperatura</span>
                    <input value={form.temperatura} onChange={e => upd('temperatura', e.target.value)}
                      placeholder="36.5" style={inp} type="number" step="0.1" />
                    <span style={{ fontSize: '12px', color: '#9a9588' }}>°C</span>
                    <span style={{ ...lbl, marginLeft: '16px' }}>FC</span>
                    <input value={form.fc} onChange={e => upd('fc', e.target.value)}
                      placeholder="80" style={inp} type="number" />
                    <span style={{ fontSize: '12px', color: '#9a9588' }}>bpm</span>
                    <span style={{ ...lbl, marginLeft: '16px' }}>FR</span>
                    <input value={form.fr} onChange={e => upd('fr', e.target.value)}
                      placeholder="18" style={inp} type="number" />
                    <span style={{ fontSize: '12px', color: '#9a9588' }}>mrpm</span>
                  </div>

                  <div style={row}>
                    <span style={lbl}>Pressão Arterial</span>
                    <input value={form.pa_s} onChange={e => upd('pa_s', e.target.value)}
                      placeholder="120" style={{ ...inp, width: '50px' }} type="number" />
                    <span style={{ fontSize: '13px', color: '#9a9588' }}>×</span>
                    <input value={form.pa_d} onChange={e => upd('pa_d', e.target.value)}
                      placeholder="80" style={{ ...inp, width: '50px' }} type="number" />
                    <span style={{ fontSize: '12px', color: '#9a9588' }}>mmHg</span>
                    <span style={{ ...lbl, marginLeft: '16px' }}>SpO₂</span>
                    <input value={form.spo2} onChange={e => upd('spo2', e.target.value)}
                      placeholder="98" style={inp} type="number" />
                    <span style={{ fontSize: '12px', color: '#9a9588' }}>%</span>
                  </div>

                  <div style={row}>
                    <Opc label="Afebril" ativo={form.afebril} onClick={() => upd('afebril', true)} />
                    <Opc label="Febril" ativo={!form.afebril} onClick={() => upd('afebril', false)} />
                    <span style={{ color: '#e0dbd0', margin: '0 4px' }}>|</span>
                    <Opc label="Ritmo normal" ativo={form.ritmo === 'normal'} onClick={() => upd('ritmo', 'normal')} />
                    <Opc label="Taquicardia" ativo={form.ritmo === 'taquicardia'} onClick={() => upd('ritmo', 'taquicardia')} />
                    <Opc label="Bradicardia" ativo={form.ritmo === 'bradicardia'} onClick={() => upd('ritmo', 'bradicardia')} />
                  </div>

                  <div style={row}>
                    <Opc label="Eupnéia" ativo={form.respiracao === 'eupneia'} onClick={() => upd('respiracao', 'eupneia')} />
                    <Opc label="Dispnéia" ativo={form.respiracao === 'dispneia'} onClick={() => upd('respiracao', 'dispneia')} />
                    <span style={{ color: '#e0dbd0', margin: '0 4px' }}>|</span>
                    <span style={{ fontSize: '13px', color: '#5c5850' }}>Hipertenso:</span>
                    <Opc label="Sim" ativo={form.hipertenso} onClick={() => upd('hipertenso', true)} />
                    <Opc label="Não" ativo={!form.hipertenso} onClick={() => upd('hipertenso', false)} />
                  </div>

                  <div style={row}>
                    <span style={{ fontSize: '13px', color: '#5c5850' }}>Diabético:</span>
                    <Opc label="Sim" ativo={form.diabetico} onClick={() => upd('diabetico', true)} />
                    <Opc label="Não" ativo={!form.diabetico} onClick={() => upd('diabetico', false)} />
                    {form.diabetico && <>
                      <span style={{ fontSize: '12px', color: '#5c5850', marginLeft: '8px' }}>HGT:</span>
                      <input value={form.hgt} onChange={e => upd('hgt', e.target.value)}
                        placeholder="120" style={{ ...inp, width: '55px' }} type="number" />
                      <span style={{ fontSize: '12px', color: '#9a9588' }}>às</span>
                      <input value={form.hora_hgt} onChange={e => upd('hora_hgt', e.target.value)}
                        placeholder="08:00" style={{ ...inp, width: '65px' }} />
                      <span style={{ fontSize: '12px', color: '#9a9588' }}>h</span>
                    </>}
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#40916c', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '8px', borderBottom: '2px solid #40916c', marginBottom: '4px', marginTop: '16px' }}>
                    Cuidados
                  </div>

                  <div style={row}>
                    <span style={lbl}>Banho</span>
                    <Opc label="Aspersão" ativo={form.banho === 'aspersao'} onClick={() => upd('banho', 'aspersao')} />
                    <Opc label="Leito" ativo={form.banho === 'leito'} onClick={() => upd('banho', 'leito')} />
                  </div>

                  <div style={row}>
                    <span style={lbl}>Curativo</span>
                    <Opc label="Sim" ativo={form.curativo} onClick={() => upd('curativo', true)} />
                    <Opc label="Não" ativo={!form.curativo} onClick={() => upd('curativo', false)} />
                    {form.curativo && <>
                      <span style={{ fontSize: '12px', color: '#5c5850' }}>Região:</span>
                      <input value={form.regiao_curativo} onChange={e => upd('regiao_curativo', e.target.value)}
                        placeholder="sacral, membro..." style={{ ...inp, width: '160px', textAlign: 'left' }} />
                    </>}
                  </div>

                  <div style={row}>
                    <span style={lbl}>Após o banho</span>
                    <Opc label="Leito" ativo={form.pos_banho === 'leito'} onClick={() => upd('pos_banho', 'leito')} />
                    <Opc label="Sala de TV" ativo={form.pos_banho === 'sala_tv'} onClick={() => upd('pos_banho', 'sala_tv')} />
                  </div>

                  <div style={row}>
                    <span style={lbl}>Acamado</span>
                    <Opc label="Sim" ativo={form.acamado} onClick={() => upd('acamado', true)} />
                    <Opc label="Não" ativo={!form.acamado} onClick={() => upd('acamado', false)} />
                    {form.acamado && <>
                      <span style={{ fontSize: '13px', color: '#5c5850', marginLeft: '8px' }}>Mud. decúbito:</span>
                      <Opc label="Sim" ativo={form.mudanca_decubito} onClick={() => upd('mudanca_decubito', true)} />
                      <Opc label="Não" ativo={!form.mudanca_decubito} onClick={() => upd('mudanca_decubito', false)} />
                    </>}
                  </div>

                  <div style={row}>
                    <Chk label="Deambula com auxílio" checked={form.deambula_auxilio} onChange={v => upd('deambula_auxilio', v)} />
                    <span style={{ color: '#e0dbd0', margin: '0 8px' }}>|</span>
                    <Chk label="Agitado(a)" checked={form.agitado} onChange={v => upd('agitado', v)} />
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#40916c', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '8px', borderBottom: '2px solid #40916c', marginBottom: '4px', marginTop: '16px' }}>
                    Alimentação e Eliminações
                  </div>

                  <div style={row}>
                    <span style={lbl}>Dormiu</span>
                    <Opc label="Sim" ativo={form.dormiu} onClick={() => upd('dormiu', true)} />
                    <Opc label="Não" ativo={!form.dormiu} onClick={() => upd('dormiu', false)} />
                    <span style={{ ...lbl, marginLeft: '16px' }}>Dieta</span>
                    <Opc label="V.O." ativo={form.dieta === 'vo'} onClick={() => upd('dieta', 'vo')} />
                    <Opc label="GTT" ativo={form.dieta === 'gtt'} onClick={() => upd('dieta', 'gtt')} />
                  </div>

                  <div style={row}>
                    <span style={lbl}>Troca de fralda</span>
                    <Opc label="Sim" ativo={form.troca_fralda} onClick={() => upd('troca_fralda', true)} />
                    <Opc label="Não" ativo={!form.troca_fralda} onClick={() => upd('troca_fralda', false)} />
                    <span style={{ ...lbl, marginLeft: '16px' }}>Evacuou</span>
                    <Opc label="Sim" ativo={form.evacuou} onClick={() => upd('evacuou', true)} />
                    <Opc label="Não" ativo={!form.evacuou} onClick={() => upd('evacuou', false)} />
                  </div>

                  <div style={row}>
                    <span style={lbl}>Diurese presente</span>
                    <Opc label="Sim" ativo={form.diurese} onClick={() => upd('diurese', true)} />
                    <Opc label="Não" ativo={!form.diurese} onClick={() => upd('diurese', false)} />
                    <span style={{ ...lbl, marginLeft: '16px' }}>Aceitou medicação</span>
                    <Opc label="Sim" ativo={form.aceitou_medicacao} onClick={() => upd('aceitou_medicacao', true)} />
                    <Opc label="Não" ativo={!form.aceitou_medicacao} onClick={() => upd('aceitou_medicacao', false)} />
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#40916c', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '8px', borderBottom: '2px solid #40916c', marginBottom: '12px' }}>
                      Observações
                    </div>
                    <textarea
                      value={form.obs}
                      onChange={e => upd('obs', e.target.value)}
                      placeholder="Intercorrências, informações adicionais..."
                      style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '1px solid #ccc8bc', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginTop: '12px', padding: '12px', background: '#f7f5f0', borderRadius: '8px', fontSize: '12px', color: '#5c5850', lineHeight: '1.7' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#9a9588', textTransform: 'uppercase', marginBottom: '4px' }}>Evolução gerada automaticamente:</div>
                    {gerarTexto(form)}
                  </div>

                  {canFill && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e0dbd0' }}>
                      <button onClick={() => salvar(false)} disabled={saving} style={{
                        flex: 1, padding: '12px', background: '#40916c', color: '#fff', border: 'none',
                        borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1, fontFamily: 'inherit'
                      }}>
                        {saving ? 'Salvando...' : '💾 Salvar e Próximo →'}
                      </button>
                      {canSign && (
                        <button onClick={() => salvar(true)} disabled={saving} style={{
                          padding: '12px 20px', background: '#1d4e89', color: '#fff', border: 'none',
                          borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                          opacity: saving ? 0.7 : 1, fontFamily: 'inherit'
                        }}>
                          ✍ Salvar e Assinar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, background: '#fff', border: '1px solid #e0dbd0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a9588', fontSize: '14px' }}>
                {residentes.length === 0 ? 'Nenhum residente encontrado para este filtro.' : 'Selecione um residente na lista.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
