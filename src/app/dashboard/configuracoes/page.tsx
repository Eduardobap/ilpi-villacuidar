// configuracoes
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'24px' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'6px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  btn: { padding:'10px 24px', background:'#40916c', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:600 as const, cursor:'pointer', fontFamily:'inherit' },
  sectionTitle: { fontSize:'11px', fontWeight:700 as const, color:'#40916c', textTransform:'uppercase' as const, letterSpacing:'1px', paddingBottom:'8px', borderBottom:'2px solid #40916c', marginBottom:'16px' },
}

const MIGRATION_SQL = `ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS logo_url text;`

export default function ConfiguracoesPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({ nome_fantasia: '', logo_url: '', assinatura_modo: 'automatico' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [dbError, setDbError] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  // Admin-only guard
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [profile])

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return
    async function load() {
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('id, assinatura_modo, nome_fantasia, logo_url')
          .maybeSingle()

        if (error) {
          // Column doesn't exist yet → migration needed
          if (error.message?.includes('column') || error.message?.includes('does not exist')) {
            setNeedsMigration(true)
            // Still try to load assinatura_modo at least
            const { data: partial } = await supabase
              .from('configuracoes')
              .select('assinatura_modo')
              .maybeSingle()
            if (partial) setForm(f => ({ ...f, assinatura_modo: partial.assinatura_modo || 'automatico' }))
          } else {
            setDbError(error.message)
          }
        } else if (data) {
          setForm({
            nome_fantasia: (data as any).nome_fantasia || '',
            logo_url: (data as any).logo_url || '',
            assinatura_modo: data.assinatura_modo || 'automatico',
          })
        }
      } catch (e: any) {
        setDbError(e?.message || 'Erro desconhecido ao carregar configurações.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile])

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function salvar() {
    setSaving(true)
    setMsg('')
    try {
      const { error } = await supabase.from('configuracoes').upsert({
        id: 1,
        nome_fantasia: form.nome_fantasia || null,
        logo_url: form.logo_url || null,
        assinatura_modo: form.assinatura_modo,
      })
      if (error) {
        if (error.message?.includes('column') || error.message?.includes('nome_fantasia') || error.message?.includes('logo_url')) {
          setNeedsMigration(true)
          setMsg('Execute o SQL de migração primeiro (veja abaixo).')
        } else {
          setMsg('Erro ao salvar: ' + error.message)
        }
      } else {
        setMsg('✅ Configurações salvas com sucesso!')
        setNeedsMigration(false)
        setTimeout(() => setMsg(''), 3000)
      }
    } catch (e: any) {
      setMsg('Erro ao salvar: ' + (e?.message || 'Erro desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  function copiarSQL() {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => {
      setCopiedSql(true)
      setTimeout(() => setCopiedSql(false), 2000)
    })
  }

  // Aguarda profile carregar antes de mostrar loading
  if (!profile || loading) return (
    <div style={{ color:'#9a9588', fontSize:'14px', padding:'40px', textAlign:'center' }}>
      Carregando...
    </div>
  )

  // Usuário não é admin
  if (profile.role !== 'admin') return (
    <div style={{ color:'#991b1b', fontSize:'14px', padding:'40px', textAlign:'center' }}>
      Acesso restrito ao administrador.
    </div>
  )

  // Erro grave de banco (não apenas coluna faltando)
  if (dbError && !needsMigration) return (
    <div style={{ ...S.card, maxWidth:'600px' }}>
      <div style={{ fontSize:'20px', marginBottom:'8px' }}>⚠️</div>
      <div style={{ fontWeight:600, marginBottom:'6px', color:'#991b1b' }}>Erro ao carregar configurações</div>
      <div style={{ fontSize:'13px', color:'#5c5850', marginBottom:'16px', fontFamily:'monospace', background:'#fef2f2', padding:'10px', borderRadius:'6px' }}>{dbError}</div>
      <div style={{ fontSize:'12px', color:'#9a9588' }}>Verifique se a tabela <code>configuracoes</code> existe no Supabase e se as RLS policies permitem SELECT para o role <strong>admin</strong>.</div>
    </div>
  )

  return (
    <div style={{ maxWidth:'660px', display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* Banner de migração pendente */}
      {needsMigration && (
        <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'12px', padding:'16px 20px' }}>
          <div style={{ fontWeight:600, fontSize:'13px', color:'#92400e', marginBottom:'8px' }}>
            ⚠️ Migração necessária — execute o SQL abaixo no Supabase
          </div>
          <div style={{ fontSize:'11px', color:'#78350f', marginBottom:'10px' }}>
            As colunas <code>nome_fantasia</code> e <code>logo_url</code> ainda não existem na tabela <code>configuracoes</code>. Execute o comando abaixo no SQL Editor do Supabase:
          </div>
          <div style={{ position:'relative' }}>
            <pre style={{ background:'#1e1e1e', color:'#9cdcfe', fontSize:'12px', padding:'12px 16px', borderRadius:'8px', overflow:'auto', margin:0, fontFamily:'monospace', lineHeight:'1.6' }}>
              {MIGRATION_SQL}
            </pre>
            <button onClick={copiarSQL} style={{ position:'absolute', top:'8px', right:'8px', padding:'4px 10px', background:'#40916c', color:'#fff', border:'none', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
              {copiedSql ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <div style={{ marginTop:'10px', fontSize:'11px', color:'#92400e' }}>
            Após executar, salve as configurações normalmente.
          </div>
        </div>
      )}

      {/* Identidade da ILPI */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Identidade da Instituição</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          <div>
            <label style={S.label}>Nome da ILPI / Nome Fantasia</label>
            <input
              value={form.nome_fantasia}
              onChange={e => upd('nome_fantasia', e.target.value)}
              placeholder="Ex: Lar São Francisco, Doce Lar ILPI..."
              style={S.input}
            />
            <div style={{ fontSize:'11px', color:'#9a9588', marginTop:'4px' }}>
              Este nome aparecerá no cabeçalho de todos os documentos PDF gerados (evoluções, relatórios, multidisciplinar, etc.)
            </div>
          </div>

          <div>
            <label style={S.label}>URL da Logo</label>
            <input
              value={form.logo_url}
              onChange={e => upd('logo_url', e.target.value)}
              placeholder="https://exemplo.com/logo.png"
              style={S.input}
            />
            <div style={{ fontSize:'11px', color:'#9a9588', marginTop:'4px' }}>
              URL pública de imagem PNG ou JPG. Recomendado: fundo transparente, proporção horizontal. Aparecerá no topo dos PDFs.
            </div>

            {form.logo_url && (
              <div style={{ marginTop:'12px', padding:'16px', background:'#f7f5f0', borderRadius:'10px', display:'inline-flex', flexDirection:'column' as const, alignItems:'flex-start', gap:'8px' }}>
                <div style={{ fontSize:'10px', color:'#9a9588', textTransform:'uppercase', letterSpacing:'0.5px' }}>Pré-visualização</div>
                <img
                  src={form.logo_url}
                  alt="Logo da ILPI"
                  style={{ height:'60px', maxWidth:'240px', objectFit:'contain', display:'block', borderRadius:'4px' }}
                  onError={e => {
                    const img = e.target as HTMLImageElement
                    img.style.display = 'none'
                    img.nextElementSibling && ((img.nextElementSibling as HTMLElement).style.display = 'block')
                  }}
                />
                <div style={{ display:'none', fontSize:'12px', color:'#991b1b', padding:'6px 10px', background:'#fee2e2', borderRadius:'6px' }}>
                  ⚠ Imagem não carregou — verifique se a URL é pública e acessível
                </div>
              </div>
            )}
          </div>

          {/* Preview de como vai aparecer no PDF */}
          {(form.nome_fantasia || form.logo_url) && (
            <div>
              <div style={{ fontSize:'11px', color:'#9a9588', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Como ficará no cabeçalho do PDF</div>
              <div style={{ border:'2px solid #40916c', borderRadius:'8px', padding:'16px 20px', background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                <div>
                  {form.logo_url && (
                    <img src={form.logo_url} alt="Logo" style={{ height:'40px', objectFit:'contain', display:'block', marginBottom:'4px' }} />
                  )}
                  <div style={{ fontSize:'16px', fontWeight:700, color:'#40916c' }}>{form.nome_fantasia || 'VillaCuidar'}</div>
                  <div style={{ fontSize:'10px', color:'#888' }}>Sistema de Gestão ILPI</div>
                </div>
                <div style={{ fontSize:'10px', color:'#aaa' }}>Gerado em {new Date().toLocaleString('pt-BR')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assinaturas */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Assinaturas Digitais</div>
        <div>
          <label style={S.label}>Modo de Assinatura</label>
          <select value={form.assinatura_modo} onChange={e => upd('assinatura_modo', e.target.value)} style={S.select}>
            <option value="automatico">Automático — assina ao salvar a evolução</option>
            <option value="manual">Manual — profissional assina separadamente</option>
          </select>
          <div style={{ fontSize:'11px', color:'#9a9588', marginTop:'6px' }}>
            No modo automático, a assinatura eletrônica avançada (Lei 14.063/2020) é gerada automaticamente ao salvar para enfermeiras, técnicos e admins.
          </div>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div style={{ padding:'12px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, background: msg.includes('Erro') || msg.includes('migração') ? '#fee2e2' : '#d8f3dc', color: msg.includes('Erro') || msg.includes('migração') ? '#991b1b' : '#2d6a4f' }}>
          {msg}
        </div>
      )}

      {/* Botão salvar */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <button
          onClick={salvar}
          disabled={saving}
          style={{ ...S.btn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Salvando...' : '💾 Salvar Configurações'}
        </button>
        {needsMigration && (
          <span style={{ fontSize:'12px', color:'#92400e' }}>Execute o SQL de migração antes de salvar</span>
        )}
      </div>
    </div>
  )
}
