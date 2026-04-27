// src/app/api/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Verificar se é admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem criar usuários' }, { status: 403 })
  }

  const body = await req.json()
  const { full_name, email, password, role, posto, especialidade, coren } = body

  if (!full_name || !email || !password || !role) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // Usar service_role para criar usuários (bypass RLS)
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Criar usuário no Auth
  const { data: newUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Atualizar profile com dados extras (o trigger já criou o profile básico)
  if (newUser.user) {
    await adminSupabase.from('profiles').update({
      full_name,
      role,
      posto: posto || null,
      especialidade: especialidade || null,
      coren: coren || null,
    }).eq('id', newUser.user.id)
  }

  return NextResponse.json({ ok: true, userId: newUser.user?.id })
}
