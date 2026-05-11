'use client'
import { useEffect, useState } from 'react'
import { Empresa, PlanoEmpresa, StatusEmpresa, PLANO_LABELS, STATUS_EMPRESA_LABELS } from '@/types'

type EmpresaComStats = Empresa & { num_residentes: number; num_usuarios: number }

const PLANO_COLOR: Record<PlanoEmpresa, { bg: string; text: string }> = {
  trial:        { bg: 'rgba(100,116,139,.18)', text: '#94a3b8' },
  basico:       { bg: 'rgba(74,222,128,.12)',  text: '#4ade80' },
  profissional: { bg: 'rgba(96,165,250,.12)',  text: '#60a5fa' },
  enterprise:   { bg: 'rgba(167,139,250,.12)', text: '#a78bfa' },
}

const STATUS_COLOR: Record<StatusEmpresa, { bg: string; text: string }> = {
  trial:     { bg: 'rgba(251,191,36,.12)',  text: '#fbbf24' },
  ativo:     { bg: 'rgba(74,222,128,.12)',  text: '#4ade80' },
  suspenso:  { bg: 'rgba(248,113,113,.12)', text: '#f87171' },
  cancelado: { bg: 'rgba(100,116,139,.12)', text: '#64748b' },
}

const S = {
  label: { display:'block' as const, fontSize:'11px', fontWeight:500 as const, color:'#64748b', marginBottom:'5px', textTransform:'uppercase' as const, letterSpacing:'.4px' },
  input: { width:'100%', padding:'9px 12px', background:'#0f172a', border:'1px solid rgba(255,255,255,.1)', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none', color:'#f1f5f9' },
  select: { width:'100%', padding:'9px 12px', background:'#0f172a', border:'1px solid rgba(255,255,255,.1)', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, color:'#f1f5f9' },
  textarea: { width:'100%', padding:'9px 12px', background:'#0f172a', border:'1px solid rgba(255,255,255,.1)', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const, color:'#f1f5f9', resize:'vertical' as const, minHeight:'70px' },
}

const FORM_EMPTY = { nome:'', cnpj:'', email_contato:'', telefone:'', plano:'trial' as PlanoEmpresa, limite_residentes:'30', limite_usuarios:'10', trial_ate:'', admin_nome:'', admin_email:'', observacoes:'' }

export default function SuperAdminPage() {
  const [empresas, setEmpresas] = useState<EmpresaComStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEmpresa, setEditEmpresa] = useState<EmpresaComStats | null>(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...FORM_EMPTY })
  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/superadmin')
    if (res.ok) setEmpresas(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function criarEmpresa() {
    if (!form.nome.trim()) { showMsg('Nome da empresa é obrigatório'); return }
    setSaving(true)
    const res = await fetch('/api/superadmin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, limite_residentes: +form.limite_residentes || 30, limite_usuarios: +form.limite_usuarios || 10 }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); showMsg('Erro: ' + d.error); return }
    showMsg('✓ Empresa criada com sucesso!')
    setShowForm(false)
    setForm({ ...FORM_EMPTY })
    load()
  }

  async function salvarEdicao() {
    if (!editEmpresa) return
    setSaving(true)
    const res = await fetch(`/api/superadmin/${editEmpresa.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: editEmpresa.nome,
        email_contato: editEmpresa.email_contato,
        telefone: editEmpresa.telefone,
        plano: editEmpresa.plano,
        status: editEmpresa.status,
        limite_residentes: editEmpresa.limite_residentes,
        limite_usuarios: editEmpresa.limite_usuarios,
        trial_ate: editEmpresa.trial_ate,
        observacoes: editEmpresa.observacoes,
      }),
    })
    setSaving(false)
    if (res.ok) { setEditEmpresa(null); load() }
  }

  async function toggleStatus(e: EmpresaComStats) {
    const novoStatus: StatusEmpresa = e.status === 'suspenso' ? 'ativo' : 'suspenso'
    await fetch(`/api/superadmin/${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    })
    load()
  }

  const ativas = empresas.filter(e => e.status === 'ativo').length
  const trials = empresas.filter(e => e.status === 'trial').length
  const suspensas = empresas.filter(e => e.status === 'suspenso').length
  const totalResidentes = empresas.reduce((s, e) => s + e.num_residentes, 0)

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '26px', fontWeight: 700, color: '#f1f5f9' }}>Empresas Contratantes</div>
        <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Gerencie todas as ILPIs que utilizam o VillaCuidar</div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('✓') ? 'rgba(74,222,128,.1)' : 'rgba(248,113,113,.1)', border: `1px solid ${msg.startsWith('✓') ? '#4ade80' : '#f87171'}30`, color: msg.startsWith('✓') ? '#4ade80' : '#f87171', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
          {msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total de Empresas', value: empresas.length, color: '#60a5fa' },
          { label: 'Contratos Ativos', value: ativas, color: '#4ade80' },
          { label: 'Em Trial', value: trials, color: '#fbbf24' },
          { label: 'Residentes na Plataforma', value: totalResidentes, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '20px 24px' }}>
            <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '.5px', marginBottom: '10px' }}>{s.label}</div>
            <div style={{ fontSize: '30px', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#475569' }}>
          {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}
          {suspensas > 0 && <span style={{ color: '#f87171', marginLeft: '8px' }}>· {suspensas} suspensa{suspensas !== 1 ? 's' : ''}</span>}
        </div>
        <button
          onClick={() => { setShowForm(true); setForm({ ...FORM_EMPTY }) }}
          style={{ padding: '10px 22px', background: '#4ade80', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Nova Empresa
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,.07)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center' as const, color: '#475569', padding: '60px', fontSize: '14px' }}>Carregando...</div>
        ) : empresas.length === 0 ? (
          <div style={{ textAlign: 'center' as const, color: '#475569', padding: '80px 40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>Nenhuma empresa cadastrada</div>
            <div style={{ fontSize: '13px', color: '#334155' }}>Clique em "Nova Empresa" para começar a comercializar</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                {['Empresa', 'Plano', 'Status', 'Residentes', 'Usuários', 'Trial até', 'Cadastro', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: '10px', color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '.6px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: i < empresas.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', opacity: e.status === 'cancelado' ? 0.5 : 1 }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 500, fontSize: '14px', color: '#f1f5f9' }}>{e.nome}</div>
                    {e.email_contato && <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{e.email_contato}</div>}
                    {e.cnpj && <div style={{ fontSize: '11px', color: '#334155' }}>{e.cnpj}</div>}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, ...PLANO_COLOR[e.plano] }}>
                      {PLANO_LABELS[e.plano]}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, ...STATUS_COLOR[e.status] }}>
                      {STATUS_EMPRESA_LABELS[e.status]}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: e.num_residentes >= e.limite_residentes * 0.9 ? '#fbbf24' : '#94a3b8' }}>
                      {e.num_residentes}
                      <span style={{ color: '#334155', fontWeight: 400 }}>/{e.limite_residentes}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: e.num_usuarios >= e.limite_usuarios * 0.9 ? '#fbbf24' : '#94a3b8' }}>
                      {e.num_usuarios}
                      <span style={{ color: '#334155', fontWeight: 400 }}>/{e.limite_usuarios}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontSize: '12px', color: '#475569' }}>
                    {e.trial_ate ? new Date(e.trial_ate + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding: '16px', fontSize: '12px', color: '#334155' }}>
                    {new Date(e.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setEditEmpresa({ ...e })} style={{ padding: '5px 12px', background: 'rgba(255,255,255,.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,.1)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Editar
                      </button>
                      {e.status !== 'cancelado' && (
                        <button onClick={() => toggleStatus(e)} style={{ padding: '5px 12px', background: e.status === 'suspenso' ? 'rgba(74,222,128,.1)' : 'rgba(248,113,113,.08)', color: e.status === 'suspenso' ? '#4ade80' : '#f87171', border: `1px solid ${e.status === 'suspenso' ? '#4ade8030' : '#f8711330'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {e.status === 'suspenso' ? 'Ativar' : 'Suspender'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '24px', color: '#f1f5f9' }}>Nova Empresa Contratante</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Nome da ILPI *</label>
                <input value={form.nome} onChange={e => upd('nome', e.target.value)} style={S.input} placeholder="Ex: Casa de Repouso São Benedito" />
              </div>
              <div>
                <label style={S.label}>CNPJ</label>
                <input value={form.cnpj} onChange={e => upd('cnpj', e.target.value)} style={S.input} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label style={S.label}>Telefone</label>
                <input value={form.telefone} onChange={e => upd('telefone', e.target.value)} style={S.input} placeholder="(11) 99999-9999" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>E-mail de Contato</label>
                <input value={form.email_contato} onChange={e => upd('email_contato', e.target.value)} style={S.input} placeholder="contato@ilpi.com.br" />
              </div>
              <div>
                <label style={S.label}>Plano</label>
                <select value={form.plano} onChange={e => upd('plano', e.target.value)} style={S.select}>
                  <option value="trial">Trial (gratuito)</option>
                  <option value="basico">Básico</option>
                  <option value="profissional">Profissional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Trial válido até</label>
                <input type="date" value={form.trial_ate} onChange={e => upd('trial_ate', e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Limite de Residentes</label>
                <input type="number" value={form.limite_residentes} onChange={e => upd('limite_residentes', e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Limite de Usuários</label>
                <input type="number" value={form.limite_usuarios} onChange={e => upd('limite_usuarios', e.target.value)} style={S.input} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Observações internas</label>
                <textarea value={form.observacoes} onChange={e => upd('observacoes', e.target.value)} style={S.textarea} placeholder="Notas sobre esse cliente, forma de contrato, etc..." />
              </div>

              <div style={{ gridColumn: '1/-1', borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: '16px', marginTop: '4px' }}>
                <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600, marginBottom: '14px', textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>
                  Administrador (opcional — recebe convite por e-mail)
                </div>
              </div>
              <div>
                <label style={S.label}>Nome do Administrador</label>
                <input value={form.admin_nome} onChange={e => upd('admin_nome', e.target.value)} style={S.input} placeholder="Nome completo" />
              </div>
              <div>
                <label style={S.label}>E-mail do Administrador</label>
                <input value={form.admin_email} onChange={e => upd('admin_email', e.target.value)} style={S.input} placeholder="admin@ilpi.com.br" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={criarEmpresa} disabled={saving} style={{ padding: '10px 28px', background: '#4ade80', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Criando...' : 'Criar Empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editEmpresa && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '24px', color: '#f1f5f9' }}>
              Editar: {editEmpresa.nome}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Nome</label>
                <input value={editEmpresa.nome} onChange={e => setEditEmpresa(p => p ? { ...p, nome: e.target.value } : p)} style={S.input} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>E-mail de Contato</label>
                <input value={editEmpresa.email_contato || ''} onChange={e => setEditEmpresa(p => p ? { ...p, email_contato: e.target.value } : p)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Plano</label>
                <select value={editEmpresa.plano} onChange={e => setEditEmpresa(p => p ? { ...p, plano: e.target.value as PlanoEmpresa } : p)} style={S.select}>
                  <option value="trial">Trial</option>
                  <option value="basico">Básico</option>
                  <option value="profissional">Profissional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Status</label>
                <select value={editEmpresa.status} onChange={e => setEditEmpresa(p => p ? { ...p, status: e.target.value as StatusEmpresa } : p)} style={S.select}>
                  <option value="trial">Trial</option>
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Limite de Residentes</label>
                <input type="number" value={editEmpresa.limite_residentes} onChange={e => setEditEmpresa(p => p ? { ...p, limite_residentes: +e.target.value } : p)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Limite de Usuários</label>
                <input type="number" value={editEmpresa.limite_usuarios} onChange={e => setEditEmpresa(p => p ? { ...p, limite_usuarios: +e.target.value } : p)} style={S.input} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Trial válido até</label>
                <input type="date" value={editEmpresa.trial_ate || ''} onChange={e => setEditEmpresa(p => p ? { ...p, trial_ate: e.target.value } : p)} style={S.input} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Observações internas</label>
                <textarea value={editEmpresa.observacoes || ''} onChange={e => setEditEmpresa(p => p ? { ...p, observacoes: e.target.value } : p)} style={S.textarea} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditEmpresa(null)} style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={saving} style={{ padding: '10px 28px', background: '#60a5fa', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
