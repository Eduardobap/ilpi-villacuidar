'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserRole, PostoEnfermagem, ROLE_LABELS, POSTO_LABELS } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  btn: (c='#40916c') => ({ padding:'9px 18px', background:c, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:500 as const, cursor:'pointer', fontFamily:'inherit' }),
  btnSec: { padding:'8px 14px', background:'#f7f5f0', color:'#1a1814', border:'1px solid #e0dbd0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' },
  label: { display:'block' as const, fontSize:'12px', fontWeight:500 as const, color:'#5c5850', marginBottom:'5px' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #ccc8bc', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', boxSizing:'border-box' as const },
  tag: (c: string) => {
    const m: Record<string,{bg:string;color:string}> = {
      admin:{bg:'#fee2e2',color:'#991b1b'}, enfermeira:{bg:'#dbeafe',color:'#1d4e89'},
      tecnico:{bg:'#ede9fe',color:'#5b21b6'}, cuidador:{bg:'#d8f3dc',color:'#2d6a4f'},
      nutricionista:{bg:'#fef3c7',color:'#92400e'}, financeiro:{bg:'#ccfbf1',color:'#134e4a'},
      multidisciplinar:{bg:'#f1efe8',color:'#5f5e5a'}
    }
    const t = m[c] || {bg:'#f1efe8',color:'#5f5e5a'}
    return { display:'inline-flex' as const, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500 as const, background:t.bg, color:t.color }
  }
}

const FORM_EMPTY = { full_name:'', email:'', role:'cuidador' as UserRole, posto:'' as any }

