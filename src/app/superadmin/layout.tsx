'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).single()
      if (!p?.is_superadmin) { router.push('/dashboard'); return }
      setChecking(false)
    }
    check()
  }, [])

  if (checking) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ color:'#475569', fontSize:'14px' }}>Verificando acesso...</div>
    </div>
  )

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', fontFamily:"'DM Sans', sans-serif", color:'#f1f5f9' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      {/* Top bar */}
      <div style={{ background:'#1e293b', borderBottom:'1px solid rgba(255,255,255,.07)', padding:'0 32px', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky' as const, top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <div style={{ fontSize:'17px', fontWeight:700, color:'#f1f5f9' }}>
            Villa<span style={{ color:'#4ade80', fontStyle:'italic' }}>Cuidar</span>
          </div>
          <div style={{ height:'14px', width:'1px', background:'rgba(255,255,255,.15)' }}/>
          <div style={{ fontSize:'11px', color:'#4ade80', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase' as const }}>
            Super Admin
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ padding:'6px 14px', background:'rgba(255,255,255,.06)', color:'#94a3b8', border:'1px solid rgba(255,255,255,.1)', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
            ← Dashboard
          </button>
          <button
            onClick={logout}
            style={{ padding:'6px 14px', background:'transparent', color:'#64748b', border:'1px solid rgba(255,255,255,.08)', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
            Sair
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:'32px', maxWidth:'1400px', margin:'0 auto' }}>
        {children}
      </div>
    </div>
  )
}
