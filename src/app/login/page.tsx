'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#1a1814',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'DM Sans', sans-serif", padding:'20px'
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"/>
      <div style={{
        background:'#fff', borderRadius:'20px', padding:'48px 40px',
        width:'100%', maxWidth:'400px', boxShadow:'0 24px 80px rgba(0,0,0,.4)'
      }}>
        <div style={{textAlign:'center', marginBottom:'36px'}}>
          <div style={{
            fontFamily:"'DM Serif Display', serif",
            fontSize:'28px', color:'#1a1814', marginBottom:'4px'
          }}>
            Villa<span style={{color:'#40916c', fontStyle:'italic'}}>Cuidar</span>
          </div>
          <div style={{fontSize:'12px', color:'#9a9588', letterSpacing:'1px', textTransform:'uppercase'}}>
            Sistema ILPI
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block', fontSize:'12px', fontWeight:500, color:'#5c5850', marginBottom:'6px'}}>
              E-mail
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="seu@email.com"
              style={{
                width:'100%', padding:'10px 14px', border:'1px solid #ccc8bc',
                borderRadius:'10px', fontSize:'14px', fontFamily:'inherit',
                outline:'none', boxSizing:'border-box'
              }}
            />
          </div>
          <div style={{marginBottom:'24px'}}>
            <label style={{display:'block', fontSize:'12px', fontWeight:500, color:'#5c5850', marginBottom:'6px'}}>
              Senha
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              style={{
                width:'100%', padding:'10px 14px', border:'1px solid #ccc8bc',
                borderRadius:'10px', fontSize:'14px', fontFamily:'inherit',
                outline:'none', boxSizing:'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b',
              padding:'10px 14px', borderRadius:'8px', fontSize:'13px', marginBottom:'16px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width:'100%', padding:'12px', background:'#40916c', color:'#fff',
              border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:600,
              cursor:loading ? 'not-allowed' : 'pointer', opacity:loading ? .7 : 1,
              fontFamily:'inherit'
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{
          textAlign:'center', fontSize:'12px', color:'#9a9588',
          marginTop:'24px', lineHeight:'1.5'
        }}>
          Esqueceu a senha? Contate o administrador da ILPI.
        </p>
      </div>
    </div>
  )
}
