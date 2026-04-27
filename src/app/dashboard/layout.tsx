'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, ROLE_LABELS, POSTO_LABELS, PERMISSIONS } from '@/types'

// ── Auth Context ──────────────────────────────────────────
interface AuthCtx { profile: Profile | null; loading: boolean }
const AuthContext = createContext<AuthCtx>({ profile: null, loading: true })
export const useAuth = () => useContext(AuthContext)

// ── Nav items ─────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',         label: 'Dashboard',          icon: '◻', href: '/dashboard',                   roles: ['admin','enfermeira','tecnico','cuidador','nutricionista','financeiro','multidisciplinar'] },
  { id: 'residentes',        label: 'Residentes',          icon: '◻', href: '/dashboard/residentes',         roles: ['admin','enfermeira','tecnico','cuidador','multidisciplinar'] },
  { id: 'evolucoes',         label: 'Evoluções',           icon: '◻', href: '/dashboard/cuidados/evolucoes', roles: ['admin','enfermeira','tecnico','cuidador'] },
  { id: 'passagem',          label: 'Passagem de Plantão', icon: '◻', href: '/dashboard/cuidados/passagem',  roles: ['admin','enfermeira','tecnico','cuidador'] },
  { id: 'multidisciplinar',  label: 'Multidisciplinar',    icon: '◻', href: '/dashboard/multidisciplinar',   roles: ['admin','enfermeira','multidisciplinar'] },
  { id: 'relatorios',        label: 'PAI / PIA',           icon: '◻', href: '/dashboard/relatorios',         roles: ['admin','enfermeira'] },
  { id: 'financeiro',        label: 'Financeiro',          icon: '◻', href: '/dashboard/financeiro',         roles: ['admin','financeiro'] },
  { id: 'extrato',           label: 'Extrato Bancário',    icon: '◻', href: '/dashboard/extrato',            roles: ['admin','financeiro'] },
  { id: 'cardapio',          label: 'Cardápio',            icon: '◻', href: '/dashboard/cozinha/cardapio',   roles: ['admin','nutricionista'] },
  { id: 'estoque',           label: 'Estoque Cozinha',     icon: '◻', href: '/dashboard/cozinha/estoque',    roles: ['admin','nutricionista'] },
  { id: 'usuarios',          label: 'Usuários',            icon: '◻', href: '/dashboard/usuarios',           roles: ['admin'] },
  { id: 'configuracoes',     label: 'Configurações',       icon: '◻', href: '/dashboard/configuracoes',      roles: ['admin'] },
]

const GROUPS = [
  { label: 'Início',      ids: ['dashboard'] },
  { label: 'Cuidados',    ids: ['residentes','evolucoes','passagem','multidisciplinar','relatorios'] },
  { label: 'Financeiro',  ids: ['financeiro','extrato'] },
  { label: 'Cozinha',     ids: ['cardapio','estoque'] },
  { label: 'Gestão',      ids: ['usuarios','configuracoes'] },
]

