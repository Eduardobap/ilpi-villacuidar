// src/app/api/relatorios/gerar-pia/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { residente_id } = await req.json()
  const { data: residente } = await supabase.from('residentes').select('*').eq('id', residente_id).single()
  if (!residente) return NextResponse.json({ error: 'Residente não encontrado' }, { status: 404 })

  const { data: multis } = await supabase
    .from('evolucoes_multidisciplinares')
    .select('especialidade, evolucao_texto, conduta, objetivos')
    .eq('residente_id', residente_id)
    .order('data', { ascending: false })
    .limit(10)

  const prompt = `Você é um sistema de apoio clínico para ILPI no Brasil. 
Gere um rascunho de PIA (Plano Individual de Atenção) para o residente abaixo.

RESIDENTE:
Nome: ${residente.nome}
Idade: ${Math.floor((new Date().getTime() - new Date(residente.data_nascimento).getTime()) / (1000*60*60*24*365.25))} anos
Diagnósticos: ${residente.diagnosticos || 'Não informado'}
Nível de dependência: ${residente.nivel_dependencia || 'Não informado'}

HISTÓRICO MULTIDISCIPLINAR:
${(multis||[]).map(m => `${m.especialidade}: ${m.evolucao_texto}`).join('\n') || 'Sem registros'}

Responda APENAS com JSON:
{
  "avaliacao_funcional": "avaliação do nível de dependência e capacidades funcionais",
  "aspectos_sociais": "situação social e familiar do residente",
  "atividades_preferidas": "atividades que o residente gosta ou pode participar",
  "plano_vida": "plano de vida, desejos e preferências expressas",
  "preferencias": "preferências alimentares, de rotina e outros aspectos do cuidado"
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (msg.content[0] as any).text.replace(/```json|```/g, '').trim()
    return NextResponse.json(JSON.parse(text))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
