// src/app/api/relatorios/gerar-pai/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gerarPAI } from '@/lib/ai/relatorios'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { residente_id } = await req.json()
  const { data: residente } = await supabase.from('residentes').select('*').eq('id', residente_id).single()
  if (!residente) return NextResponse.json({ error: 'Residente não encontrado' }, { status: 404 })

  const { data: evolucoes } = await supabase
    .from('evolucoes_diarias')
    .select('*')
    .eq('residente_id', residente_id)
    .order('data', { ascending: false })
    .limit(15)

  const idade = Math.floor((new Date().getTime() - new Date(residente.data_nascimento).getTime()) / (1000*60*60*24*365.25))

  try {
    const result = await gerarPAI({ ...residente, idade }, evolucoes || [])
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
