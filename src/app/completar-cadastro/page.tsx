'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EspecialidadeMulti, ESPECIALIDADE_LABELS, UserRole } from '@/types'

const ROLES_SEM_CONSELHO: UserRole[] = ['admin', 'cuidador', 'financeiro']

const S = {
  page: { minHeight: '100vh', background: '#1a1814', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif", padding: '20px' },
  card: { background: '#fff', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 80px rgba(0,0,0,.4)' },
  label: { display: 'block' as const, fontSize: '12px', fontWeight: 500 as const, color: '#5c5850', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #ccc8bc', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  select: { width: '100%', padding: '10px 14px', border: '1px solid #ccc8bc', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  btn: { width: '100%', padding: '13px', background: '#40916c', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600 as const, cursor: 'pointer', fontFamily: 'inherit' },
  erro: { background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px' },
}

const logo = (
  <div style={{ textAlign: 'center', marginBottom: '28px' }}>
    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '26px', color: '#1a1814', marginBottom: '4px' }}>
      Villa<span style={{ color: '#40916c', fontStyle: 'italic' }}>Cuidar</span>
    </div>
    <div style={{ fontSize: '11px', color: '#9a9588', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Sistema ILPI</div>
  </div>
)

function CompletarCadastroInner() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'verificando' | 'formulario' | 'erro' | 'sucesso'>('verificando')
  const [role, setRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [form, setForm] = useState({ senha: '', confirmar: '', conselho: '', especialidade: '' as EspecialidadeMulti | '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function verificar() {
      // Sessão já foi estabelecida pela rota /auth/callback antes de chegar aqui
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setStep('erro')
        setErro('Link inválido ou expirado. Solicite um novo convite ao administrador.')
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      setRole((profile?.role as UserRole) || null)
      setNome(profile?.full_name || user.email || '')
      setStep('formulario')
    }

    verificar()
  }, [])

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const precisaConselho = role !== null && !ROLES_SEM_CONSELHO.includes(role)
  const precisaEspecialidade = role === 'multidisciplinar'

  async function salvar() {
    setErro('')
    if (form.senha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return }
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return }
    if (precisaConselho && !form.conselho.trim()) { setErro('Informe o número do conselho profissional.'); return }
    if (precisaEspecialidade && !form.especialidade) { setErro('Selecione a especialidade.'); return }

    setSaving(true)

    const { error: pwError } = await supabase.auth.updateUser({ password: form.senha })
    if (pwError) {
      setErro('Erro ao definir senha: ' + pwError.message)
      setSaving(false)
      return
    }

    const updates: Record<string, string> = {}
    if (form.conselho.trim()) updates.coren = form.conselho.trim()
    if (form.especialidade) updates.especialidade = form.especialidade

    if (Object.keys(updates).length > 0 && userId) {
      await supabase.from('profiles').update(updates).eq('id', userId)
    }

    setSaving(false)
    setStep('sucesso')
    setTimeout(() => router.push('/dashboard'), 2500)
  }

  if (step === 'verificando') return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div style={S.card}>
        {logo}
        <div style={{ textAlign: 'center', color: '#9a9588', fontSize: '14px' }}>Verificando acesso...</div>
      </div>
    </div>
  )

  if (step === 'erro') return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div style={S.card}>
        {logo}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: '#1a1814' }}>Link inválido</div>
          <div style={{ fontSize: '13px', color: '#9a9588', lineHeight: '1.6' }}>{erro}</div>
        </div>
      </div>
    </div>
  )

  if (step === 'sucesso') return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div style={S.card}>
        {logo}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
          <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: '#1a1814' }}>Cadastro concluído!</div>
          <div style={{ fontSize: '13px', color: '#9a9588' }}>Redirecionando para o sistema...</div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div style={S.card}>
        {logo}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#1a1814', marginBottom: '6px' }}>
            Olá{nome ? `, ${nome.split(' ')[0]}` : ''}!
          </div>
          <div style={{ fontSize: '13px', color: '#9a9588', lineHeight: '1.6' }}>
            Defina sua senha para ativar o acesso ao sistema.
            {precisaConselho && ' Informe também o número do seu conselho profissional.'}
          </div>
        </div>

        {erro && <div style={S.erro}>{erro}</div>}

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
          <div>
            <label style={S.label}>Nova senha *</label>
            <input
              type="password"
              value={form.senha}
              onChange={e => upd('senha', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>Confirmar senha *</label>
            <input
              type="password"
              value={form.confirmar}
              onChange={e => upd('confirmar', e.target.value)}
              placeholder="Repita a senha"
              style={S.input}
            />
          </div>

          {precisaConselho && (
            <div>
              <label style={S.label}>Número do Conselho Profissional *</label>
              <input
                value={form.conselho}
                onChange={e => upd('conselho', e.target.value)}
                placeholder="Ex: COREN-SP 123456 / CRN 9876 / CRP 12345"
                style={S.input}
              />
            </div>
          )}

          {precisaEspecialidade && (
            <div>
              <label style={S.label}>Especialidade *</label>
              <select value={form.especialidade} onChange={e => upd('especialidade', e.target.value)} style={S.select}>
                <option value="">Selecione...</option>
                {(Object.entries(ESPECIALIDADE_LABELS) as [EspecialidadeMulti, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={salvar}
            disabled={saving}
            style={{ ...S.btn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Ativando conta...' : 'Ativar minha conta'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CompletarCadastroPage() {
  return (
    <Suspense fallback={null}>
      <CompletarCadastroInner />
    </Suspense>
  )
}
