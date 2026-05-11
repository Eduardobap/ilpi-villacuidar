import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkSuperAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).single()
  return !!data?.is_superadmin
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkSuperAdmin())) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  const allowed = ['status', 'plano', 'limite_residentes', 'limite_usuarios', 'observacoes', 'nome', 'cnpj', 'email_contato', 'telefone', 'trial_ate']
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] || null
  }

  const { error } = await adminDb().from('empresas').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