export default function UsuariosPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [form, setForm] = useState({ ...FORM_EMPTY })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [configAssinatura, setConfigAssinatura] = useState<'pin'|'click'|'admin'>('click')
  const [showConfig, setShowConfig] = useState(false)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    const { data: cfg } = await supabase.from('configuracoes').select('assinatura_modo').single()
    if (cfg) setConfigAssinatura(cfg.assinatura_modo)
  }

  useEffect(() => { load() }, [])

  const upd = (k: string, v: string) => setForm(f => ({...f,[k]:v}))

  async function criarUsuario() {
    if (!form.full_name || !form.email || !form.role) {
      setMsg('Preencha nome, e-mail e perfil.'); return
    }
    setSaving(true)
    const res = await fetch('/api/usuarios', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form)
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('Erro: ' + json.error); return }
    setMsg('Convite enviado! O funcionário receberá um e-mail para definir a senha.')
    setForm({...FORM_EMPTY})
    setShowForm(false)
    load()
    setTimeout(() => setMsg(''), 5000)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('profiles').update({ active: !ativo }).eq('id', id)
    load()
  }

  async function salvarConfig() {
    await supabase.from('configuracoes').upsert({ id: 1, assinatura_modo: configAssinatura })
    setMsg('Configuração salva!')
    setShowConfig(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const needsPosto = ['cuidador','tecnico'].includes(form.role)

  return (
    <div>
      {msg && (
        <div style={{background: msg.includes('Erro') ? '#fee2e2':'#d8f3dc', color: msg.includes('Erro')?'#991b1b':'#2d6a4f', padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', fontSize:'13px'}}>{msg}</div>
      )}

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <div style={{fontSize:'14px', fontWeight:600}}>Gerenciar Usuários ({users.length} cadastrados)</div>
        <div style={{display:'flex', gap:'10px'}}>
          <button onClick={() => setShowConfig(s => !s)} style={S.btnSec}>⚙ Configurações de Assinatura</button>
          <button onClick={() => setShowForm(s => !s)} style={S.btn()}>+ Novo Usuário</button>
        </div>
      </div>

      {/* Config assinatura */}
      {showConfig && (
        <div style={{...S.card, marginBottom:'16px', background:'#fef3c7', border:'1px solid #fde68a'}}>
          <div style={{fontWeight:600, fontSize:'13px', marginBottom:'12px', color:'#92400e'}}>⚙ Modo de Assinatura do Técnico de Enfermagem</div>
          {[
            ['click','Clique simples — basta clicar em "Assinar"'],
            ['pin','PIN obrigatório — técnico digita um PIN de 4-8 dígitos'],
            ['admin','Somente admin/enfermeira podem assinar'],
          ].map(([v,l]) => (
            <label key={v} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', fontSize:'13px', cursor:'pointer'}}>
              <input type="radio" name="assinatura" value={v} checked={configAssinatura===v} onChange={() => setConfigAssinatura(v as any)}/>
              {l}
            </label>
          ))}
          <div style={{marginTop:'12px', display:'flex', gap:'8px'}}>
            <button onClick={salvarConfig} style={S.btn('#92400e')}>Salvar</button>
            <button onClick={() => setShowConfig(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Form novo usuário */}
      {showForm && (
        <div style={{...S.card, marginBottom:'16px'}}>
          <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid #e0dbd0'}}>Novo Usuário</div>
          <div style={{background:'#f7f5f0', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px', fontSize:'12px', color:'#5c5850', lineHeight:'1.6'}}>
            Um e-mail de convite será enviado ao funcionário. Ele definirá a própria senha e, se necessário, informará o número do conselho profissional.
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px'}}>
            <div style={{gridColumn:'span 2'}}>
              <label style={S.label}>Nome Completo *</label>
              <input value={form.full_name} onChange={e=>upd('full_name',e.target.value)} style={S.input} placeholder="Nome do profissional"/>
            </div>
            <div style={{gridColumn:'span 2'}}>
              <label style={S.label}>E-mail *</label>
              <input type="email" value={form.email} onChange={e=>upd('email',e.target.value)} style={S.input} placeholder="email@funcionario.com"/>
            </div>
            <div>
              <label style={S.label}>Perfil *</label>
              <select value={form.role} onChange={e=>upd('role',e.target.value)} style={S.select}>
                {(Object.entries(ROLE_LABELS) as [UserRole,string][]).map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            {needsPosto && (
              <div>
                <label style={S.label}>Posto de enfermagem *</label>
                <select value={form.posto} onChange={e=>upd('posto',e.target.value)} style={S.select}>
                  <option value="">Selecione...</option>
                  <option value="posto_1">Posto 1</option>
                  <option value="posto_2">Posto 2</option>
                  <option value="posto_3">Posto 3</option>
                </select>
              </div>
            )}
          </div>
          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={criarUsuario} disabled={saving} style={S.btn()}>
              {saving ? 'Enviando...' : '✉️ Enviar Convite'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({...FORM_EMPTY}) }} style={S.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista de usuários */}
      <div style={S.card}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#f7f5f0'}}>
              {['Nome','Perfil','Posto / Especialidade','COREN','Status','Ação'].map(h => (
                <th key={h} style={{padding:'10px 14px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#5c5850', textTransform:'uppercase' as const}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{borderBottom:'1px solid #e0dbd0', opacity: u.active ? 1 : .5}}>
                <td style={{padding:'12px 14px', fontWeight:500}}>{u.full_name}</td>
                <td style={{padding:'12px 14px'}}><span style={S.tag(u.role)}>{ROLE_LABELS[u.role]}</span></td>
                <td style={{padding:'12px 14px', fontSize:'12px', color:'#5c5850'}}>
                  {u.posto ? POSTO_LABELS[u.posto] : ''}
                  {u.especialidade ? ESPECIALIDADE_LABELS[u.especialidade] : ''}
                  {!u.posto && !u.especialidade ? '—' : ''}
                </td>
                <td style={{padding:'12px 14px', fontSize:'12px', color:'#5c5850'}}>{u.coren || '—'}</td>
                <td style={{padding:'12px 14px'}}>
                  <span style={{display:'inline-flex', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background: u.active ? '#d8f3dc' : '#fee2e2', color: u.active ? '#2d6a4f' : '#991b1b'}}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{padding:'12px 14px'}}>
                  <div style={{display:'flex', gap:'6px'}}>
                    <button onClick={() => toggleAtivo(u.id, u.active)} style={{...S.btnSec, fontSize:'12px', padding:'5px 10px'}}>
                      {u.active ? 'Desativar' : 'Reativar'}
                    </button>
                    <button style={{...S.btnSec, fontSize:'12px', padding:'5px 10px'}}>Editar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
