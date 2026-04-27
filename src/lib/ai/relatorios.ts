// src/lib/ai/relatorios.ts
// Integração com Claude para geração automática de relatórios

import Anthropic from '@anthropic-ai/sdk'
import { EvolucaoDiaria, Residente, PostoEnfermagem, Turno } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── Gerar Passagem de Plantão Automática ──────────────────
export async function gerarPassagemPlantao(
  evolucoes: EvolucaoDiaria[],
  turnoAtual: Turno,
  posto?: PostoEnfermagem
): Promise<string> {
  const turnoProximo = turnoAtual === 'diurno' ? 'noturno' : 'diurno'
  const data = new Date().toLocaleDateString('pt-BR')
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const resumoEvolucoes = evolucoes
    .map(e => `
Residente: ${e.residente?.nome} | Quarto: ${e.residente?.quarto}
PA: ${e.pressao_arterial ?? 'NR'} | Temp: ${e.temperatura ? e.temperatura + '°C' : 'NR'} | Sat: ${e.saturacao_o2 ? e.saturacao_o2 + '%' : 'NR'}
Alimentação: ${e.alimentacao ?? 'NR'} | Eliminações: ${e.eliminacoes ?? 'NR'}
Condição geral: ${e.condicao_geral ?? 'NR'}
Evolução: ${e.evolucao_texto}
Intercorrências: ${e.intercorrencias || 'Nenhuma'}
Pendências: ${e.pendencias_proximo_turno || 'Nenhuma'}
Medicações: ${e.medicacoes_administradas || 'Conforme prescrição'}
    `.trim())
    .join('\n\n---\n\n')

  const prompt = `Você é um sistema de apoio clínico para uma ILPI (Instituição de Longa Permanência para Idosos) no Brasil. 
Gere um relatório profissional de PASSAGEM DE PLANTÃO em português, com linguagem técnica de enfermagem, formal e concisa.

DADOS DO TURNO:
- Data: ${data}
- Hora: ${hora}
- Turno que passa: ${turnoAtual === 'diurno' ? 'Diurno (07h-19h)' : 'Noturno (19h-07h)'}
- Turno que recebe: ${turnoProximo === 'diurno' ? 'Diurno (07h-07h)' : 'Noturno (19h-07h)'}
${posto ? `- Posto: ${posto.replace('_', ' ').toUpperCase()}` : '- Todos os postos'}
- Total de residentes no turno: ${evolucoes.length}

EVOLUÇÕES DO TURNO:
${resumoEvolucoes}

INSTRUÇÕES:
1. Comece com um RESUMO GERAL do turno (2-3 frases)
2. Destaque ATENÇÃO PRIORITÁRIA para residentes instáveis ou com intercorrências
3. Liste os RESIDENTES ESTÁVEIS brevemente
4. Mencione PENDÊNCIAS IMPORTANTES para o próximo turno
5. Use siglas técnicas de enfermagem: PA, FC, FR, SpO2, BEG, REG, MEG, DPD, etc.
6. Linguagem formal, objetiva e sem erros

Formate com seções usando emoji: 📋 RESUMO, ⚠️ ATENÇÃO PRIORITÁRIA, ✅ ESTÁVEIS, 📌 PENDÊNCIAS`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  return (message.content[0] as { type: 'text'; text: string }).text
}

// ── Gerar PAI com IA ──────────────────────────────────────
export async function gerarPAI(residente: Residente, evolucoes: EvolucaoDiaria[]): Promise<{
  diagnosticos: string
  objetivos: string
  metas: string
  intervencoes: string
}> {
  const ultimasEvolucoes = evolucoes.slice(0, 10)
  const resumo = ultimasEvolucoes
    .map(e => `${e.data} (${e.turno}): ${e.evolucao_texto}`)
    .join('\n')

  const prompt = `Baseado nos dados do residente e evoluções recentes, gere um rascunho de PAI (Plano de Atenção Individual) para ILPI.

RESIDENTE:
- Nome: ${residente.nome}
- Idade: ${residente.idade} anos
- Diagnósticos: ${residente.diagnosticos}
- Alergias: ${residente.alergias || 'Nenhuma conhecida'}
- Nível de dependência: ${residente.nivel_dependencia}

ÚLTIMAS EVOLUÇÕES:
${resumo}

Responda APENAS com JSON no formato:
{
  "diagnosticos": "lista dos diagnósticos ativos e condições relevantes",
  "objetivos": "objetivos gerais do cuidado para este residente",
  "metas": "metas mensuráveis e específicas para os próximos 3 meses",
  "intervencoes": "intervenções da equipe multidisciplinar recomendadas"
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { type: 'text'; text: string }).text
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ── Analisar Extrato Bancário com IA ──────────────────────
export async function categorizarExtrato(descricao: string, valor: number): Promise<string> {
  const prompt = `Categorize esta transação bancária de uma ILPI (Instituição de Longa Permanência para Idosos).

Transação: "${descricao}" | Valor: R$ ${Math.abs(valor).toFixed(2)} | Tipo: ${valor > 0 ? 'Crédito' : 'Débito'}

Responda APENAS com uma categoria, sem explicação. Opções:
Mensalidade, Convênio, Folha de Pagamento, Fornecedor Medicamentos, Fornecedor Fraldas, Fornecedor Alimentação, Energia Elétrica, Água e Esgoto, Internet, Manutenção, Equipamentos, Impostos, Outros`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 20,
    messages: [{ role: 'user', content: prompt }],
  })

  return (message.content[0] as { type: 'text'; text: string }).text.trim()
}

// ── Calcular próxima compra de estoque ───────────────────
export async function calcularProximaCompra(
  itens: Array<{ nome: string; quantidade_atual: number; quantidade_minima: number; unidade: string }>,
  cardapioSemana: string
): Promise<Array<{ item: string; data_sugerida: string; motivo: string }>> {
  const prompt = `Você é um sistema de gestão de estoque para cozinha de ILPI com 24 residentes.

ESTOQUE ATUAL:
${itens.map(i => `- ${i.nome}: ${i.quantidade_atual}${i.unidade} (mínimo: ${i.quantidade_minima}${i.unidade})`).join('\n')}

CARDÁPIO DA SEMANA:
${cardapioSemana}

Analise o consumo estimado com base no cardápio e indique quando cada item precisa ser reposto.

Responda APENAS com JSON no formato:
[
  {
    "item": "nome do item",
    "data_sugerida": "DD/MM/AAAA",
    "motivo": "motivo em uma frase curta"
  }
]

Inclua apenas itens que precisam de atenção nos próximos 14 dias.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { type: 'text'; text: string }).text
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
