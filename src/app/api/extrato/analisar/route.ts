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
      const tipo = row.valor > 0 ? 'receber' : 'pagar'
      const valorAbs = Math.abs(row.valor)

      // Tenta conciliar com lançamento pendente na mesma data (±3 dias) e mesmo tipo
      const dataRef = new Date(row.data_lancamento + 'T12:00')
      const dataIni = new Date(dataRef); dataIni.setDate(dataRef.getDate() - 3)
      const dataFim = new Date(dataRef); dataFim.setDate(dataRef.getDate() + 3)

      const { data: titulo } = await supabase
        .from('lancamentos_financeiros')
        .select('id')
        .eq('tipo', tipo)
        .eq('status', 'pendente')
        .gte('data_vencimento', dataIni.toISOString().split('T')[0])
        .lte('data_vencimento', dataFim.toISOString().split('T')[0])
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (titulo) {
        // Concilia lançamento existente
        await supabase.from('lancamentos_financeiros').update({
          status: tipo === 'receber' ? 'recebido' : 'pago',
          data_pagamento: row.data_lancamento,
          conciliado: true,
        }).eq('id', titulo.id)

        await supabase.from('extrato_bancario').update({
          categoria_ia: categoria,
          status_conciliacao: 'conciliado',
          lancamento_id: titulo.id,
        }).eq('id', row.id)
      } else {
        // Não encontrou lançamento correspondente — cria um novo já liquidado
        const { data: novoLan } = await supabase
          .from('lancamentos_financeiros')
          .insert({
            tipo,
            descricao: row.descricao_banco,
            valor: valorAbs,
            data_vencimento: row.data_lancamento,
            data_pagamento: row.data_lancamento,
            status: tipo === 'receber' ? 'recebido' : 'pago',
            conciliado: true,
            observacoes: `Importado do extrato bancário`,
            created_by: user.id,
          })
          .select('id')
          .single()

        await supabase.from('extrato_bancario').update({
          categoria_ia: categoria,
          status_conciliacao: 'conciliado',
          lancamento_id: novoLan?.id || null,
        }).eq('id', row.id)
      }

      atualizados++
    } catch (e) {
      console.error('Erro ao categorizar:', row.id, e)
    }
  }

  return NextResponse.json({ ok: true, atualizados })
}
