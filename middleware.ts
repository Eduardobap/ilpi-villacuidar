// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas protegidas por role
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/cuidados':    ['admin', 'enfermeira', 'tecnico', 'cuidador'],
  '/dashboard/multidisciplinar': ['admin', 'enfermeira', 'multidisciplinar'],
  '/dashboard/financeiro':  ['admin', 'financeiro'],
  '/dashboard/cozinha':     ['admin', 'nutricionista'],
  '/dashboard/usuarios':    ['admin'],
  '/dashboard/relatorios':  ['admin', 'enfermeira'],
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

  // Redirect para login se não autenticado
  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect para dashboard se já autenticado e tentar acessar login
  if (user && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Verificar permissões de rota
  if (user && path.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
      if (path.startsWith(route) && profile && !roles.includes(profile.role)) {
        return NextResponse.redirect(new URL('/dashboard?erro=sem-permissao', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