const ICONS: Record<string, string> = {
  dashboard:'⊞', residentes:'👥', evolucoes:'📋', passagem:'🔄',
  multidisciplinar:'🛡', relatorios:'📄', financeiro:'💰', extrato:'🏦',
  cardapio:'🍽', estoque:'📦', usuarios:'👤', configuracoes:'⚙'
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f7f5f0',fontFamily:'DM Sans,sans-serif'}}>
      <div style={{color:'#5c5850'}}>Carregando...</div>
    </div>
  )

  const visibleNav = NAV.filter(n => profile && n.roles.includes(profile.role))

  const avatarInitials = profile?.full_name
    .split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase() || '?'

  return (
    <AuthContext.Provider value={{ profile, loading }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"/>
      <div style={{display:'flex', height:'100vh', fontFamily:"'DM Sans', sans-serif", background:'#f7f5f0'}}>

        {/* Sidebar */}
        <div style={{
          width:'220px', minWidth:'220px', background:'#1a1814',
          display:'flex', flexDirection:'column', overflowY:'auto'
        }}>
          {/* Logo */}
          <div style={{padding:'20px 16px 16px', borderBottom:'1px solid rgba(255,255,255,.08)'}}>
            <div style={{fontFamily:"'DM Serif Display', serif", color:'#fff', fontSize:'16px'}}>
              Villa<span style={{color:'#b7e4c7', fontStyle:'italic'}}>Cuidar</span>
            </div>
            <div style={{fontSize:'10px', color:'rgba(255,255,255,.3)', marginTop:'2px', letterSpacing:'.5px', textTransform:'uppercase'}}>
              Sistema ILPI
            </div>
          </div>

          {/* Perfil no sidebar */}
          <div style={{padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{fontSize:'12px', fontWeight:500, color:'#fff'}}>{profile?.full_name}</div>
            <div style={{fontSize:'11px', color:'rgba(255,255,255,.4)', marginTop:'2px'}}>
              {profile ? ROLE_LABELS[profile.role] : ''}
            </div>
            {profile?.posto && (
              <div style={{
                display:'inline-block', marginTop:'6px', padding:'2px 8px',
                background:'rgba(64,145,108,.2)', border:'1px solid rgba(183,228,199,.2)',
                borderRadius:'20px', fontSize:'10px', color:'#b7e4c7'
              }}>
                {POSTO_LABELS[profile.posto]}
              </div>
            )}
          </div>

          {/* Nav */}
          <div style={{flex:1, padding:'8px 0'}}>
            {GROUPS.map(g => {
              const items = visibleNav.filter(n => g.ids.includes(n.id))
              if (!items.length) return null
              return (
                <div key={g.label} style={{marginBottom:'4px'}}>
                  <div style={{padding:'8px 16px 4px', fontSize:'10px', color:'rgba(255,255,255,.25)', textTransform:'uppercase', letterSpacing:'.7px'}}>
                    {g.label}
                  </div>
                  {items.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    return (
                      <div
                        key={item.id}
                        onClick={() => router.push(item.href)}
                        style={{
                          display:'flex', alignItems:'center', gap:'10px',
                          padding:'9px 16px', cursor:'pointer',
                          color: active ? '#fff' : 'rgba(255,255,255,.6)',
                          background: active ? 'rgba(255,255,255,.1)' : 'transparent',
                          borderLeft: active ? '3px solid #b7e4c7' : '3px solid transparent',
                          fontSize:'13px', transition:'all .15s'
                        }}
                      >
                        <span style={{fontSize:'14px'}}>{ICONS[item.id]}</span>
                        {item.label}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Logout */}
          <div style={{padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,.08)'}}>
            <button
              onClick={logout}
              style={{
                width:'100%', padding:'8px', background:'transparent',
                border:'1px solid rgba(255,255,255,.15)', borderRadius:'8px',
                color:'rgba(255,255,255,.5)', fontSize:'12px', cursor:'pointer',
                fontFamily:'inherit'
              }}
            >
              Sair
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
          {/* Topbar */}
          <div style={{
            background:'#fff', borderBottom:'1px solid #e0dbd0',
            padding:'0 24px', height:'56px', display:'flex',
            alignItems:'center', justifyContent:'space-between', flexShrink:0
          }}>
            <div style={{fontSize:'15px', fontWeight:500, color:'#1a1814'}}>
              {NAV.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label || 'Dashboard'}
            </div>
            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
              <span style={{
                background:'#d8f3dc', color:'#2d6a4f', fontSize:'11px',
                padding:'3px 10px', borderRadius:'20px', fontWeight:500
              }}>
                {new Date().toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric'})}
              </span>
              <div style={{
                width:'32px', height:'32px', background:'#40916c', borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:'12px', fontWeight:600
              }}>
                {avatarInitials}
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{flex:1, overflowY:'auto', padding:'24px', background:'#f7f5f0'}}>
            {children}
          </div>
        </div>
      </div>
    </AuthContext.Provider>
  )
}
