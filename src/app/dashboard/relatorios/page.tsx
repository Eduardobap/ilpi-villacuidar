'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { Residente, KatzAvaliacao, EventoSentinela, GravidadeSentinela } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:'90px' },
  aiBadge: { display:'inline-flex' as const, alignItems:'center' as const, gap:'4px', background:'#ede9fe', color:'#5b21b6', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 as const },
}

type Tab = 'historico' | 'pai' | 'pia' | 'katz' | 'sentinela'

const TIPO_CORES: Record<string, string> = {
  PAI: '#1d4e89', PIA: '#2d6a4f', Katz: '#92400e', Sentinela: '#991b1b'
}
const GRAVIDADE_CORES: Record<GravidadeSentinela, string> = {
  leve: '#2d6a4f', moderado: '#92400e', grave: '#991b1b'
}
const KATZ_CLASSIF = (n: number) => ['G','F','E','D','C','B','A'][n] || 'G'

// ── PDF ─────────────────────────────────────────────────────
function pdfBase(titulo: string, corpo: string) {
  const w = window.open('', '_blank', 'width=860,height=700')
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#1a1814;padding:36px;font-size:13px}
    .header{border-bottom:2px solid #40916c;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
    .logo{font-size:18px;font-weight:700;color:#40916c}
    .meta{color:#888;font-size:11px}
    h2{font-size:15px;font-weight:700;margin-bottom:4px}
    .info{display:flex;gap:24px;margin-bottom:16px;padding:10px 12px;background:#f7f5f0;border-radius:6px}
    .info span{font-size:12px;color:#5c5850} .info strong{color:#1a1814}
    .section{margin-bottom:16px}
    .section-title{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#9a9588;font-weight:700;margin-bottom:6px}
    .section-body{font-size:13px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #e0dbd0;padding-left:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#f7f5f0;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#5c5850;font-weight:700}
    td{padding:9px 10px;border-bottom:1px solid #e0dbd0}
    .score{font-size:28px;font-weight:700;color:#40916c}
    .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600}
    .sep{border:none;border-top:1px solid #e0dbd0;margin:20px 0}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div><div class="logo">VillaCuidar — Sistema ILPI</div></div>
    <div class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  </div>
  ${corpo}
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 600)
}

function htmlPAI(p: any) {
  return `<h2>PAI — Plano de Atenção Individual</h2>
  <div class="info">
    <span><strong>Residente:</strong> ${p.residente?.nome || '—'}</span>
    <span><strong>Quarto:</strong> ${p.residente?.quarto || '—'}</span>
    <span><strong>Início:</strong> ${p.data_inicio ? new Date(p.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
    <span><strong>Validade:</strong> ${p.data_validade ? new Date(p.data_validade+'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
  </div>
  ${p.diagnosticos ? `<div class="section"><div class="section-title">Diagnósticos Ativos</div><div class="section-body">${p.diagnosticos}</div></div>` : ''}
  ${p.objetivos ? `<div class="section"><div class="section-title">Objetivos do Cuidado</div><div class="section-body">${p.objetivos}</div></div>` : ''}
  ${p.metas ? `<div class="section"><div class="section-title">Metas (3 meses)</div><div class="section-body">${p.metas}</div></div>` : ''}
  ${p.intervencoes ? `<div class="section"><div class="section-title">Intervenções da Equipe</div><div class="section-body">${p.intervencoes}</div></div>` : ''}`
}

function htmlPIA(p: any) {
  return `<h2>PIA — Plano Individual de Atenção</h2>
  <div class="info">
    <span><strong>Residente:</strong> ${p.residente?.nome || '—'}</span>
    <span><strong>Quarto:</strong> ${p.residente?.quarto || '—'}</span>
    <span><strong>Data:</strong> ${p.data ? new Date(p.data+'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
  </div>
  ${p.avaliacao_funcional ? `<div class="section"><div class="section-title">Avaliação Funcional</div><div class="section-body">${p.avaliacao_funcional}</div></div>` : ''}
  ${p.aspectos_sociais ? `<div class="section"><div class="section-title">Aspectos Sociais e Familiares</div><div class="section-body">${p.aspectos_sociais}</div></div>` : ''}
  ${p.atividades_preferidas ? `<div class="section"><div class="section-title">Atividades Preferidas</div><div class="section-body">${p.atividades_preferidas}</div></div>` : ''}
  ${p.plano_vida ? `<div class="section"><div class="section-title">Plano de Vida</div><div class="section-body">${p.plano_vida}</div></div>` : ''}
  ${p.preferencias ? `<div class="section"><div class="section-title">Preferências</div><div class="section-body">${p.preferencias}</div></div>` : ''}`
}

function htmlKatz(k: KatzAvaliacao) {
  const pontuacao = k.banho + k.vestuario + k.higiene + k.transferencia + k.continencia + k.alimentacao
  const atividades = [
    ['Banho', k.banho], ['Vestuário', k.vestuario], ['Higiene Íntima', k.higiene],
    ['Transferência', k.transferencia], ['Continência', k.continencia], ['Alimentação', k.alimentacao]
  ]
  return `<h2>Índice de Katz — Avaliação de Independência Funcional</h2>
  <div class="info">
    <span><strong>Residente:</strong> ${k.residente?.nome || '—'}</span>
    <span><strong>Quarto:</strong> ${k.residente?.quarto || '—'}</span>
    <span><strong>Data:</strong> ${new Date(k.data+'T12:00').toLocaleDateString('pt-BR')}</span>
  </div>
  <table>
    <thead><tr><th>Atividade</th><th>Pontuação</th><th>Classificação</th></tr></thead>
    <tbody>
      ${atividades.map(([nome, val]) => `<tr><td>${nome}</td><td>${val}</td><td>${val === 1 ? 'Independente' : 'Dependente'}</td></tr>`).join('')}
      <tr style="font-weight:700;background:#f7f5f0"><td>TOTAL</td><td colspan="2"><span class="score">${pontuacao}/6</span> — Classificação <strong>${KATZ_CLASSIF(pontuacao)}</strong></td></tr>
    </tbody>
  </table>
  ${k.observacoes ? `<div class="section"><div class="section-title">Observações</div><div class="section-body">${k.observacoes}</div></div>` : ''}`
}

function htmlSentinela(e: EventoSentinela) {
  const corGrav: Record<string,string> = { leve:'#2d6a4f', moderado:'#92400e', grave:'#991b1b' }
  return `<h2>Evento Sentinela</h2>
  <div class="info">
    <span><strong>Residente:</strong> ${e.residente?.nome || '—'}</span>
    <span><strong>Quarto:</strong> ${e.residente?.quarto || '—'}</span>
    <span><strong>Data:</strong> ${new Date(e.data+'T12:00').toLocaleDateString('pt-BR')}</span>
    <span><strong>Tipo:</strong> ${e.tipo}</span>
  </div>
  <div class="section"><div class="section-title">Gravidade</div><div class="section-body"><span class="badge" style="background:${corGrav[e.gravidade]}15;color:${corGrav[e.gravidade]}">${e.gravidade.toUpperCase()}</span></div></div>
  <div class="section"><div class="section-title">Descrição do Evento</div><div class="section-body">${e.descricao}</div></div>
  ${e.conduta ? `<div class="section"><div class="section-title">Conduta Adotada</div><div class="section-body">${e.conduta}</div></div>` : ''}
  <div class="section"><div class="section-title">Status</div><div class="section-body">${e.resolvido ? '✔ Resolvido' : 'Em acompanhamento'}</div></div>`
}

function baixarPDFItem(tipo: string, dado: any) {
  const html = tipo === 'PAI' ? htmlPAI(dado) : tipo === 'PIA' ? htmlPIA(dado) : tipo === 'Katz' ? htmlKatz(dado) : htmlSentinela(dado)
  pdfBase(`${tipo} — ${dado.residente?.nome || ''}`, html)
}

function baixarPDFLote(selecionados: {tipo: string; dado: any}[]) {
  const corpo = selecionados.map((s, i) => {
    const html = s.tipo === 'PAI' ? htmlPAI(s.dado) : s.tipo === 'PIA' ? htmlPIA(s.dado) : s.tipo === 'Katz' ? htmlKatz(s.dado) : htmlSentinela(s.dado)
    return html + (i < selecionados.length - 1 ? '<hr class="sep">' : '')
  }).join('')
  pdfBase(`Relatórios Selecionados (${selecionados.length})`, corpo)
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function RelatoriosPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('historico')
  const [residentes, setResidentes] = useState<Pick<Residente,'id'|'nome'|'quarto'>[]>([])
  const [pais, setPais] = useState<any[]>([])
  const [pias, setPias] = useState<any[]>([])
  const [katzList, setKatzList] = useState<KatzAvaliacao[]>([])
  const [sentinelaList, setSentinelaList] = useState<EventoSentinela[]>([])

  // Filtros do histórico
  const [hFiltroTipo, setHFiltroTipo] = useState('todos')
  const [hFiltroRes, setHFiltroRes] = useState('')
  const [hDataIni, setHDataIni] = useState('')
  const [hDataFim, setHDataFim] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  // PAI form
  const [paiForm, setPaiForm] = useState({ residente_id:'', data_inicio: new Date().toISOString().split('T')[0], data_validade:'', diagnosticos:'', objetivos:'', metas:'', intervencoes:'' })
  // PIA form
  const [piaForm, setPiaForm] = useState({ residente_id:'', data: new Date().toISOString().split('T')[0], avaliacao_funcional:'', aspectos_sociais:'', atividades_preferidas:'', plano_vida:'', preferencias:'' })
  // Katz form
  const KATZ0 = { residente_id:'', data: new Date().toISOString().split('T')[0], banho:0, vestuario:0, higiene:0, transferencia:0, continencia:0, alimentacao:0, observacoes:'' }
  const [katzForm, setKatzForm] = useState({ ...KATZ0 })
  // Sentinela form
  const SENT0 = { residente_id:'', data: new Date().toISOString().split('T')[0], tipo:'Queda', descricao:'', gravidade:'leve' as GravidadeSentinela, conduta:'', resolvido: false }
  const [sentForm, setSentForm] = useState({ ...SENT0 })

  const [loadingAI, setLoadingAI] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: res } = await supabase.from('residentes').select('id,nome,quarto').eq('status','ativo').order('nome')
    setResidentes(res || [])
    const { data: paiData } = await supabase.from('pai').select('*, residente:residentes(id,nome,quarto)').order('created_at',{ascending:false})
    setPais(paiData || [])
    const { data: piaData } = await supabase.from('pia').select('*, residente:residentes(id,nome,quarto)').order('created_at',{ascending:false})
    setPias(piaData || [])
    const { data: kData } = await supabase.from('katz_avaliacoes').select('*, residente:residentes(id,nome,quarto)').order('data',{ascending:false})
    setKatzList((kData || []) as KatzAvaliacao[])
    const { data: sData } = await supabase.from('eventos_sentinela').select('*, residente:residentes(id,nome,quarto)').order('data',{ascending:false})
    setSentinelaList((sData || []) as EventoSentinela[])
  }

  useEffect(() => { load() }, [])

  // ── Histórico combinado com filtros ──
  const todosItens = [
    ...pais.map(d => ({ tipo:'PAI', id:'pai_'+d.id, data:d.data_inicio, residente_id: d.residente_id, dado: d })),
    ...pias.map(d => ({ tipo:'PIA', id:'pia_'+d.id, data:d.data, residente_id: d.residente_id, dado: d })),
    ...katzList.map(d => ({ tipo:'Katz', id:'katz_'+d.id, data:d.data, residente_id: d.residente_id, dado: d })),
    ...sentinelaList.map(d => ({ tipo:'Sentinela', id:'sent_'+d.id, data:d.data, residente_id: d.residente_id, dado: d })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  const itensFiltrados = todosItens.filter(item => {
    if (hFiltroTipo !== 'todos' && item.tipo !== hFiltroTipo) return false
    if (hFiltroRes && item.residente_id !== hFiltroRes) return false
    if (hDataIni && item.data < hDataIni) return false
    if (hDataFim && item.data > hDataFim) return false
    return true
  })

  function toggleSel(id: string) {
    setSelecionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodos() {
    if (selecionados.size === itensFiltrados.length) setSelecionados(new Set())
    else setSelecionados(new Set(itensFiltrados.map(i => i.id)))
  }
  function baixarSelecionados() {
    const lista = itensFiltrados.filter(i => selecionados.has(i.id)).map(i => ({ tipo: i.tipo, dado: i.dado }))
    if (!lista.length) return
    if (lista.length === 1) baixarPDFItem(lista[0].tipo, lista[0].dado)
    else baixarPDFLote(lista)
  }

  // ── PAI/PIA IA ──
  async function gerarPAI_IA() {
    if (!paiForm.residente_id) { setMsg('Selecione um residente.'); return }
    setLoadingAI(true)
    const res = await fetch('/api/relatorios/gerar-pai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ residente_id: paiForm.residente_id }) })
    const json = await res.json()
    setLoadingAI(false)
    if (json.diagnosticos) { setPaiForm(f => ({...f, ...json})); setMsg('✦ IA preencheu o PAI. Revise antes de salvar.') }
    else setMsg('Erro ao gerar com IA: ' + (json.error||''))
    setTimeout(() => setMsg(''), 5000)
  }

  async function gerarPIA_IA() {
    if (!piaForm.residente_id) { setMsg('Selecione um residente.'); return }
    setLoadingAI(true)
    const res = await fetch('/api/relatorios/gerar-pia', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ residente_id: piaForm.residente_id }) })
    const json = await res.json()
    setLoadingAI(false)
    if (json.avaliacao_funcional) { setPiaForm(f => ({...f, ...json})); setMsg('✦ IA preencheu o PIA. Revise antes de salvar.') }
    else setMsg('Erro: ' + (json.error||''))
    setTimeout(() => setMsg(''), 5000)
  }

  async function salvarPAI() {
    if (!paiForm.residente_id || !paiForm.data_inicio || !paiForm.data_validade) { setMsg('Preencha residente, início e validade.'); return }
    setSaving(true)
    const { error } = await supabase.from('pai').insert({ ...paiForm, responsavel_id: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: '+error.message); return }
    setMsg('PAI salvo!'); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  async function salvarPIA() {
    if (!piaForm.residente_id || !piaForm.data) { setMsg('Preencha residente e data.'); return }
    setSaving(true)
    const { error } = await supabase.from('pia').insert({ ...piaForm, responsavel_id: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: '+error.message); return }
    setMsg('PIA salvo!'); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  async function salvarKatz() {
    if (!katzForm.residente_id) { setMsg('Selecione um residente.'); return }
    setSaving(true)
    const { error } = await supabase.from('katz_avaliacoes').insert({ ...katzForm, created_by: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: '+error.message); return }
    setMsg('Avaliação de Katz salva!'); setKatzForm({ ...KATZ0 }); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  async function salvarSentinela() {
    if (!sentForm.residente_id || !sentForm.descricao) { setMsg('Preencha residente e descrição.'); return }
    setSaving(true)
    const { error } = await supabase.from('eventos_sentinela').insert({ ...sentForm, created_by: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: '+error.message); return }
    setMsg('Evento sentinela registrado!'); setSentForm({ ...SENT0 }); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  const TABS: {id:Tab; label:string}[] = [
    {id:'historico', label:'📋 Histórico'},
    {id:'pai', label:'📄 Novo PAI'},
    {id:'pia', label:'📄 Novo PIA'},
    {id:'katz', label:'📊 Índice de Katz'},
    {id:'sentinela', label:'🚨 Evento Sentinela'},
  ]

  const KatzOpc = ({ label, val, onChange }: { label: string; val: number; onChange: (v: number) => void }) => (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', border:'1px solid #e0dbd0', borderRadius:'10px'}}>
      <span style={{fontSize:'13px', fontWeight:500}}>{label}</span>
      <div style={{display:'flex', gap:'8px'}}>
        {[0,1].map(v => (
          <span key={v} onClick={() => onChange(v)} style={{
            padding:'5px 14px', borderRadius:'20px', fontSize:'12px', cursor:'pointer', fontWeight:500,
            background: val===v ? (v===1?'#d8f3dc':'#fee2e2') : '#f7f5f0',
            color: val===v ? (v===1?'#2d6a4f':'#991b1b') : '#9a9588',
            border: `1px solid ${val===v ? (v===1?'#b7e4c7':'#fecaca') : '#e0dbd0'}`
          }}>
            {v===1 ? 'Independente' : 'Dependente'}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      {msg && <div style={{background:msg.includes('Erro')?'#fee2e2':msg.startsWith('✦')?'#ede9fe':'#d8f3dc', color:msg.includes('Erro')?'#991b1b':msg.startsWith('✦')?'#5b21b6':'#2d6a4f', padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px'}}>{msg}</div>}

      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
        <div style={{display:'flex', gap:'0', flexWrap:'wrap' as const}}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'9px 16px', fontSize:'13px', fontWeight:500, cursor:'pointer',
              background: tab===t.id?'#fff':'transparent', color: tab===t.id?'#40916c':'#9a9588',
              border:'none', borderBottom: tab===t.id?'2px solid #40916c':'2px solid transparent', fontFamily:'inherit'
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── HISTÓRICO ── */}
      {tab==='historico' && (
        <div>
          {/* Filtros */}
          <div style={{...S.card, marginBottom:'14px', display:'flex', gap:'10px', flexWrap:'wrap' as const, alignItems:'flex-end'}}>
            <div style={{flex:1, minWidth:'140px'}}>
              <label style={S.label}>Tipo</label>
              <select value={hFiltroTipo} onChange={e=>setHFiltroTipo(e.target.value)} style={S.select}>
                <option value="todos">Todos</option>
                <option value="PAI">PAI</option>
                <option value="PIA">PIA</option>
                <option value="Katz">Índice de Katz</option>
                <option value="Sentinela">Eventos Sentinela</option>
              </select>
            </div>
            <div style={{flex:2, minWidth:'180px'}}>
              <label style={S.label}>Residente</label>
              <select value={hFiltroRes} onChange={e=>setHFiltroRes(e.target.value)} style={S.select}>
                <option value="">Todos</option>
                {residentes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div style={{minWidth:'130px'}}>
              <label style={S.label}>Data inicial</label>
              <input type="date" value={hDataIni} onChange={e=>setHDataIni(e.target.value)} style={S.input}/>
            </div>
            <div style={{minWidth:'130px'}}>
              <label style={S.label}>Data final</label>
              <input type="date" value={hDataFim} onChange={e=>setHDataFim(e.target.value)} style={S.input}/>
            </div>
            <button onClick={() => { setHFiltroTipo('todos'); setHFiltroRes(''); setHDataIni(''); setHDataFim('') }} style={S.btnSec}>Limpar</button>
          </div>

          {/* Barra de ações */}
          <div style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'12px'}}>
            <label style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', cursor:'pointer', color:'#5c5850'}}>
              <input type="checkbox" checked={selecionados.size === itensFiltrados.length && itensFiltrados.length > 0} onChange={toggleTodos}/>
              Selecionar todos ({itensFiltrados.length})
            </label>
            {selecionados.size > 0 && (
              <>
                <button onClick={baixarSelecionados} style={S.btn()}>
                  📄 Baixar PDF ({selecionados.size} selecionado{selecionados.size>1?'s':''})
                </button>
                <button onClick={() => setSelecionados(new Set())} style={S.btnSec}>Limpar seleção</button>
              </>
            )}
            <div style={{marginLeft:'auto', display:'flex', gap:'8px'}}>
              <button onClick={() => setTab('pai')} style={{...S.btnSec, fontSize:'12px'}}>+ PAI</button>
              <button onClick={() => setTab('pia')} style={{...S.btnSec, fontSize:'12px'}}>+ PIA</button>
              <button onClick={() => setTab('katz')} style={{...S.btnSec, fontSize:'12px'}}>+ Katz</button>
              <button onClick={() => setTab('sentinela')} style={{...S.btnSec, fontSize:'12px'}}>+ Sentinela</button>
            </div>
          </div>

          {/* Tabela */}
          <div style={S.card}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
              <thead>
                <tr style={{background:'#f7f5f0'}}>
                  <th style={{padding:'10px', width:'32px'}}></th>
                  {['Tipo','Residente','Quarto','Data','Resumo','Ações'].map(h => (
                    <th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 && (
                  <tr><td colSpan={7} style={{padding:'32px', textAlign:'center' as const, color:'#9a9588'}}>Nenhum registro encontrado.</td></tr>
                )}
                {itensFiltrados.map(item => {
                  const cor = TIPO_CORES[item.tipo] || '#5f5e5a'
                  const resumo = item.tipo === 'PAI' ? (item.dado.diagnosticos?.slice(0,60)||'') :
                    item.tipo === 'PIA' ? (item.dado.avaliacao_funcional?.slice(0,60)||'') :
                    item.tipo === 'Katz' ? `Pontuação: ${item.dado.banho+item.dado.vestuario+item.dado.higiene+item.dado.transferencia+item.dado.continencia+item.dado.alimentacao}/6` :
                    `${item.dado.tipo} — ${item.dado.gravidade}`
                  return (
                    <tr key={item.id} style={{borderBottom:'1px solid #e0dbd0', background: selecionados.has(item.id)?'#f0fdf4':'transparent'}}>
                      <td style={{padding:'10px', textAlign:'center' as const}}>
                        <input type="checkbox" checked={selecionados.has(item.id)} onChange={() => toggleSel(item.id)}/>
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <span style={{padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600, background:`${cor}15`, color:cor}}>{item.tipo}</span>
                      </td>
                      <td style={{padding:'10px 12px', fontWeight:500}}>{item.dado.residente?.nome || '—'}</td>
                      <td style={{padding:'10px 12px', fontSize:'12px'}}>{item.dado.residente?.quarto || '—'}</td>
                      <td style={{padding:'10px 12px', fontSize:'12px', color:'#5c5850'}}>{new Date(item.data+'T12:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{padding:'10px 12px', fontSize:'12px', color:'#9a9588', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const}}>{resumo}</td>
                      <td style={{padding:'10px 12px'}}>
                        <button onClick={() => baixarPDFItem(item.tipo, item.dado)} style={{...S.btnSec, fontSize:'11px', padding:'5px 10px'}}>📄 PDF</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NOVO PAI ── */}
      {tab==='pai' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                <div style={{fontWeight:600, fontSize:'14px'}}>PAI — Identificação</div>
                <span style={S.aiBadge}>✦ IA disponível</span>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Residente *</label>
                <select value={paiForm.residente_id} onChange={e=>setPaiForm(f=>({...f,residente_id:e.target.value}))} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px'}}>
                <div><label style={S.label}>Início *</label><input type="date" value={paiForm.data_inicio} onChange={e=>setPaiForm(f=>({...f,data_inicio:e.target.value}))} style={S.input}/></div>
                <div><label style={S.label}>Válido até *</label><input type="date" value={paiForm.data_validade} onChange={e=>setPaiForm(f=>({...f,data_validade:e.target.value}))} style={S.input}/></div>
              </div>
              <button onClick={gerarPAI_IA} disabled={loadingAI||!paiForm.residente_id} style={S.btn('#5b21b6')}>
                {loadingAI ? '⏳ Gerando...' : '✦ Gerar com IA'}
              </button>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Conteúdo</div>
              <div style={{marginBottom:'10px'}}><label style={S.label}>Diagnósticos Ativos</label><textarea value={paiForm.diagnosticos} onChange={e=>setPaiForm(f=>({...f,diagnosticos:e.target.value}))} style={S.textarea}/></div>
              <div style={{marginBottom:'10px'}}><label style={S.label}>Objetivos</label><textarea value={paiForm.objetivos} onChange={e=>setPaiForm(f=>({...f,objetivos:e.target.value}))} style={S.textarea}/></div>
              <div style={{marginBottom:'10px'}}><label style={S.label}>Metas (3 meses)</label><textarea value={paiForm.metas} onChange={e=>setPaiForm(f=>({...f,metas:e.target.value}))} style={S.textarea}/></div>
              <div style={{marginBottom:'16px'}}><label style={S.label}>Intervenções</label><textarea value={paiForm.intervencoes} onChange={e=>setPaiForm(f=>({...f,intervencoes:e.target.value}))} style={S.textarea}/></div>
              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={salvarPAI} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar PAI'}</button>
                <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NOVO PIA ── */}
      {tab==='pia' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>
                <div style={{fontWeight:600, fontSize:'14px'}}>PIA — Identificação</div>
                <span style={S.aiBadge}>✦ IA disponível</span>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={S.label}>Residente *</label>
                <select value={piaForm.residente_id} onChange={e=>setPiaForm(f=>({...f,residente_id:e.target.value}))} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>
              <div style={{marginBottom:'14px'}}><label style={S.label}>Data *</label><input type="date" value={piaForm.data} onChange={e=>setPiaForm(f=>({...f,data:e.target.value}))} style={S.input}/></div>
              <button onClick={gerarPIA_IA} disabled={loadingAI||!piaForm.residente_id} style={S.btn('#5b21b6')}>{loadingAI?'⏳ Gerando...':'✦ Gerar com IA'}</button>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column' as const, gap:'16px'}}>
            <div style={S.card}>
              <div style={{fontWeight:600, fontSize:'14px', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Conteúdo</div>
              <div style={{marginBottom:'10px'}}><label style={S.label}>Avaliação Funcional</label><select value={piaForm.avaliacao_funcional} onChange={e=>setPiaForm(f=>({...f,avaliacao_funcional:e.target.value}))} style={S.select}><option value="">Selecione...</option><option>Independente</option><option>Dependência leve</option><option>Dependência moderada</option><option>Dependência total</option></select></div>
              <div style={{marginBottom:'10px'}}><label style={S.label}>Aspectos Sociais e Familiares</label><textarea value={piaForm.aspectos_sociais} onChange={e=>setPiaForm(f=>({...f,aspectos_sociais:e.target.value}))} style={S.textarea}/></div>
              <div style={{marginBottom:'10px'}}><label style={S.label}>Atividades Preferidas</label><textarea value={piaForm.atividades_preferidas} onChange={e=>setPiaForm(f=>({...f,atividades_preferidas:e.target.value}))} style={S.textarea}/></div>
              <div style={{marginBottom:'10px'}}><label style={S.label}>Plano de Vida</label><textarea value={piaForm.plano_vida} onChange={e=>setPiaForm(f=>({...f,plano_vida:e.target.value}))} style={S.textarea}/></div>
              <div style={{marginBottom:'16px'}}><label style={S.label}>Preferências</label><textarea value={piaForm.preferencias} onChange={e=>setPiaForm(f=>({...f,preferencias:e.target.value}))} style={S.textarea}/></div>
              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={salvarPIA} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar PIA'}</button>
                <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ÍNDICE DE KATZ ── */}
      {tab==='katz' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          <div style={S.card}>
            <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Identificação</div>
            <div style={{marginBottom:'12px'}}>
              <label style={S.label}>Residente *</label>
              <select value={katzForm.residente_id} onChange={e=>setKatzForm(f=>({...f,residente_id:e.target.value}))} style={S.select}>
                <option value="">Selecione...</option>
                {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
              </select>
            </div>
            <div style={{marginBottom:'16px'}}><label style={S.label}>Data *</label><input type="date" value={katzForm.data} onChange={e=>setKatzForm(f=>({...f,data:e.target.value}))} style={S.input}/></div>

            {/* Score preview */}
            {katzForm.residente_id && (
              <div style={{background:'#f7f5f0', borderRadius:'10px', padding:'14px', textAlign:'center' as const}}>
                <div style={{fontSize:'11px', color:'#9a9588', marginBottom:'4px', textTransform:'uppercase' as const}}>Pontuação Total</div>
                <div style={{fontSize:'32px', fontWeight:700, color:'#40916c'}}>
                  {katzForm.banho+katzForm.vestuario+katzForm.higiene+katzForm.transferencia+katzForm.continencia+katzForm.alimentacao}
                  <span style={{fontSize:'16px', color:'#9a9588'}}>/6</span>
                </div>
                <div style={{fontSize:'13px', fontWeight:500, marginTop:'4px'}}>
                  Classificação {KATZ_CLASSIF(katzForm.banho+katzForm.vestuario+katzForm.higiene+katzForm.transferencia+katzForm.continencia+katzForm.alimentacao)}
                </div>
              </div>
            )}
          </div>
          <div style={S.card}>
            <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Atividades da Vida Diária</div>
            <div style={{display:'flex', flexDirection:'column' as const, gap:'8px', marginBottom:'14px'}}>
              <KatzOpc label="1. Banho" val={katzForm.banho} onChange={v=>setKatzForm(f=>({...f,banho:v}))}/>
              <KatzOpc label="2. Vestuário" val={katzForm.vestuario} onChange={v=>setKatzForm(f=>({...f,vestuario:v}))}/>
              <KatzOpc label="3. Higiene Íntima (Toilete)" val={katzForm.higiene} onChange={v=>setKatzForm(f=>({...f,higiene:v}))}/>
              <KatzOpc label="4. Transferência / Mobilidade" val={katzForm.transferencia} onChange={v=>setKatzForm(f=>({...f,transferencia:v}))}/>
              <KatzOpc label="5. Continência" val={katzForm.continencia} onChange={v=>setKatzForm(f=>({...f,continencia:v}))}/>
              <KatzOpc label="6. Alimentação" val={katzForm.alimentacao} onChange={v=>setKatzForm(f=>({...f,alimentacao:v}))}/>
            </div>
            <div style={{marginBottom:'14px'}}><label style={S.label}>Observações</label><textarea value={katzForm.observacoes} onChange={e=>setKatzForm(f=>({...f,observacoes:e.target.value}))} style={{...S.textarea, minHeight:'60px'}} placeholder="Observações clínicas relevantes..."/></div>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={salvarKatz} disabled={saving} style={S.btn()}>{saving?'Salvando...':'💾 Salvar Avaliação'}</button>
              <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EVENTO SENTINELA ── */}
      {tab==='sentinela' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
          <div style={S.card}>
            <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Identificação do Evento</div>
            <div style={{marginBottom:'12px'}}>
              <label style={S.label}>Residente *</label>
              <select value={sentForm.residente_id} onChange={e=>setSentForm(f=>({...f,residente_id:e.target.value}))} style={S.select}>
                <option value="">Selecione...</option>
                {residentes.map(r=><option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
              </select>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px'}}>
              <div><label style={S.label}>Data *</label><input type="date" value={sentForm.data} onChange={e=>setSentForm(f=>({...f,data:e.target.value}))} style={S.input}/></div>
              <div>
                <label style={S.label}>Tipo de Evento *</label>
                <select value={sentForm.tipo} onChange={e=>setSentForm(f=>({...f,tipo:e.target.value}))} style={S.select}>
                  {['Queda','Lesão por Pressão','Erro de Medicação','Infecção / IRAS','Broncoaspiração','Reação Adversa a Medicamento','Óbito Inesperado','Outro'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:'12px'}}>
              <label style={S.label}>Gravidade *</label>
              <div style={{display:'flex', gap:'8px'}}>
                {(['leve','moderado','grave'] as GravidadeSentinela[]).map(g => (
                  <span key={g} onClick={() => setSentForm(f=>({...f,gravidade:g}))} style={{
                    flex:1, textAlign:'center' as const, padding:'8px', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:500,
                    background: sentForm.gravidade===g ? `${GRAVIDADE_CORES[g]}20` : '#f7f5f0',
                    color: sentForm.gravidade===g ? GRAVIDADE_CORES[g] : '#9a9588',
                    border: `1px solid ${sentForm.gravidade===g ? GRAVIDADE_CORES[g] : '#e0dbd0'}`
                  }}>
                    {g.charAt(0).toUpperCase()+g.slice(1)}
                  </span>
                ))}
              </div>
            </div>
            <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', cursor:'pointer', marginTop:'8px'}}>
              <input type="checkbox" checked={sentForm.resolvido} onChange={e=>setSentForm(f=>({...f,resolvido:e.target.checked}))}/>
              Evento já resolvido
            </label>
          </div>
          <div style={S.card}>
            <div style={{fontWeight:600, fontSize:'14px', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Detalhes</div>
            <div style={{marginBottom:'12px'}}><label style={S.label}>Descrição do Evento *</label><textarea value={sentForm.descricao} onChange={e=>setSentForm(f=>({...f,descricao:e.target.value}))} style={{...S.textarea, minHeight:'120px'}} placeholder="Descreva o evento, circunstâncias, como ocorreu..."/></div>
            <div style={{marginBottom:'16px'}}><label style={S.label}>Conduta Adotada</label><textarea value={sentForm.conduta} onChange={e=>setSentForm(f=>({...f,conduta:e.target.value}))} style={S.textarea} placeholder="Providências tomadas, tratamentos iniciados..."/></div>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={salvarSentinela} disabled={saving} style={S.btn('#991b1b')}>{saving?'Salvando...':'🚨 Registrar Evento'}</button>
              <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
