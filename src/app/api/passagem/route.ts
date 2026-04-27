// src/app/api/passagem/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gerarPassagemPlantao } from '@/lib/ai/relatorios'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role,id').eq('id', user.id).single()
    if (!profile || !['admin','enfermeira'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const { data, turno, posto } = body

    // Buscar evoluções do turno
    let q = supabase
      .from('evolucoes_diarias')
      .select(`*, residente:residentes(nome,quarto,posto,diagnosticos)`)
      .eq('data', data)
      .eq('turno', turno)

    if (posto) q = q.eq('posto', posto)

    const { data: evolucoes } = await q

    if (!evolucoes || evolucoes.length === 0) {
      return NextResponse.json({ error: 'Nenhuma evolução encontrada para este turno.' }, { status: 400 })
    }

    // Gerar com Claude
    const texto = await gerarPassagemPlantao(evolucoes as any, turno, posto)

    // Salvar no banco
    const { data: passagem } = await supabase.from('passagens_plantao').insert({
      data,
      turno,
      posto: posto || null,
      texto_gerado: texto,
      gerado_por: user.id,
      gerado_em: new Date().toISOString(),
    }).select().single()

    return NextResponse.json({ passagem, ok: true })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
