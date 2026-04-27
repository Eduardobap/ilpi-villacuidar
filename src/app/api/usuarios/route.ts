import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem criar usuários' }, { status: 403 })
  }

  const body = await req.json()
  const { full_name, email, role, posto } = body

  if (!full_name || !email || !role) {
    return NextResponse.json({ error: 'Preencha nome, e-mail e perfil.' }, { status: 400 })
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const host = req.headers.get('host') || 'ilpi-system.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectTo = `${protocol}://${host}/completar-cadastro`

  const { data: newUser, error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Atualiza profile com dados extras (trigger já criou via metadata)
  if (newUser.user) {
    await adminSupabase.from('profiles').update({
      full_name,
      role,
      posto: posto || null,
    }).eq('id', newUser.user.id)
  }

  return NextResponse.json({ ok: true })
}
