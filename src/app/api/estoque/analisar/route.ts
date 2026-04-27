// src/app/api/estoque/analisar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularProximaCompra } from '@/lib/ai/relatorios'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Buscar estoque atual
  const { data: itens } = await supabase.from('itens_estoque').select('id,nome,unidade,quantidade_atual,quantidade_minima')
  if (!itens?.length) return NextResponse.json({ alertas: [] })

  // Buscar cardápio da semana
  const hoje = new Date().toISOString().split('T')[0]
  const fim = new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0]
  const { data: cardapios } = await supabase.from('cardapio').select('data,refeicao,descricao').gte('data',hoje).lte('data',fim).order('data')

  const cardapioTexto = (cardapios||[]).map(c => `${c.data} ${c.refeicao}: ${c.descricao}`).join('\n') || 'Sem cardápio cadastrado para os próximos dias.'

  try {
    const alertas = await calcularProximaCompra(itens, cardapioTexto)

    // Atualizar data_proxima_compra no banco para os itens identificados
    for (const alerta of alertas) {
      const item = itens.find(i => i.nome.toLowerCase().includes(alerta.item.toLowerCase()) || alerta.item.toLowerCase().includes(i.nome.toLowerCase()))
      if (item && alerta.data_sugerida) {
        const [d, m, a] = alerta.data_sugerida.split('/')
        const dataISO = `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
        await supabase.from('itens_estoque').update({ data_proxima_compra: dataISO }).eq('id', item.id)
      }
    }

    return NextResponse.json({ ok: true, alertas })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
