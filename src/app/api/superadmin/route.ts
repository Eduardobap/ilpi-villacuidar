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

export async function GET() {
  if (!(await checkSuperAdmin())) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const db = adminDb()
  const { data: empresas, error } = await db.from('empresas').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stats = await Promise.all((empresas || []).map(async (e: any) => {
    const [{ count: numRes }, { count: numUsr }] = await Promise.all([
      db.from('residentes').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id).eq('status', 'ativo'),
      db.from('profiles').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id).eq('active', true),
    ])
    return { ...e, num_residentes: numRes ?? 0, num_usuarios: numUsr ?? 0 }
  }))

  return NextResponse.json(stats)
}

export async function POST(req: NextRequest) {
  if (!(await checkSuperAdmin())) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const body = await req.json()
  const { nome, cnpj, email_contato, telefone, plano, limite_residentes, limite_usuarios, trial_ate, admin_email, admin_nome, observacoes } = body
  if (!nome) return NextResponse.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 })

  const db = adminDb()

  const { data: empresa, error: empError } = await db.from('empresas').insert({
    nome,
    cnpj: cnpj || null,
    email_contato: email_contato || null,
    telefone: telefone || null,
    plano: plano || 'trial',
    status: plano && plano !== 'trial' ? 'ativo' : 'trial',
    limite_residentes: limite_residentes || 30,
    limite_usuarios: limite_usuarios || 10,
    trial_ate: trial_ate || null,
    observacoes: observacoes || null,
  }).select('id').single()

  if (empError || !empresa) {
    return NextResponse.json({ error: empError?.message || 'Erro ao criar empresa' }, { status: 400 })
  }

  if (admin_email && admin_nome) {
    const host = req.headers.get('host') || ''
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const redirectTo = `${protocol}://${host}/auth/callback?next=/completar-cadastro`

    const { data: newUser, error: authError } = await db.auth.admin.inviteUserByEmail(admin_email, {
      data: { full_name: admin_nome, role: 'admin' },
      redirectTo,
    })

    if (!authError && newUser?.user) {
      await db.from('profiles').upsert({
        id: newUser.user.id,
        full_name: admin_nome,
        role: 'admin',
        empresa_id: empresa.id,
        active: true,
      })
    }
  }

  return NextResponse.json({ ok: true, empresa_id: empresa.id })
}
