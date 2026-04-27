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
  sectionTitle: { fontSize:'11px', fontWeight:700 as const, color:'#40916c', textTransform:'uppercase' as const, letterSpacing:'1px', paddingBottom:'8px', borderBottom:'2px solid #40916c', marginBottom:'12px', marginTop:'16px' },
}

type Tab = 'historico' | 'pai' | 'pia' | 'katz' | 'sentinela'

const TIPO_CORES: Record<string, string> = {
  PAI: '#1d4e89', PIA: '#2d6a4f', Katz: '#92400e', Sentinela: '#991b1b'
}
const GRAVIDADE_CORES: Record<GravidadeSentinela, string> = {
  leve: '#2d6a4f', moderado: '#92400e', grave: '#991b1b'
}

// ── Definição oficial do Índice de Katz ─────────────────────
// Pontuação: 0=Independente, 1=Dependente. Score total = nº de DEPENDÊNCIAS (0-6)
const KATZ_DEFS = [
  {
    key: 'banho',
    titulo: 'Banho',
    desc: 'Avaliado em relação ao uso do chuveiro, banheira e ao ato de esfregar-se. São independentes os que receberem auxílio para banhar apenas uma parte específica.',
    opcoes: [
      { label: 'Não recebe assistência (entra e sai do banheiro sozinho).', dep: false },
      { label: 'Recebe assistência no banho somente para uma parte do corpo (costas ou uma perna).', dep: false },
      { label: 'Recebe assistência no banho em mais de uma parte do corpo.', dep: true },
    ],
  },
  {
    key: 'vestuario',
    titulo: 'Vestir',
    desc: 'Considera o ato de pegar roupas no armário e vestir-se (roupas íntimas, externas, fechos e cintos). Calçar sapatos está excluído.',
    opcoes: [
      { label: 'Pega as roupas e se veste completamente sem assistência.', dep: false },
      { label: 'Pega as roupas e se veste sem assistência, exceto para amarrar os sapatos.', dep: false },
      { label: 'Recebe assistência para pegar as roupas ou para vestir-se, ou permanece parcial/totalmente vestido.', dep: true },
    ],
  },
  {
    key: 'higiene',
    titulo: 'Banheiro (Higiene Íntima)',
    desc: 'Compreende ir ao banheiro para excreções, higienizar-se e arrumar as próprias roupas. Uso de papagaio ou comadre = dependente.',
    opcoes: [
      { label: 'Vai ao banheiro, higieniza-se e se veste após as eliminações sem assistência (pode usar apoio ou comadre à noite, esvaziando-a sozinho pela manhã).', dep: false },
      { label: 'Recebe assistência para ir ao banheiro ou para higienizar-se ou para vestir-se após as eliminações ou para usar urinol/comadre à noite.', dep: true },
      { label: 'Não vai ao banheiro para urinar ou evacuar.', dep: true },
    ],
  },
  {
    key: 'transferencia',
    titulo: 'Transferência',
    desc: 'Avalia o movimento de sair da cama e sentar-se em cadeira e vice-versa. Uso de equipamento mecânico não altera a classificação.',
    opcoes: [
      { label: 'Deita-se e levanta-se da cama ou da cadeira sem assistência (pode utilizar apoio como bengala ou andador).', dep: false },
      { label: 'Deita-se e levanta-se da cama ou da cadeira com auxílio.', dep: true },
      { label: 'Não sai da cama.', dep: true },
    ],
  },
  {
    key: 'continencia',
    titulo: 'Continência',
    desc: 'Refere-se ao controle inteiramente autocontrolado de urinar ou defecar. Enemas, cateter ou uso regular de fraldas = dependente.',
    opcoes: [
      { label: 'Controla inteiramente as funções de urinar e evacuar.', dep: false },
      { label: 'Tem "acidentes" ocasionais (perdas urinárias ou fecais).', dep: true },
      { label: 'Precisa de ajuda para manter o controle da micção e evacuação; usa cateter ou é incontinente.', dep: true },
    ],
  },
  {
    key: 'alimentacao',
    titulo: 'Alimentação',
    desc: 'Relaciona-se ao ato de dirigir a comida do prato à boca. Cortar alimentos ou prepará-los está excluído. Uso de sonda = dependente.',
    opcoes: [
      { label: 'Alimenta-se sem ajuda.', dep: false },
      { label: 'Alimenta-se sozinho, mas recebe ajuda para cortar carne ou passar manteiga no pão.', dep: false },
      { label: 'Recebe ajuda para alimentar-se, ou é alimentado parcialmente/completamente pelo uso de sonda ou fluídos intravenoso.', dep: true },
    ],
  },
]

