// configuracoes
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { ROLE_LABELS } from '@/types'

const S = {
  card: { background: '#fff', border: '1px solid #e0dbd0', borderRadius: '16px', padding: '24px' },
  label: { display: 'block' as const, fontSize: '12px', fontWeight: 500 as const, color: '#5c5850', marginBottom: '6px' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #ccc8bc', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  select: { width: '100%', padding: '9px 12px', border: '1px solid #ccc8bc', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  btn: { padding: '10px 24px', background: '#40916c', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600 as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnSm: { padding: '7px 14px', background: '#40916c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500 as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { padding: '6px 12px', background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  sectionTitle: { fontSize: '11px', fontWeight: 700 as const, color: '#40916c', textTransform: 'uppercase' as const, letterSpacing: '1px', paddingBottom: '8px', borderBottom: '2px solid #40916c', marginBottom: '16px' },
}

const MIGRATION_SQL = `ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS logo_url text;`

const MIGRATION_SQL_DEV = `-- Adicionar coluna de restrição de dispositivos na tabela configuracoes
ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS restricao_dispositivo jsonb DEFAULT '{}';

-- Criar tabela de dispositivos homologados
CREATE TABLE IF NOT EXISTS dispositivos_homologados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  ip_address text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dispositivos_homologados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispositivos_select" ON dispositivos_homologados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dispositivos_admin_all" ON dispositivos_homologados
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));`

type Dispositivo = { id: string; descricao: string; ip_address: string; ativo: boolean }

const ROLES_RESTRITOS: Array<keyof typeof ROLE_LABELS> = [
  'enfermeira', 'tecnico', 'cuidador', 'nutricionista', 'financeiro', 'multidisciplinar', 'suprimentos',
]

export default function ConfiguracoesPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({ nome_fantasia: '', logo_url: '', assinatura_modo: 'automatico' })
  const [restricao, setRestricao] = useState<Record<string, string>>({})
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [formDev, setFormDev] = useState({ descricao: '', ip_address: '' })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingDev, setSavingDev] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgDev, setMsgDev] = useState('')
  const [dbError, setDbError] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [needsMigrationDev, setNeedsMigrationDev] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [copiedSqlDev, setCopiedSqlDev] = useState(false)

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.push('/dashboard')
  }, [profile])

  async function loadDispositivos() {
    const { data, error } = await supabase
      .from('dispositivos_homologados')
      .select('*')
      .order('created_at')
    if (error) {
      if (error.message?.includes('does not exist')) setNeedsMigrationDev(true)
    } else {
      setDispositivos((data || []) as Dispositivo[])
    }
  }

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return
    async function load() {
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('id, assinatura_modo, nome_fantasia, logo_url, restricao_dispositivo')
          .maybeSingle()

        if (error) {
          if (error.message?.includes('column') || error.message?.includes('does not exist')) {
            setNeedsMigration(true)
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
          setRestricao((data as any).restricao_dispositivo || {})
        }
      } catch (e: any) {
        setDbError(e?.message || 'Erro desconhecido ao carregar configurações.')
      } finally {
        setLoading(false)
      }
    }
    load()
    loadDispositivos()
  }, [profile])

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const toggleRestricao = (role: string) =>
    setRestricao(r => ({ ...r, [role]: r[role] === 'restrito' ? 'livre' : 'restrito' }))

  async function salvar() {
    setSaving(true)
    setMsg('')
    try {
      const { error } = await supabase.from('configuracoes').upsert({
        id: 1,
        nome_fantasia: form.nome_fantasia || null,
        logo_url: form.logo_url || null,
        assinatura_modo: form.assinatura_modo,
        restricao_dispositivo: restricao,
      })
      if (error) {
        if (
          error.message?.includes('column') ||
          error.message?.includes('nome_fantasia') ||
          error.message?.includes('logo_url') ||
          error.message?.includes('restricao')
        ) {
          setNeedsMigration(true)
          setMsg('Execute o SQL de migração primeiro (veja acima).')
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

  async function adicionarDispositivo() {
    if (!formDev.descricao || !formDev.ip_address) {
      setMsgDev('Preencha a descrição e o endereço IP.')
      return
    }
    setSavingDev(true)
    const { error } = await supabase.from('dispositivos_homologados').insert({
      descricao: formDev.descricao,
      ip_address: formDev.ip_address.trim(),
    })
    setSavingDev(false)
    if (error) {
      if (error.message?.includes('does not exist')) setNeedsMigrationDev(true)
      setMsgDev('Erro: ' + error.message)
    } else {
      setFormDev({ descricao: '', ip_address: '' })
      setMsgDev('✅ Dispositivo adicionado!')
      setTimeout(() => setMsgDev(''), 3000)
      loadDispositivos()
    }
  }

  async function toggleDispositivo(id: string, ativo: boolean) {
    await supabase.from('dispositivos_homologados').update({ ativo: !ativo }).eq('id', id)
    loadDispositivos()
  }

  async function deletarDispositivo(id: string) {
    if (!confirm('Remover este dispositivo da lista de acesso autorizado?')) return
    await supabase.from('dispositivos_homologados').delete().eq('id', id)
    loadDispositivos()
  }

  function copiarSQL() {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => {
      setCopiedSql(true); setTimeout(() => setCopiedSql(false), 2000)
    })
  }

  function copiarSQLDev() {
    navigator.clipboard.writeText(MIGRATION_SQL_DEV).then(() => {
      setCopiedSqlDev(true); setTimeout(() => setCopiedSqlDev(false), 2000)
    })
  }

  if (!profile || loading) return (
    <div style={{ color: '#9a9588', fontSize: '14px', padding: '40px', textAlign: 'center' }}>
      Carregando...
    </div>
  )

  if (profile.role !== 'admin') return (
    <div style={{ color: '#991b1b', fontSize: '14px', padding: '40px', textAlign: 'center' }}>
      Acesso restrito ao administrador.
    </div>
  )

  if (dbError && !needsMigration) return (
    <div style={{ ...S.card, maxWidth: '600px' }}>
      <div style={{ fontSize: '20px', marginBottom: '8px' }}>⚠️</div>
      <div style={{ fontWeight: 600, marginBottom: '6px', color: '#991b1b' }}>Erro ao carregar configurações</div>
      <div style={{ fontSize: '13px', color: '#5c5850', marginBottom: '16px', fontFamily: 'monospace', background: '#fef2f2', padding: '10px', borderRadius: '6px' }}>{dbError}</div>
      <div style={{ fontSize: '12px', color: '#9a9588' }}>Verifique se a tabela <code>configuracoes</code> existe no Supabase e se as RLS policies permitem SELECT para o role <strong>admin</strong>.</div>
    </div>
  )

  const migrationPreStyle: React.CSSProperties = {
    background: '#1e1e1e', color: '#9cdcfe', fontSize: '12px',
    padding: '12px 16px', borderRadius: '8px', overflow: 'auto',
    margin: 0, fontFamily: 'monospace', lineHeight: '1.6',
  }

  return (
    <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Banner: migração principal */}
      {needsMigration && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>
            ⚠️ Migração necessária — execute o SQL abaixo no Supabase (SQL Editor)
          </div>
          <div style={{ fontSize: '11px', color: '#78350f', marginBottom: '10px' }}>
            As colunas <code>nome_fantasia</code> e <code>logo_url</code> ainda não existem na tabela <code>configuracoes</code>.
          </div>
          <div style={{ position: 'relative' }}>
            <pre style={migrationPreStyle}>{MIGRATION_SQL}</pre>
            <button onClick={copiarSQL} style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 10px', background: '#40916c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {copiedSql ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#92400e' }}>Após executar, salve as configurações normalmente.</div>
        </div>
      )}

      {/* Banner: migração dispositivos */}
      {needsMigrationDev && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>
            ⚠️ Migração necessária para Controle de Dispositivos — execute no SQL Editor do Supabase
          </div>
          <div style={{ position: 'relative' }}>
            <pre style={migrationPreStyle}>{MIGRATION_SQL_DEV}</pre>
            <button onClick={copiarSQLDev} style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 10px', background: '#40916c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {copiedSqlDev ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#92400e' }}>Após executar, recarregue a página.</div>
        </div>
      )}

      {/* Identidade da ILPI */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Identidade da Instituição</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <label style={S.label}>Nome da ILPI / Nome Fantasia</label>
            <input
              value={form.nome_fantasia}
              onChange={e => upd('nome_fantasia', e.target.value)}
              placeholder="Ex: Lar São Francisco, Doce Lar ILPI..."
              style={S.input}
            />
            <div style={{ fontSize: '11px', color: '#9a9588', marginTop: '4px' }}>
              Este nome aparecerá no cabeçalho de todos os documentos PDF gerados.
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
            <div style={{ fontSize: '11px', color: '#9a9588', marginTop: '4px' }}>
              URL pública de imagem PNG ou JPG. Recomendado: fundo transparente, proporção horizontal. Aparecerá no topo dos PDFs.
            </div>

            {form.logo_url && (
              <div style={{ marginTop: '12px', padding: '16px', background: '#f7f5f0', borderRadius: '10px', display: 'inline-flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: '#9a9588', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pré-visualização</div>
                <img
                  src={form.logo_url}
                  alt="Logo da ILPI"
                  style={{ height: '60px', maxWidth: '240px', objectFit: 'contain', display: 'block', borderRadius: '4px' }}
                  onError={e => {
                    const img = e.target as HTMLImageElement
                    img.style.display = 'none'
                    const next = img.nextElementSibling as HTMLElement | null
                    if (next) next.style.display = 'block'
                  }}
                />
                <div style={{ display: 'none', fontSize: '12px', color: '#991b1b', padding: '6px 10px', background: '#fee2e2', borderRadius: '6px' }}>
                  ⚠ Imagem não carregou — verifique se a URL é pública e acessível
                </div>
              </div>
            )}
          </div>

          {(form.nome_fantasia || form.logo_url) && (
            <div>
              <div style={{ fontSize: '11px', color: '#9a9588', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Como ficará no cabeçalho do PDF</div>
              <div style={{ border: '2px solid #40916c', borderRadius: '8px', padding: '16px 20px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  {form.logo_url && (
                    <img src={form.logo_url} alt="Logo" style={{ height: '40px', objectFit: 'contain', display: 'block', marginBottom: '4px' }} />
                  )}
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#40916c' }}>{form.nome_fantasia || 'VillaCuidar'}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>Sistema de Gestão ILPI</div>
                </div>
                <div style={{ fontSize: '10px', color: '#aaa' }}>Gerado em {new Date().toLocaleString('pt-BR')}</div>
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
          <div style={{ fontSize: '11px', color: '#9a9588', marginTop: '6px' }}>
            No modo automático, a assinatura eletrônica avançada (Lei 14.063/2020) é gerada automaticamente ao salvar para enfermeiras, técnicos e admins.
          </div>
        </div>
      </div>

      {/* Controle de acesso por dispositivo */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Controle de Acesso por Dispositivo</div>
        <div style={{ fontSize: '13px', color: '#5c5850', marginBottom: '16px', lineHeight: '1.7' }}>
          Para cada perfil, defina se o acesso é <strong>Livre</strong> (qualquer dispositivo/rede) ou <strong>Restrito</strong> (somente IPs cadastrados abaixo).
          O perfil <strong>Administrador</strong> sempre tem acesso irrestrito.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
          {ROLES_RESTRITOS.map(role => {
            const isRestrito = restricao[role] === 'restrito'
            return (
              <div
                key={role}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: '10px',
                  background: isRestrito ? '#fff9f9' : '#f7f5f0',
                  border: `1px solid ${isRestrito ? '#fca5a5' : '#e0dbd0'}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1814' }}>
                    {ROLE_LABELS[role]}
                  </div>
                  <div style={{ fontSize: '11px', color: isRestrito ? '#dc2626' : '#9a9588', marginTop: '2px' }}>
                    {isRestrito ? '🔒 Restrito — apenas IPs homologados' : '🌐 Livre — qualquer dispositivo'}
                  </div>
                </div>
                <button
                  onClick={() => toggleRestricao(role)}
                  style={{
                    padding: '7px 18px', border: 'none', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 600 as const, cursor: 'pointer',
                    fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
                    background: isRestrito ? '#dc2626' : '#e0dbd0',
                    color: isRestrito ? '#fff' : '#5c5850',
                  }}
                >
                  {isRestrito ? '🔒 Restrito' : '🌐 Livre'}
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#9a9588', fontStyle: 'italic' }}>
          Salve as configurações abaixo para aplicar as alterações de restrição.
        </div>
      </div>

      {/* Feedback e botão salvar */}
      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
          background: msg.includes('Erro') || msg.includes('migração') ? '#fee2e2' : '#d8f3dc',
          color: msg.includes('Erro') || msg.includes('migração') ? '#991b1b' : '#2d6a4f',
        }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={salvar}
          disabled={saving}
          style={{ ...S.btn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Salvando...' : '💾 Salvar Configurações'}
        </button>
        {needsMigration && (
          <span style={{ fontSize: '12px', color: '#92400e' }}>Execute o SQL de migração antes de salvar</span>
        )}
      </div>

      {/* Dispositivos homologados */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Dispositivos Homologados (IPs Autorizados)</div>
        <div style={{ fontSize: '13px', color: '#5c5850', marginBottom: '16px', lineHeight: '1.7' }}>
          Cadastre os endereços IP que têm permissão para acessar o sistema nos perfis com acesso restrito.
          Geralmente são os IPs fixos da rede interna da instituição.
        </div>

        {/* Formulário de adição */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 180px auto',
          gap: '10px', marginBottom: '16px', alignItems: 'flex-end',
        }}>
          <div>
            <label style={S.label}>Descrição do dispositivo</label>
            <input
              value={formDev.descricao}
              onChange={e => setFormDev(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Computador da Enfermaria"
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>Endereço IP</label>
            <input
              value={formDev.ip_address}
              onChange={e => setFormDev(f => ({ ...f, ip_address: e.target.value }))}
              placeholder="Ex: 192.168.1.50"
              style={S.input}
            />
          </div>
          <button
            onClick={adicionarDispositivo}
            disabled={savingDev}
            style={{ ...S.btnSm, padding: '9px 16px', opacity: savingDev ? 0.7 : 1, cursor: savingDev ? 'not-allowed' : 'pointer' }}
          >
            + Adicionar
          </button>
        </div>

        {msgDev && (
          <div style={{
            fontSize: '12px', marginBottom: '12px', padding: '8px 12px', borderRadius: '6px',
            background: msgDev.includes('Erro') ? '#fee2e2' : '#d8f3dc',
            color: msgDev.includes('Erro') ? '#991b1b' : '#2d6a4f',
          }}>
            {msgDev}
          </div>
        )}

        {/* Lista de dispositivos */}
        {dispositivos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9a9588', fontSize: '13px', padding: '24px', background: '#f7f5f0', borderRadius: '10px' }}>
            Nenhum dispositivo cadastrado. Adicione IPs acima para começar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {dispositivos.map(d => (
              <div
                key={d.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 14px', borderRadius: '8px',
                  background: d.ativo ? '#f0fdf4' : '#f7f5f0',
                  border: `1px solid ${d.ativo ? '#86efac' : '#e0dbd0'}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1814' }}>{d.descricao}</div>
                  <div style={{ fontSize: '12px', color: '#9a9588', fontFamily: 'monospace', marginTop: '2px' }}>{d.ip_address}</div>
                </div>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500,
                  background: d.ativo ? '#d8f3dc' : '#f1efe8',
                  color: d.ativo ? '#2d6a4f' : '#9a9588',
                }}>
                  {d.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  onClick={() => toggleDispositivo(d.id, d.ativo)}
                  style={{
                    ...S.btnSm,
                    background: d.ativo ? '#92400e' : '#40916c',
                    padding: '5px 12px', fontSize: '11px',
                  }}
                >
                  {d.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => deletarDispositivo(d.id)} style={S.btnDanger}>
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: '16px', padding: '12px 16px', background: '#fefce8',
          border: '1px solid #fde047', borderRadius: '8px', fontSize: '12px',
          color: '#713f12', lineHeight: '1.7',
        }}>
          <strong>Como descobrir o IP do dispositivo?</strong><br />
          No computador a ser homologado: abra o CMD e digite <code>ipconfig</code> (Windows) ou <code>ip addr</code> (Linux/Mac) e anote o &quot;Endereço IPv4&quot; da rede local.<br />
          Se o sistema for acessado pela internet, use o IP externo: acesse <strong>meuip.com.br</strong> no navegador do dispositivo a ser homologado.
        </div>
      </div>

    </div>
  )
}
