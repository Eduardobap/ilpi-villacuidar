// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/cuidados/higiene':   ['admin', 'suprimentos'],
  '/dashboard/cuidados':           ['admin', 'enfermeira', 'tecnico', 'cuidador'],
  '/dashboard/multidisciplinar':   ['admin', 'enfermeira', 'multidisciplinar', 'nutricionista'],
  '/dashboard/financeiro':         ['admin', 'financeiro'],
  '/dashboard/extrato':            ['admin', 'financeiro'],
  '/dashboard/cozinha':            ['admin', 'nutricionista', 'suprimentos'],
  '/dashboard/limpeza':            ['admin', 'suprimentos'],
  '/dashboard/residentes':         ['admin', 'enfermeira', 'tecnico', 'cuidador', 'multidisciplinar'],
  '/dashboard/relatorios':         ['admin', 'enfermeira'],
  '/dashboard/usuarios':           ['admin'],
  '/dashboard/configuracoes':      ['admin'],
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()
  return '127.0.0.1'
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && path.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) return supabaseResponse

    // IP restriction — admin always exempt
    if (profile.role !== 'admin') {
      try {
        const { data: cfg } = await supabase
          .from('configuracoes')
          .select('restricao_dispositivo')
          .maybeSingle()

        const restricao: Record<string, string> = (cfg as any)?.restricao_dispositivo || {}

        if (restricao[profile.role] === 'restrito') {
          const clientIP = getClientIP(request)

          const { data: dispositivos } = await supabase
            .from('dispositivos_homologados')
            .select('ip_address')
            .eq('ativo', true)

          const approvedIPs = (dispositivos || []).map((d: any) => d.ip_address)

          if (!approvedIPs.includes(clientIP)) {
            return NextResponse.redirect(new URL('/acesso-negado', request.url))
          }
        }
      } catch {
        // Fail open — if restriction check errors, allow access
      }
    }

    // Route permission check
    for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
      if (path.startsWith(route) && !roles.includes(profile.role)) {
        return NextResponse.redirect(new URL('/dashboard?erro=sem-permissao', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
