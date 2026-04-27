// src/app/api/extrato/analisar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizarExtrato } from '@/lib/ai/relatorios'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { ids } = await req.json()
  const { data: rows } = await supabase.from('extrato_bancario').select('*').in('id', ids)
  if (!rows?.length) return NextResponse.json({ ok: true, atualizados: 0 })

  let atualizados = 0
  for (const row of rows) {
    try {
      const categoria = await categorizarExtrato(row.descricao_banco, row.valor)

      // Tentar conciliar com título existente
      const { data: titulo } = await supabase
        .from('lancamentos_financeiros')
        .select('id')
        .eq('data_vencimento', row.data_lancamento)
        .eq('tipo', row.valor > 0 ? 'receber' : 'pagar')
        .eq('status', 'pendente')
        .order('created_at')
        .limit(1)
        .maybeSingle()

      const statusConciliacao = titulo ? 'conciliado' : 'nao_conciliado'

      await supabase.from('extrato_bancario').update({
        categoria_ia: categoria,
        status_conciliacao: statusConciliacao,
        lancamento_id: titulo?.id || null,
      }).eq('id', row.id)

      if (titulo) {
        await supabase.from('lancamentos_financeiros').update({
          status: row.valor > 0 ? 'recebido' : 'pago',
          data_pagamento: row.data_lancamento,
          conciliado: true,
        }).eq('id', titulo.id)
      }

      atualizados++
    } catch (e) {
      console.error('Erro ao categorizar:', row.id, e)
    }
  }

  return NextResponse.json({ ok: true, atualizados })
}