function katzDescricao(score: number): string {
  if (score === 0) return 'Independente em todas as seis funções'
  if (score === 6) return 'Dependente em todas as seis funções'
  const ind = 6 - score
  return `Independente em ${ind} função${ind === 1 ? '' : 'ões'} e dependente em ${score} função${score === 1 ? '' : 'ões'}`
}

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
    .inst{font-size:11px;color:#555;margin-top:2px}
    .meta{color:#888;font-size:11px;text-align:right}
    h2{font-size:15px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;color:#1d4e89}
    h3{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#40916c;border-bottom:1px solid #ccc;padding-bottom:4px;margin:16px 0 8px}
    .idrow{display:flex;gap:0;border:1px solid #ccc;border-radius:4px;margin-bottom:12px;overflow:hidden}
    .idf{flex:1;padding:6px 10px;border-right:1px solid #ccc;font-size:12px}
    .idf:last-child{border-right:none}
    .idf label{display:block;font-size:10px;color:#888;margin-bottom:2px}
    .idf span{font-weight:500}
    .field{margin-bottom:10px}
    .field label{display:block;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px}
    .field p{font-size:13px;line-height:1.7;border-left:3px solid #e0dbd0;padding-left:10px;white-space:pre-wrap}
    .checks{display:flex;gap:24px;margin-bottom:8px;font-size:12px}
    .check{display:flex;align-items:center;gap:6px}
    .box{width:12px;height:12px;border:1px solid #555;display:inline-flex;align-items:center;justify-content:center;font-size:9px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:#f0f0f0;padding:7px 10px;text-align:left;font-size:11px;font-weight:700;border:1px solid #ccc}
    td{padding:7px 10px;border:1px solid #ccc;font-size:12px;vertical-align:top}
    .score-box{text-align:center;padding:16px;background:#f7f5f0;border-radius:8px;margin:12px 0}
    .score-num{font-size:36px;font-weight:700;color:#40916c}
    .score-desc{font-size:13px;margin-top:4px;color:#1a1814;font-weight:500}
    .grav{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .sign{margin-top:40px;display:flex;justify-content:space-between}
    .sign-line{border-top:1px solid #555;width:220px;padding-top:6px;font-size:11px;color:#555;text-align:center}
    .inst-text{font-size:11px;color:#555;line-height:1.6;padding:8px 12px;background:#f9f9f9;border-radius:4px;margin:8px 0}
    .sep{border:none;border-top:1px solid #e0dbd0;margin:20px 0}
    @media print{body{padding:20px} .no-print{display:none}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="logo">VillaCuidar</div>
      <div class="inst">Sistema de Gestão ILPI</div>
    </div>
    <div class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  </div>
  ${corpo}
  <div style="text-align:center;margin-top:30px" class="no-print">
    <button onclick="window.print()" style="padding:10px 24px;background:#40916c;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">Imprimir / Salvar PDF</button>
  </div>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 600)
}

function htmlPAI(p: any, res?: any) {
  const residente = p.residente || res || {}
  const dataNasc = residente.data_nascimento ? new Date(residente.data_nascimento + 'T12:00').toLocaleDateString('pt-BR') : '—'
  const dataInicio = p.data_inicio ? new Date(p.data_inicio + 'T12:00').toLocaleDateString('pt-BR') : '—'
  const dataValidade = p.data_validade ? new Date(p.data_validade + 'T12:00').toLocaleDateString('pt-BR') : '—'

  const grau = p.grau_dependencia || 'I'
  const grauDesc = grau === 'I'
    ? 'Grau I — Polipatologias e condições simples, acompanhamento semestral pela equipe multiprofissional'
    : grau === 'II'
    ? 'Grau II — Polipatologias e déficit cognitivo a esclarecer, acompanhamento trimestral pela equipe multiprofissional'
    : 'Grau III — Polipatologias e déficits cognitivos estabelecidos, acompanhamento bimestral pela equipe multiprofissional'

  const medPart = p.medico_particular
    ? `Sim${p.medico_especialidade ? ' — Especialidade: ' + p.medico_especialidade : ''}`
    : 'Não'
  const atExt = p.atendimento_externo
    ? `Sim${p.atendimento_tipo ? ' — ' + p.atendimento_tipo : ''}`
    : 'Não'

  const plano = residente.plano_saude || 'Não informado'
  const isSUS = plano.toLowerCase() === 'sus'

  const atendimentoText = isSUS
    ? `<p style="font-size:11px;color:#555;line-height:1.6">Em caso de consulta, a família encaminha o idoso(a) para o consultório da rede pública. Em caso de transferência (Urgência e Emergência), o SAMU (Tel: 192) é acionado e encaminha o idoso para avaliação hospitalar. O responsável é acionado e acompanha o idoso na ambulância.</p>`
    : `<p style="font-size:11px;color:#555;line-height:1.6">Em caso de consultas de rotina, a família encaminha o idoso(a) ao consultório da rede privada. Em caso de transferência (Urgência e Emergência), o plano de saúde é acionado para serviço de remoção; caso não ofereça este serviço, aciona-se o SAMU e a transferência é feita para hospital autorizado pelo convênio. O responsável é acionado e acompanha o idoso na ambulância.</p>`

  return `
  <h2>Plano de Atenção Integral à Saúde</h2>

  <h3>Identificação do Residente</h3>
  <div class="idrow">
    <div class="idf" style="flex:2"><label>Nome</label><span>${residente.nome || '—'}</span></div>
    <div class="idf"><label>Data de Nascimento</label><span>${dataNasc}</span></div>
    <div class="idf"><label>Quarto</label><span>${residente.quarto || '—'}</span></div>
  </div>
  <div class="idrow">
    <div class="idf"><label>Plano de Saúde</label><span>${plano}</span></div>
    <div class="idf"><label>Alergias</label><span>${residente.alergias || 'Nenhuma'}</span></div>
    <div class="idf"><label>Responsável</label><span>${residente.responsavel_nome || '—'}</span></div>
    <div class="idf"><label>Telefone</label><span>${residente.responsavel_telefone || '—'}</span></div>
  </div>
  <div class="idrow">
    <div class="idf"><label>Data de Início</label><span>${dataInicio}</span></div>
    <div class="idf"><label>Válido até</label><span>${dataValidade}</span></div>
  </div>

  <h3>Diagnóstico Médico com Classificação CID-10</h3>
  <div class="field"><p>${p.diagnosticos || '—'}</p></div>

  ${p.vacinas ? `<h3>Vacinas</h3><div class="field"><p>${p.vacinas}</p></div>` : ''}

  <div class="inst-text">
    A VillaCuidar oferece serviços de enfermagem 24h prestados por técnicos de enfermagem e cuidadores de idosos, acompanhamento de enfermagem, nutricional, médico, psicológico e social.
  </div>

  <h3>Grau de Dependência</h3>
  <div style="padding:10px 14px;border:1px solid #ccc;border-radius:4px;font-size:13px"><strong>(${grau})</strong> ${grauDesc}</div>

  ${p.medicamentos_fonte || p.frequencia_consultas ? `
  <h3>Medicamentos e Acompanhamento</h3>
  <table><tr>
    <th>Medicamentos</th><th>Frequência de Acompanhamento</th>
  </tr><tr>
    <td>${p.medicamentos_fonte || '—'}</td>
    <td>${p.frequencia_consultas || '—'}</td>
  </tr></table>` : ''}

  <h3>Atendimento Médico e Externo</h3>
  <table><tr>
    <th>Médico Particular</th><th>Atendimento Externo</th>
  </tr><tr>
    <td>${medPart}</td><td>${atExt}</td>
  </tr></table>

  <div style="margin-top:8px">
    <strong style="font-size:12px">${isSUS ? 'Atendimento pelo SUS' : 'Atendimento pelo Plano de Saúde'}</strong>
    ${atendimentoText}
  </div>

  ${p.objetivos ? `<h3>Objetivos do Cuidado</h3><div class="field"><p>${p.objetivos}</p></div>` : ''}
  ${p.metas ? `<h3>Metas (3 meses)</h3><div class="field"><p>${p.metas}</p></div>` : ''}
  ${p.intervencoes ? `<h3>Intervenções da Equipe</h3><div class="field"><p>${p.intervencoes}</p></div>` : ''}

  <div class="sign">
    <div class="sign-line">Niterói, ___/___/_____<br/>Data</div>
    <div class="sign-line">_______________________________________<br/>Assinatura e Carimbo do Responsável</div>
  </div>`
}

function htmlPIA(p: any, res?: any) {
  const residente = p.residente || res || {}
  const dataNasc = residente.data_nascimento ? new Date(residente.data_nascimento + 'T12:00').toLocaleDateString('pt-BR') : '—'
  const dataAcolhimento = residente.data_entrada ? new Date(residente.data_entrada + 'T12:00').toLocaleDateString('pt-BR') : '—'
  const data = p.data ? new Date(p.data + 'T12:00').toLocaleDateString('pt-BR') : '—'

  const grau = p.grau_dependencia || 'I'

  return `
  <h2>Plano Individual de Atendimento</h2>

  <h3>1. Dados do Acolhimento</h3>
  <table><tr>
    <th>Data do Atendimento</th><th>Data de Acolhimento</th><th>Mensalidade</th>
  </tr><tr>
    <td>${data}</td><td>${dataAcolhimento}</td>
    <td>${residente.mensalidade != null ? 'R$ ' + Number(residente.mensalidade).toFixed(2) : '—'}</td>
  </tr></table>

  <h3>2. Dados da Pessoa Idosa</h3>
  <div class="idrow">
    <div class="idf" style="flex:2"><label>Nome</label><span>${residente.nome || '—'}</span></div>
    <div class="idf"><label>Data de Nascimento</label><span>${dataNasc}</span></div>
    <div class="idf"><label>Quarto</label><span>${residente.quarto || '—'}</span></div>
  </div>
  <div class="idrow">
    <div class="idf"><label>CPF</label><span>${residente.cpf || '—'}</span></div>
    <div class="idf"><label>RG</label><span>${residente.rg || '—'}</span></div>
    <div class="idf"><label>Plano de Saúde</label><span>${residente.plano_saude || '—'}</span></div>
  </div>
  <div class="idrow">
    <div class="idf"><label>Responsável</label><span>${residente.responsavel_nome || '—'}</span></div>
    <div class="idf"><label>Parentesco</label><span>${residente.responsavel_parentesco || '—'}</span></div>
    <div class="idf"><label>Telefone</label><span>${residente.responsavel_telefone || '—'}</span></div>
  </div>

  ${residente.diagnosticos ? `<h3>Diagnósticos / Condições de Saúde</h3><div class="field"><p>${residente.diagnosticos}</p></div>` : ''}
  ${p.condicoes_saude ? `<h3>Condições de Saúde Detalhadas</h3><div class="field"><p>${p.condicoes_saude}</p></div>` : ''}
  ${residente.alergias ? `<div class="field"><label>Alergias</label><p>${residente.alergias}</p></div>` : ''}

  <h3>3. Avaliação do Grau de Dependência</h3>
  <table><tr>
    <th>Grau</th><th>Descrição</th><th>Selecionado</th>
  </tr>
  <tr><td>Grau I</td><td>Realiza os 6 itens (banho, vestir-se, higiene íntima, transferência, continência, alimentar-se), mesmo com uso de equipamento de auto-ajuda, sendo a capacidade cognitiva intacta</td><td>${grau === 'I' ? '✓' : ''}</td></tr>
  <tr><td>Grau II</td><td>Perda de até 3 capacidades, sem comprometimento cognitivo ou com alteração cognitiva controlada</td><td>${grau === 'II' ? '✓' : ''}</td></tr>
  <tr><td>Grau III</td><td>Perda de 4 ou mais capacidades, com comprometimento cognitivo</td><td>${grau === 'III' ? '✓' : ''}</td></tr>
  </table>

  ${p.renda_beneficios ? `<h3>4. Renda / Benefícios</h3><div class="field"><p>${p.renda_beneficios}</p></div>` : ''}

  ${p.escolaridade || p.profissao || p.religiao ? `
  <h3>5. Características Pessoais</h3>
  <table><tr><th>Escolaridade</th><th>Profissão</th><th>Religião</th></tr>
  <tr><td>${p.escolaridade || '—'}</td><td>${p.profissao || '—'}</td><td>${p.religiao || '—'}</td></tr></table>` : ''}

  ${p.habitos_rotina ? `<div class="field"><label>Hábitos / Rotina</label><p>${p.habitos_rotina}</p></div>` : ''}
  ${p.habilidades ? `<div class="field"><label>Habilidades / Talentos</label><p>${p.habilidades}</p></div>` : ''}

  ${p.interesses_atividades ? `<h3>Interesses em Atividades</h3><div class="field"><p>${p.interesses_atividades}</p></div>` : ''}

  ${p.avaliacao_funcional ? `<h3>6. Avaliação Funcional</h3><div class="field"><p>${p.avaliacao_funcional}</p></div>` : ''}
  ${p.aspectos_sociais ? `<h3>7. Aspectos Sociais e Familiares</h3><div class="field"><p>${p.aspectos_sociais}</p></div>` : ''}
  ${p.plano_vida ? `<h3>8. Plano de Vida</h3><div class="field"><p>${p.plano_vida}</p></div>` : ''}
  ${p.preferencias ? `<div class="field"><label>Preferências</label><p>${p.preferencias}</p></div>` : ''}

  <div class="sign">
    <div class="sign-line">_______________________________________<br/>Responsável da Instituição</div>
    <div class="sign-line">_______________________________________<br/>Responsável pelo Idoso</div>
  </div>`
}

function htmlKatz(k: KatzAvaliacao) {
  // score = number of dependências (1 = dep, 0 = ind)
  const score = k.banho + k.vestuario + k.higiene + k.transferencia + k.continencia + k.alimentacao
  const atividades = [
    ['Banho', k.banho], ['Vestir', k.vestuario], ['Banheiro (Higiene)', k.higiene],
    ['Transferência', k.transferencia], ['Continência', k.continencia], ['Alimentação', k.alimentacao],
  ] as [string, number][]

  return `
  <h2>Índice de Katz — Avaliação de Independência nas Atividades de Vida Diária</h2>
  <div class="idrow">
    <div class="idf" style="flex:2"><label>Residente</label><span>${k.residente?.nome || '—'}</span></div>
    <div class="idf"><label>Quarto</label><span>${k.residente?.quarto || '—'}</span></div>
    <div class="idf"><label>Data da Avaliação</label><span>${new Date(k.data + 'T12:00').toLocaleDateString('pt-BR')}</span></div>
  </div>

  <h3>Avaliação por Função</h3>
  <table>
    <thead><tr><th>Função</th><th>Resultado</th><th>Classificação</th></tr></thead>
    <tbody>
      ${atividades.map(([nome, val]) => `<tr>
        <td><strong>${nome}</strong></td>
        <td>${val === 0 ? '(I) Independente' : '(D) Dependente'}</td>
        <td style="color:${val === 0 ? '#2d6a4f' : '#991b1b'};font-weight:600">${val === 0 ? 'Independente' : 'Dependente'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="score-box">
    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Pontuação Total (nº de dependências)</div>
    <div class="score-num">${score}<span style="font-size:18px;color:#9a9588">/6</span></div>
    <div class="score-desc">${katzDescricao(score)}</div>
  </div>

  <h3>Interpretação do Escore</h3>
  <table>
    ${[0,1,2,3,4,5,6].map(n => `<tr style="${n===score?'background:#f0fdf4;font-weight:700':''}">
      <td style="width:40px;text-align:center;font-weight:700;font-size:16px">${n}</td>
      <td>${katzDescricao(n)}</td>
      <td style="width:32px;text-align:center">${n===score?'◀':''}</td>
    </tr>`).join('')}
  </table>

  ${k.observacoes ? `<h3>Observações</h3><div class="field"><p>${k.observacoes}</p></div>` : ''}

  <div class="sign">
    <div class="sign-line">_______________________________________<br/>Responsável pela Avaliação</div>
    <div class="sign-line">_______________________________________<br/>Data / Assinatura e Carimbo</div>
  </div>`
}

function htmlSentinela(e: EventoSentinela) {
  const corGrav: Record<string, string> = { leve: '#2d6a4f', moderado: '#92400e', grave: '#991b1b' }
  return `
  <h2>Evento Sentinela</h2>
  <div class="idrow">
    <div class="idf" style="flex:2"><label>Residente</label><span>${e.residente?.nome || '—'}</span></div>
    <div class="idf"><label>Quarto</label><span>${e.residente?.quarto || '—'}</span></div>
    <div class="idf"><label>Data</label><span>${new Date(e.data + 'T12:00').toLocaleDateString('pt-BR')}</span></div>
  </div>
  <table><tr>
    <th>Tipo de Evento</th><th>Gravidade</th><th>Status</th>
  </tr><tr>
    <td><strong>${e.tipo}</strong></td>
    <td><span class="grav" style="background:${corGrav[e.gravidade]}20;color:${corGrav[e.gravidade]}">${e.gravidade.toUpperCase()}</span></td>
    <td>${e.resolvido ? '✔ Resolvido' : '⚠ Em acompanhamento'}</td>
  </tr></table>
  <div class="field"><label>Descrição do Evento</label><p>${e.descricao}</p></div>
  ${e.conduta ? `<div class="field"><label>Conduta Adotada</label><p>${e.conduta}</p></div>` : ''}`
}

function baixarPDFItem(tipo: string, dado: any) {
  const html = tipo === 'PAI' ? htmlPAI(dado) : tipo === 'PIA' ? htmlPIA(dado) : tipo === 'Katz' ? htmlKatz(dado) : htmlSentinela(dado)
  pdfBase(`${tipo} — ${dado.residente?.nome || ''}`, html)
}

function baixarPDFLote(selecionados: { tipo: string; dado: any }[]) {
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
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab] = useState<Tab>('historico')
  const [residentes, setResidentes] = useState<Residente[]>([])
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
  const PAI0 = {
    residente_id: '', data_inicio: today, data_validade: '',
    diagnosticos: '', vacinas: '', objetivos: '', metas: '', intervencoes: '',
    grau_dependencia: 'I', medicamentos_fonte: '', frequencia_consultas: '',
    medico_particular: false, medico_especialidade: '',
    atendimento_externo: false, atendimento_tipo: '',
  }
  const [paiForm, setPaiForm] = useState({ ...PAI0 })

  // PIA form
  const PIA0 = {
    residente_id: '', data: today,
    grau_dependencia: 'I',
    condicoes_saude: '', renda_beneficios: '',
    escolaridade: '', profissao: '', religiao: '',
    habitos_rotina: '', habilidades: '', interesses_atividades: '',
    avaliacao_funcional: '', aspectos_sociais: '',
    atividades_preferidas: '', plano_vida: '', preferencias: '',
  }
  const [piaForm, setPiaForm] = useState({ ...PIA0 })

  // Katz form - selectionIndex: which option (0,1,2) is selected per activity (-1 = none)
  const KATZ0_SEL: Record<string, number> = { banho: -1, vestuario: -1, higiene: -1, transferencia: -1, continencia: -1, alimentacao: -1 }
  const [katzResident, setKatzResident] = useState('')
  const [katzData, setKatzData] = useState(today)
  const [katzObs, setKatzObs] = useState('')
  const [katzSel, setKatzSel] = useState({ ...KATZ0_SEL })

  // Sentinela form
  const SENT0 = { residente_id: '', data: today, tipo: 'Queda', descricao: '', gravidade: 'leve' as GravidadeSentinela, conduta: '', resolvido: false }
  const [sentForm, setSentForm] = useState({ ...SENT0 })

  const [loadingAI, setLoadingAI] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: res } = await supabase.from('residentes').select('*').eq('status', 'ativo').order('nome')
    setResidentes(res || [])
    const { data: paiData } = await supabase.from('pai').select('*, residente:residentes(id,nome,quarto,data_nascimento,alergias,plano_saude,responsavel_nome,responsavel_telefone,responsavel_parentesco,cpf,rg,mensalidade,data_entrada,diagnosticos)').order('created_at', { ascending: false })
    setPais(paiData || [])
    const { data: piaData } = await supabase.from('pia').select('*, residente:residentes(id,nome,quarto,data_nascimento,cpf,rg,plano_saude,responsavel_nome,responsavel_telefone,responsavel_parentesco,alergias,mensalidade,data_entrada,diagnosticos)').order('created_at', { ascending: false })
    setPias(piaData || [])
    const { data: kData } = await supabase.from('katz_avaliacoes').select('*, residente:residentes(id,nome,quarto)').order('data', { ascending: false })
    setKatzList((kData || []) as KatzAvaliacao[])
    const { data: sData } = await supabase.from('eventos_sentinela').select('*, residente:residentes(id,nome,quarto)').order('data', { ascending: false })
    setSentinelaList((sData || []) as EventoSentinela[])
  }

  useEffect(() => { load() }, [])

  // ── Histórico combinado ──
  const todosItens = [
    ...pais.map(d => ({ tipo: 'PAI', id: 'pai_' + d.id, data: d.data_inicio, residente_id: d.residente_id, dado: d })),
    ...pias.map(d => ({ tipo: 'PIA', id: 'pia_' + d.id, data: d.data, residente_id: d.residente_id, dado: d })),
    ...katzList.map(d => ({ tipo: 'Katz', id: 'katz_' + d.id, data: d.data, residente_id: d.residente_id, dado: d })),
    ...sentinelaList.map(d => ({ tipo: 'Sentinela', id: 'sent_' + d.id, data: d.data, residente_id: d.residente_id, dado: d })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  const itensFiltrados = todosItens.filter(item => {
    if (hFiltroTipo !== 'todos' && item.tipo !== hFiltroTipo) return false
    if (hFiltroRes && item.residente_id !== hFiltroRes) return false
    if (hDataIni && item.data < hDataIni) return false
    if (hDataFim && item.data > hDataFim) return false
    return true
  })

  function toggleSel(id: string) { setSelecionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
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

  // ── IA ──
  async function gerarPAI_IA() {
    if (!paiForm.residente_id) { setMsg('Selecione um residente.'); return }
    setLoadingAI(true)
    const res = await fetch('/api/relatorios/gerar-pai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ residente_id: paiForm.residente_id }) })
    const json = await res.json()
    setLoadingAI(false)
    if (json.diagnosticos) { setPaiForm(f => ({ ...f, ...json })); setMsg('✦ IA preencheu o PAI. Revise antes de salvar.') }
    else setMsg('Erro ao gerar com IA: ' + (json.error || ''))
    setTimeout(() => setMsg(''), 5000)
  }

  async function gerarPIA_IA() {
    if (!piaForm.residente_id) { setMsg('Selecione um residente.'); return }
    setLoadingAI(true)
    const res = await fetch('/api/relatorios/gerar-pia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ residente_id: piaForm.residente_id }) })
    const json = await res.json()
    setLoadingAI(false)
    if (json.avaliacao_funcional) { setPiaForm(f => ({ ...f, ...json })); setMsg('✦ IA preencheu o PIA. Revise antes de salvar.') }
    else setMsg('Erro: ' + (json.error || ''))
    setTimeout(() => setMsg(''), 5000)
  }

  // ── Salvar ──
  async function salvarPAI() {
    if (!paiForm.residente_id || !paiForm.data_inicio || !paiForm.data_validade) { setMsg('Preencha residente, data de início e validade.'); return }
    setSaving(true)
    const { error } = await supabase.from('pai').insert({ ...paiForm, responsavel_id: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: ' + error.message); return }
    setMsg('PAI salvo!'); setPaiForm({ ...PAI0 }); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  async function salvarPIA() {
    if (!piaForm.residente_id || !piaForm.data) { setMsg('Preencha residente e data.'); return }
    setSaving(true)
    const { error } = await supabase.from('pia').insert({ ...piaForm, responsavel_id: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: ' + error.message); return }
    setMsg('PIA salvo!'); setPiaForm({ ...PIA0 }); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  async function salvarKatz() {
    if (!katzResident) { setMsg('Selecione um residente.'); return }
    const allSelected = KATZ_DEFS.every(d => katzSel[d.key] >= 0)
    if (!allSelected) { setMsg('Avalie todas as 6 funções antes de salvar.'); return }
    setSaving(true)
    const payload = {
      residente_id: katzResident,
      data: katzData,
      observacoes: katzObs || null,
      created_by: profile?.id,
      banho: KATZ_DEFS[0].opcoes[katzSel.banho]?.dep ? 1 : 0,
      vestuario: KATZ_DEFS[1].opcoes[katzSel.vestuario]?.dep ? 1 : 0,
      higiene: KATZ_DEFS[2].opcoes[katzSel.higiene]?.dep ? 1 : 0,
      transferencia: KATZ_DEFS[3].opcoes[katzSel.transferencia]?.dep ? 1 : 0,
      continencia: KATZ_DEFS[4].opcoes[katzSel.continencia]?.dep ? 1 : 0,
      alimentacao: KATZ_DEFS[5].opcoes[katzSel.alimentacao]?.dep ? 1 : 0,
    }
    const { error } = await supabase.from('katz_avaliacoes').insert(payload)
    setSaving(false)
    if (error) { setMsg('Erro: ' + error.message); return }
    setMsg('Avaliação de Katz salva!'); setKatzSel({ ...KATZ0_SEL }); setKatzObs(''); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  async function salvarSentinela() {
    if (!sentForm.residente_id || !sentForm.descricao) { setMsg('Preencha residente e descrição.'); return }
    setSaving(true)
    const { error } = await supabase.from('eventos_sentinela').insert({ ...sentForm, created_by: profile?.id })
    setSaving(false)
    if (error) { setMsg('Erro: ' + error.message); return }
    setMsg('Evento sentinela registrado!'); setSentForm({ ...SENT0 }); load(); setTab('historico')
    setTimeout(() => setMsg(''), 3000)
  }

  // ── Katz score preview ──
  const katzScore = KATZ_DEFS.reduce((acc, d) => {
    const idx = katzSel[d.key]
    if (idx < 0) return acc
    return acc + (d.opcoes[idx]?.dep ? 1 : 0)
  }, 0)
  const katzEvaluated = KATZ_DEFS.filter(d => katzSel[d.key] >= 0).length

  const TABS: { id: Tab; label: string }[] = [
    { id: 'historico', label: '📋 Histórico' },
    { id: 'pai', label: '📄 Novo PAI' },
    { id: 'pia', label: '📄 Novo PIA' },
    { id: 'katz', label: '📊 Índice de Katz' },
    { id: 'sentinela', label: '🚨 Evento Sentinela' },
  ]

  const residenteAtual = residentes.find(r => r.id === katzResident)

  const OpcBtn = ({ label, ativo, onClick }: { label: string; ativo: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, border: '1px solid',
      background: ativo ? '#d8f3dc' : '#f7f5f0', color: ativo ? '#2d6a4f' : '#9a9588', borderColor: ativo ? '#b7e4c7' : '#e0dbd0', fontFamily: 'inherit'
    }}>{label}</button>
  )

  const DepBtn = ({ label, ativo, onClick }: { label: string; ativo: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, border: '1px solid',
      background: ativo ? '#fee2e2' : '#f7f5f0', color: ativo ? '#991b1b' : '#9a9588', borderColor: ativo ? '#fecaca' : '#e0dbd0', fontFamily: 'inherit'
    }}>{label}</button>
  )

  return (
    <div>
      {msg && <div style={{ background: msg.includes('Erro') ? '#fee2e2' : msg.startsWith('✦') ? '#ede9fe' : '#d8f3dc', color: msg.includes('Erro') ? '#991b1b' : msg.startsWith('✦') ? '#5b21b6' : '#2d6a4f', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: '0', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '2px solid #e0dbd0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#40916c' : '#9a9588',
            border: 'none', borderBottom: tab === t.id ? '2px solid #40916c' : '2px solid transparent',
            marginBottom: '-2px', fontFamily: 'inherit'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── HISTÓRICO ── */}
      {tab === 'historico' && (
        <div>
          <div style={{ ...S.card, marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={S.label}>Tipo</label>
              <select value={hFiltroTipo} onChange={e => setHFiltroTipo(e.target.value)} style={S.select}>
                <option value="todos">Todos</option>
                <option value="PAI">PAI</option>
                <option value="PIA">PIA</option>
                <option value="Katz">Índice de Katz</option>
                <option value="Sentinela">Eventos Sentinela</option>
              </select>
            </div>
            <div style={{ flex: 2, minWidth: '180px' }}>
              <label style={S.label}>Residente</label>
              <select value={hFiltroRes} onChange={e => setHFiltroRes(e.target.value)} style={S.select}>
                <option value="">Todos</option>
                {residentes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div style={{ minWidth: '130px' }}>
              <label style={S.label}>Data inicial</label>
              <input type="date" value={hDataIni} onChange={e => setHDataIni(e.target.value)} style={S.input} />
            </div>
            <div style={{ minWidth: '130px' }}>
              <label style={S.label}>Data final</label>
              <input type="date" value={hDataFim} onChange={e => setHDataFim(e.target.value)} style={S.input} />
            </div>
            <button onClick={() => { setHFiltroTipo('todos'); setHFiltroRes(''); setHDataIni(''); setHDataFim('') }} style={S.btnSec}>Limpar</button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#5c5850' }}>
              <input type="checkbox" checked={selecionados.size === itensFiltrados.length && itensFiltrados.length > 0} onChange={toggleTodos} />
              Selecionar todos ({itensFiltrados.length})
            </label>
            {selecionados.size > 0 && (
              <>
                <button onClick={baixarSelecionados} style={S.btn()}>📄 Baixar PDF ({selecionados.size})</button>
                <button onClick={() => setSelecionados(new Set())} style={S.btnSec}>Limpar seleção</button>
              </>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => setTab('pai')} style={{ ...S.btnSec, fontSize: '12px' }}>+ PAI</button>
              <button onClick={() => setTab('pia')} style={{ ...S.btnSec, fontSize: '12px' }}>+ PIA</button>
              <button onClick={() => setTab('katz')} style={{ ...S.btnSec, fontSize: '12px' }}>+ Katz</button>
              <button onClick={() => setTab('sentinela')} style={{ ...S.btnSec, fontSize: '12px' }}>+ Sentinela</button>
            </div>
          </div>

          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f7f5f0' }}>
                  <th style={{ padding: '10px', width: '32px' }}></th>
                  {['Tipo', 'Residente', 'Quarto', 'Data', 'Resumo', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#5c5850', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9a9588' }}>Nenhum registro encontrado.</td></tr>
                )}
                {itensFiltrados.map(item => {
                  const cor = TIPO_CORES[item.tipo] || '#5f5e5a'
                  const score = item.tipo === 'Katz' ? item.dado.banho + item.dado.vestuario + item.dado.higiene + item.dado.transferencia + item.dado.continencia + item.dado.alimentacao : 0
                  const resumo = item.tipo === 'PAI' ? (item.dado.diagnosticos?.slice(0, 60) || '')
                    : item.tipo === 'PIA' ? `Grau ${item.dado.grau_dependencia || 'I'} — ${item.dado.avaliacao_funcional?.slice(0, 50) || ''}`
                      : item.tipo === 'Katz' ? `${score}/6 dependências — ${katzDescricao(score)}`
                        : `${item.dado.tipo} — ${item.dado.gravidade}`
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e0dbd0', background: selecionados.has(item.id) ? '#f0fdf4' : 'transparent' }}>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input type="checkbox" checked={selecionados.has(item.id)} onChange={() => toggleSel(item.id)} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: `${cor}15`, color: cor }}>{item.tipo}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.dado.residente?.nome || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px' }}>{item.dado.residente?.quarto || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#5c5850' }}>{new Date(item.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#9a9588', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumo}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => baixarPDFItem(item.tipo, item.dado)} style={{ ...S.btnSec, fontSize: '11px', padding: '5px 10px' }}>📄 PDF</button>
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
      {tab === 'pai' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Coluna esquerda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>Plano de Atenção Integral à Saúde</div>
                <span style={S.aiBadge}>✦ IA disponível</span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={S.label}>Residente *</label>
                <select value={paiForm.residente_id} onChange={e => setPaiForm(f => ({ ...f, residente_id: e.target.value }))} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r => <option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>

              {paiForm.residente_id && (() => {
                const res = residentes.find(r => r.id === paiForm.residente_id)
                return res ? (
                  <div style={{ background: '#f7f5f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: '#5c5850' }}>
                    <div><strong>Alergias:</strong> {res.alergias || 'Nenhuma'}</div>
                    <div><strong>Plano de saúde:</strong> {res.plano_saude || 'Não informado'}</div>
                    <div><strong>Responsável:</strong> {res.responsavel_nome || '—'} · {res.responsavel_telefone || '—'}</div>
                  </div>
                ) : null
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div><label style={S.label}>Data de Início *</label><input type="date" value={paiForm.data_inicio} onChange={e => setPaiForm(f => ({ ...f, data_inicio: e.target.value }))} style={S.input} /></div>
                <div><label style={S.label}>Válido até *</label><input type="date" value={paiForm.data_validade} onChange={e => setPaiForm(f => ({ ...f, data_validade: e.target.value }))} style={S.input} /></div>
              </div>

              <div style={S.sectionTitle}>Grau de Dependência</div>
              {[
                { v: 'I', label: 'Grau I', desc: 'Polipatologias e condições simples — acompanhamento semestral' },
                { v: 'II', label: 'Grau II', desc: 'Polipatologias e déficit cognitivo a esclarecer — acompanhamento trimestral' },
                { v: 'III', label: 'Grau III', desc: 'Polipatologias e déficits cognitivos estabelecidos — acompanhamento bimestral' },
              ].map(g => (
                <div key={g.v} onClick={() => setPaiForm(f => ({ ...f, grau_dependencia: g.v }))} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer', borderRadius: '8px',
                  background: paiForm.grau_dependencia === g.v ? '#f0fdf4' : '#f7f5f0',
                  border: `1px solid ${paiForm.grau_dependencia === g.v ? '#b7e4c7' : '#e0dbd0'}`,
                }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${paiForm.grau_dependencia === g.v ? '#40916c' : '#ccc8bc'}`, background: paiForm.grau_dependencia === g.v ? '#40916c' : '#fff', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paiForm.grau_dependencia === g.v && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1814' }}>{g.label}</div>
                    <div style={{ fontSize: '11px', color: '#5c5850', marginTop: '2px' }}>{g.desc}</div>
                  </div>
                </div>
              ))}

              <div style={S.sectionTitle}>Medicamentos</div>
              <label style={S.label}>Origem dos Medicamentos</label>
              <select value={paiForm.medicamentos_fonte} onChange={e => setPaiForm(f => ({ ...f, medicamentos_fonte: e.target.value }))} style={{ ...S.select, marginBottom: '12px' }}>
                <option value="">Selecione...</option>
                <option value="Farmácia Popular">Farmácia Popular</option>
                <option value="Posto de Saúde">Posto de Saúde</option>
                <option value="Família">Família</option>
                <option value="Particular">Particular</option>
                <option value="Farmácia Popular + Família">Farmácia Popular + Família</option>
              </select>

              <label style={S.label}>Frequência de Acompanhamento</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {['Semanal', 'Quinzenal', 'Mensal'].map(f => (
                  <OpcBtn key={f} label={f} ativo={paiForm.frequencia_consultas === f} onClick={() => setPaiForm(p => ({ ...p, frequencia_consultas: f }))} />
                ))}
              </div>

              <div style={S.sectionTitle}>Atendimento Médico</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#5c5850', minWidth: '120px' }}>Médico particular:</span>
                <OpcBtn label="Sim" ativo={paiForm.medico_particular} onClick={() => setPaiForm(f => ({ ...f, medico_particular: true }))} />
                <OpcBtn label="Não" ativo={!paiForm.medico_particular} onClick={() => setPaiForm(f => ({ ...f, medico_particular: false }))} />
              </div>
              {paiForm.medico_particular && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={S.label}>Especialidade</label>
                  <input value={paiForm.medico_especialidade} onChange={e => setPaiForm(f => ({ ...f, medico_especialidade: e.target.value }))} placeholder="Ex: Geriatra, Cardiologista..." style={S.input} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#5c5850', minWidth: '120px' }}>Atendimento externo:</span>
                <OpcBtn label="Sim" ativo={paiForm.atendimento_externo} onClick={() => setPaiForm(f => ({ ...f, atendimento_externo: true }))} />
                <OpcBtn label="Não" ativo={!paiForm.atendimento_externo} onClick={() => setPaiForm(f => ({ ...f, atendimento_externo: false }))} />
              </div>
              {paiForm.atendimento_externo && (
                <div>
                  <label style={S.label}>Tipo de Atendimento</label>
                  <input value={paiForm.atendimento_tipo} onChange={e => setPaiForm(f => ({ ...f, atendimento_tipo: e.target.value }))} placeholder="Ex: Fisioterapia, Psicologia..." style={S.input} />
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Conteúdo Clínico
                <button onClick={gerarPAI_IA} disabled={loadingAI || !paiForm.residente_id} style={S.btn('#5b21b6')}>
                  {loadingAI ? '⏳ Gerando...' : '✦ Preencher com IA'}
                </button>
              </div>

              <div style={S.sectionTitle}>Diagnósticos com CID-10</div>
              <textarea value={paiForm.diagnosticos} onChange={e => setPaiForm(f => ({ ...f, diagnosticos: e.target.value }))} style={{ ...S.textarea, minHeight: '100px' }} placeholder="Ex: CID-10 I15.9 — Hipertensão secundária não especificada. Faz uso de medicações conforme prescrição médica.&#10;CID-10 F03 — Demência não especificada." />

              <div style={S.sectionTitle}>Vacinas</div>
              <input value={paiForm.vacinas} onChange={e => setPaiForm(f => ({ ...f, vacinas: e.target.value }))} placeholder="Ex: Em dia — Gripe e Covid" style={{ ...S.input, marginBottom: '12px' }} />

              <div style={S.sectionTitle}>Objetivos do Cuidado</div>
              <textarea value={paiForm.objetivos} onChange={e => setPaiForm(f => ({ ...f, objetivos: e.target.value }))} style={{ ...S.textarea, minHeight: '80px' }} placeholder="Descreva os objetivos do plano de cuidado..." />

              <div style={S.sectionTitle}>Metas (3 meses)</div>
              <textarea value={paiForm.metas} onChange={e => setPaiForm(f => ({ ...f, metas: e.target.value }))} style={{ ...S.textarea, minHeight: '80px' }} placeholder="Metas a alcançar no período..." />

              <div style={S.sectionTitle}>Intervenções da Equipe</div>
              <textarea value={paiForm.intervencoes} onChange={e => setPaiForm(f => ({ ...f, intervencoes: e.target.value }))} style={{ ...S.textarea, minHeight: '80px' }} placeholder="Descreva as intervenções planejadas..." />

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={salvarPAI} disabled={saving} style={S.btn()}>{saving ? 'Salvando...' : '💾 Salvar PAI'}</button>
                <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NOVO PIA ── */}
      {tab === 'pia' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Coluna esquerda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>Plano Individual de Atendimento</div>
                <span style={S.aiBadge}>✦ IA disponível</span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={S.label}>Residente *</label>
                <select value={piaForm.residente_id} onChange={e => setPiaForm(f => ({ ...f, residente_id: e.target.value }))} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r => <option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}><label style={S.label}>Data *</label><input type="date" value={piaForm.data} onChange={e => setPiaForm(f => ({ ...f, data: e.target.value }))} style={S.input} /></div>

              <div style={S.sectionTitle}>Grau de Dependência (RDC 283)</div>
              {[
                { v: 'I', desc: 'Grau I — Realiza os 6 itens (banho, vestir, higiene, transferência, continência, alimentação), mesmo com uso de equipamento de auto-ajuda. Capacidade cognitiva intacta.' },
                { v: 'II', desc: 'Grau II — Perda de até 3 capacidades, sem comprometimento cognitivo ou com alteração cognitiva controlada.' },
                { v: 'III', desc: 'Grau III — Perda de 4 ou mais capacidades, com comprometimento cognitivo.' },
              ].map(g => (
                <div key={g.v} onClick={() => setPiaForm(f => ({ ...f, grau_dependencia: g.v }))} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer', borderRadius: '8px',
                  background: piaForm.grau_dependencia === g.v ? '#f0fdf4' : '#f7f5f0',
                  border: `1px solid ${piaForm.grau_dependencia === g.v ? '#b7e4c7' : '#e0dbd0'}`,
                }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${piaForm.grau_dependencia === g.v ? '#40916c' : '#ccc8bc'}`, background: piaForm.grau_dependencia === g.v ? '#40916c' : '#fff', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {piaForm.grau_dependencia === g.v && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ fontSize: '12px', color: '#1a1814', lineHeight: '1.5' }}>{g.desc}</div>
                </div>
              ))}

              <div style={S.sectionTitle}>Renda / Benefícios</div>
              <textarea value={piaForm.renda_beneficios} onChange={e => setPiaForm(f => ({ ...f, renda_beneficios: e.target.value }))} style={{ ...S.textarea, minHeight: '70px' }} placeholder="Ex: Aposentadoria, BPC, Benefício previdenciário — pensão..." />

              <div style={S.sectionTitle}>Características Pessoais</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div><label style={S.label}>Escolaridade</label><input value={piaForm.escolaridade} onChange={e => setPiaForm(f => ({ ...f, escolaridade: e.target.value }))} placeholder="Ex: Ensino Fundamental" style={S.input} /></div>
                <div><label style={S.label}>Profissão</label><input value={piaForm.profissao} onChange={e => setPiaForm(f => ({ ...f, profissao: e.target.value }))} placeholder="Ex: Professora aposentada" style={S.input} /></div>
              </div>
              <div style={{ marginBottom: '10px' }}><label style={S.label}>Religião</label><input value={piaForm.religiao} onChange={e => setPiaForm(f => ({ ...f, religiao: e.target.value }))} placeholder="Ex: Católica" style={S.input} /></div>
              <div style={{ marginBottom: '10px' }}><label style={S.label}>Hábitos / Rotina</label><textarea value={piaForm.habitos_rotina} onChange={e => setPiaForm(f => ({ ...f, habitos_rotina: e.target.value }))} style={{ ...S.textarea, minHeight: '60px' }} placeholder="Aspectos da rotina passíveis de serem mantidos..." /></div>
              <div><label style={S.label}>Habilidades / Talentos</label><input value={piaForm.habilidades} onChange={e => setPiaForm(f => ({ ...f, habilidades: e.target.value }))} placeholder="Ex: Tricô, pintura..." style={S.input} /></div>
            </div>
          </div>

          {/* Coluna direita */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Conteúdo do Plano
                <button onClick={gerarPIA_IA} disabled={loadingAI || !piaForm.residente_id} style={S.btn('#5b21b6')}>{loadingAI ? '⏳ Gerando...' : '✦ Preencher com IA'}</button>
              </div>

              <div style={S.sectionTitle}>Condições de Saúde</div>
              <textarea value={piaForm.condicoes_saude} onChange={e => setPiaForm(f => ({ ...f, condicoes_saude: e.target.value }))} style={{ ...S.textarea, minHeight: '80px' }} placeholder="Problemas de saúde, medicamentos em uso, restrições alimentares, deficiências, equipamentos de auxílio..." />

              <div style={S.sectionTitle}>Interesse em Atividades</div>
              {[
                'Lazer / Recreativas (passeios, jogos, filmes)',
                'Festivais (bailes, aniversários, datas festivas)',
                'Físicas e Esportivas (alongamentos, ginástica, fisioterapia)',
                'Culturais (cinema, museu, teatro)',
                'Encontros Religiosos (missas, cultos)',
                'Ocupacionais (trabalhos manuais, musicoterapia)',
                'Não tem interesse em atividades',
              ].map(a => {
                const checked = piaForm.interesses_atividades.includes(a)
                return (
                  <label key={a} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1a1814', cursor: 'pointer', marginBottom: '6px' }}>
                    <input type="checkbox" checked={checked} onChange={() => {
                      setPiaForm(f => {
                        const current = f.interesses_atividades ? f.interesses_atividades.split('\n').filter(Boolean) : []
                        const updated = checked ? current.filter(x => x !== a) : [...current, a]
                        return { ...f, interesses_atividades: updated.join('\n') }
                      })
                    }} />
                    {a}
                  </label>
                )
              })}

              <div style={S.sectionTitle}>Avaliação Funcional</div>
              <textarea value={piaForm.avaliacao_funcional} onChange={e => setPiaForm(f => ({ ...f, avaliacao_funcional: e.target.value }))} style={{ ...S.textarea, minHeight: '70px' }} placeholder="Descreva a capacidade funcional atual..." />

              <div style={S.sectionTitle}>Aspectos Sociais e Familiares</div>
              <textarea value={piaForm.aspectos_sociais} onChange={e => setPiaForm(f => ({ ...f, aspectos_sociais: e.target.value }))} style={{ ...S.textarea, minHeight: '70px' }} placeholder="Relação com família, rede de apoio, relações sociais..." />

              <div style={S.sectionTitle}>Plano de Vida</div>
              <textarea value={piaForm.plano_vida} onChange={e => setPiaForm(f => ({ ...f, plano_vida: e.target.value }))} style={{ ...S.textarea, minHeight: '70px' }} placeholder="Objetivos, perspectivas, desejos do idoso..." />

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={salvarPIA} disabled={saving} style={S.btn()}>{saving ? 'Salvando...' : '💾 Salvar PIA'}</button>
                <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ÍNDICE DE KATZ ── */}
      {tab === 'katz' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
          {/* Painel esquerdo — identificação + score */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>Índice de Katz</div>
              <div style={{ marginBottom: '12px' }}>
                <label style={S.label}>Residente *</label>
                <select value={katzResident} onChange={e => { setKatzResident(e.target.value); setKatzSel({ ...KATZ0_SEL }) }} style={S.select}>
                  <option value="">Selecione...</option>
                  {residentes.map(r => <option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}><label style={S.label}>Data da Avaliação *</label><input type="date" value={katzData} onChange={e => setKatzData(e.target.value)} style={S.input} /></div>

              {/* Score preview */}
              <div style={{ background: katzEvaluated === 6 ? (katzScore === 0 ? '#f0fdf4' : katzScore <= 2 ? '#fefce8' : katzScore <= 4 ? '#fff7ed' : '#fef2f2') : '#f7f5f0', borderRadius: '12px', padding: '16px', textAlign: 'center', border: `1px solid ${katzEvaluated === 6 ? '#e0dbd0' : '#e0dbd0'}` }}>
                <div style={{ fontSize: '11px', color: '#9a9588', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>Pontuação (Dependências)</div>
                <div style={{ fontSize: '40px', fontWeight: 700, color: katzScore === 0 ? '#2d6a4f' : katzScore <= 2 ? '#92400e' : '#991b1b' }}>
                  {katzEvaluated === 6 ? katzScore : `${katzEvaluated}/6`}
                  {katzEvaluated === 6 && <span style={{ fontSize: '20px', color: '#9a9588' }}>/6</span>}
                </div>
                {katzEvaluated === 6 ? (
                  <div style={{ fontSize: '13px', fontWeight: 500, marginTop: '6px', color: '#1a1814' }}>
                    {katzDescricao(katzScore)}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#9a9588', marginTop: '4px' }}>funções avaliadas</div>
                )}
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={S.label}>Observações</label>
                <textarea value={katzObs} onChange={e => setKatzObs(e.target.value)} style={{ ...S.textarea, minHeight: '70px' }} placeholder="Observações clínicas relevantes..." />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button onClick={salvarKatz} disabled={saving || !katzResident} style={S.btn()}>{saving ? 'Salvando...' : '💾 Salvar Avaliação'}</button>
                <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
              </div>
            </div>
          </div>

          {/* Painel direito — atividades */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>
              Atividades da Vida Diária
              {residenteAtual && <span style={{ fontSize: '13px', fontWeight: 400, color: '#9a9588', marginLeft: '8px' }}>— {residenteAtual.nome}</span>}
            </div>

            <div style={{ fontSize: '11px', color: '#9a9588', background: '#f7f5f0', padding: '8px 12px', borderRadius: '6px', margin: '12px 0', lineHeight: '1.5' }}>
              Para cada função, selecione a opção que melhor descreve o idoso. Opções marcadas como <strong style={{ color: '#2d6a4f' }}>(I) Independente</strong> e <strong style={{ color: '#991b1b' }}>(D) Dependente</strong>.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {KATZ_DEFS.map((def, di) => {
                const sel = katzSel[def.key]
                const isDone = sel >= 0
                const isDepResult = isDone && def.opcoes[sel]?.dep
                return (
                  <div key={def.key} style={{ border: `1px solid ${isDone ? (isDepResult ? '#fecaca' : '#b7e4c7') : '#e0dbd0'}`, borderRadius: '10px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '10px 14px', background: isDone ? (isDepResult ? '#fef2f2' : '#f0fdf4') : '#f7f5f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a1814' }}>{di + 1}. {def.titulo}</span>
                        {isDone && (
                          <span style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, background: isDepResult ? '#fee2e2' : '#d8f3dc', color: isDepResult ? '#991b1b' : '#2d6a4f' }}>
                            ({isDepResult ? 'D' : 'I'}) {isDepResult ? 'Dependente' : 'Independente'}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Description */}
                    <div style={{ padding: '8px 14px 0', fontSize: '11px', color: '#9a9588', lineHeight: '1.5' }}>{def.desc}</div>
                    {/* Options */}
                    <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {def.opcoes.map((opc, oi) => {
                        const isSelected = sel === oi
                        return (
                          <div key={oi} onClick={() => setKatzSel(s => ({ ...s, [def.key]: oi }))} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '8px',
                            background: isSelected ? (opc.dep ? '#fef2f2' : '#f0fdf4') : '#fafafa',
                            border: `1px solid ${isSelected ? (opc.dep ? '#fecaca' : '#b7e4c7') : '#e0dbd0'}`,
                          }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${isSelected ? (opc.dep ? '#991b1b' : '#40916c') : '#ccc'}`, background: isSelected ? (opc.dep ? '#991b1b' : '#40916c') : '#fff', flexShrink: 0, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: opc.dep ? '#991b1b' : '#2d6a4f', marginRight: '6px' }}>({opc.dep ? 'D' : 'I'})</span>
                              <span style={{ fontSize: '12px', color: '#1a1814' }}>{opc.label}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EVENTO SENTINELA ── */}
      {tab === 'sentinela' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>Identificação do Evento</div>
            <div style={{ marginBottom: '12px' }}>
              <label style={S.label}>Residente *</label>
              <select value={sentForm.residente_id} onChange={e => setSentForm(f => ({ ...f, residente_id: e.target.value }))} style={S.select}>
                <option value="">Selecione...</option>
                {residentes.map(r => <option key={r.id} value={r.id}>{r.nome} — Q.{r.quarto}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div><label style={S.label}>Data *</label><input type="date" value={sentForm.data} onChange={e => setSentForm(f => ({ ...f, data: e.target.value }))} style={S.input} /></div>
              <div>
                <label style={S.label}>Tipo de Evento *</label>
                <select value={sentForm.tipo} onChange={e => setSentForm(f => ({ ...f, tipo: e.target.value }))} style={S.select}>
                  {['Queda', 'Lesão por Pressão', 'Erro de Medicação', 'Infecção / IRAS', 'Broncoaspiração', 'Reação Adversa a Medicamento', 'Óbito Inesperado', 'Outro'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={S.label}>Gravidade *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['leve', 'moderado', 'grave'] as GravidadeSentinela[]).map(g => (
                  <span key={g} onClick={() => setSentForm(f => ({ ...f, gravidade: g }))} style={{
                    flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                    background: sentForm.gravidade === g ? `${GRAVIDADE_CORES[g]}20` : '#f7f5f0',
                    color: sentForm.gravidade === g ? GRAVIDADE_CORES[g] : '#9a9588',
                    border: `1px solid ${sentForm.gravidade === g ? GRAVIDADE_CORES[g] : '#e0dbd0'}`
                  }}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </span>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}>
              <input type="checkbox" checked={sentForm.resolvido} onChange={e => setSentForm(f => ({ ...f, resolvido: e.target.checked }))} />
              Evento já resolvido
            </label>
          </div>
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0' }}>Detalhes</div>
            <div style={{ marginBottom: '12px' }}><label style={S.label}>Descrição do Evento *</label><textarea value={sentForm.descricao} onChange={e => setSentForm(f => ({ ...f, descricao: e.target.value }))} style={{ ...S.textarea, minHeight: '120px' }} placeholder="Descreva o evento, circunstâncias, como ocorreu..." /></div>
            <div style={{ marginBottom: '16px' }}><label style={S.label}>Conduta Adotada</label><textarea value={sentForm.conduta} onChange={e => setSentForm(f => ({ ...f, conduta: e.target.value }))} style={S.textarea} placeholder="Providências tomadas, tratamentos iniciados..." /></div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={salvarSentinela} disabled={saving} style={S.btn('#991b1b')}>{saving ? 'Salvando...' : '🚨 Registrar Evento'}</button>
              <button onClick={() => setTab('historico')} style={S.btnSec}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OpcBtn({ label, ativo, onClick }: { label: string; ativo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, border: '1px solid',
      background: ativo ? '#d8f3dc' : '#f7f5f0', color: ativo ? '#2d6a4f' : '#9a9588', borderColor: ativo ? '#b7e4c7' : '#e0dbd0', fontFamily: 'inherit'
    }}>{label}</button>
  )
}
