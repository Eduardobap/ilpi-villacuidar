'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/dashboard/layout'
import { useRouter } from 'next/navigation'
import { PERMISSIONS } from '@/types'

const S = {
  card: { background:'#fff', border:'1px solid #e0dbd0', borderRadius:'16px', padding:'20px' },
  metric: (color: string) => {
    const c: Record<string,{bg:string,val:string}> = {
      green:{bg:'#d8f3dc',val:'#2d6a4f'}, blue:{bg:'#dbeafe',val:'#1d4e89'},
      red:{bg:'#fee2e2',val:'#991b1b'}, amber:{bg:'#fef3c7',val:'#92400e'},
      purple:{bg:'#ede9fe',val:'#5b21b6'}, teal:{bg:'#ccfbf1',val:'#134e4a'},
    }
    return c[color] || c.green
  }
}

interface DashMetrics {
  residentes_ativos: number
  evolucoes_pendentes: number
  evolucoes_hoje: number
  a_receber_hoje: number
  a_pagar_hoje: number
  estoque_critico: number
  passagens_hoje: number
  vencidos: number
}

interface Alerta { tipo: string; msg: string; cor: string }

export default function DashboardPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [metrics, setMetrics] = useState<DashMetrics | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const hoje = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!profile) return
    loadDash()
  }, [profile])

  async function loadDash() {
    setLoading(true)
    const m: DashMetrics = {
      residentes_ativos:0, evolucoes_pendentes:0, evolucoes_hoje:0,
      a_receber_hoje:0, a_pagar_hoje:0, estoque_critico:0,
      passagens_hoje:0, vencidos:0,
    }
    const alerts: Alerta[] = []

    // Residentes
    if (PERMISSIONS.canAccessCuidados(profile!.role)) {
      let q = supabase.from('residentes').select('id', {count:'exact'}).eq('status','ativo')
      if (profile?.role === 'cuidador' && profile.posto) q = q.eq('posto', profile.posto)
      const { count } = await q
      m.residentes_ativos = count || 0

      let qEv = supabase.from('evolucoes_diarias').select('id,status', {count:'exact'}).eq('data', hoje)
      if (profile?.role === 'cuidador' && profile.posto) qEv = qEv.eq('posto', profile.posto)
      const { data: evs } = await qEv
      m.evolucoes_hoje = evs?.length || 0
      m.evolucoes_pendentes = evs?.filter(e => e.status === 'pendente').length || 0

      if (m.evolucoes_pendentes > 0)
        alerts.push({ tipo:'warning', msg:`${m.evolucoes_pendentes} evolução(ões) aguardando assinatura`, cor:'amber' })

      // Passagens
      const { count: passCount } = await supabase.from('passagens_plantao').select('id',{count:'exact'}).eq('data',hoje)
      m.passagens_hoje = passCount || 0
    }

    // Financeiro
    if (PERMISSIONS.canAccessFinanceiro(profile!.role)) {
      const { data: recHoje } = await supabase.from('lancamentos_financeiros')
        .select('valor').eq('data_vencimento', hoje).eq('tipo','receber').eq('status','pendente')
      m.a_receber_hoje = recHoje?.reduce((s,r)=>s+r.valor,0) || 0

      const { data: pagHoje } = await supabase.from('lancamentos_financeiros')
        .select('valor').eq('data_vencimento', hoje).eq('tipo','pagar').eq('status','pendente')
      m.a_pagar_hoje = pagHoje?.reduce((s,r)=>s+r.valor,0) || 0

      const { data: venc } = await supabase.from('lancamentos_financeiros')
        .select('id',{count:'exact'}).lt('data_vencimento', hoje).eq('status','pendente')
      m.vencidos = venc?.length || 0
      if (m.vencidos > 0)
        alerts.push({ tipo:'danger', msg:`${m.vencidos} título(s) vencido(s) sem baixa`, cor:'red' })
    }

    // Estoque
    if (PERMISSIONS.canAccessCozinha(profile!.role)) {
      const { data: estoq } = await supabase.from('itens_estoque').select('quantidade_atual,quantidade_minima')
      const criticos = estoq?.filter(i => i.quantidade_atual <= i.quantidade_minima * 0.2).length || 0
      const atencao = estoq?.filter(i => i.quantidade_atual <= i.quantidade_minima && i.quantidade_atual > i.quantidade_minima * 0.2).length || 0
      m.estoque_critico = criticos
      if (criticos > 0)
        alerts.push({ tipo:'danger', msg:`${criticos} item(ns) com estoque crítico`, cor:'red' })
      if (atencao > 0)
        alerts.push({ tipo:'warning', msg:`${atencao} item(ns) com estoque em atenção`, cor:'amber' })
    }

    setMetrics(m)
    setAlertas(alerts)
    setLoading(false)
  }

  if (loading) return <div style={{color:'#9a9588',padding:'40px',textAlign:'center'}}>Carregando dashboard...</div>

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div>
      {/* Saudação */}
      <div style={{marginBottom:'24px'}}>
        <div style={{fontSize:'22px', fontWeight:600, color:'#1a1814'}}>
          {saudacao}, {profile?.full_name.split(' ')[0]}! 👋
        </div>
        <div style={{fontSize:'13px', color:'#9a9588', marginTop:'4px'}}>
          {new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px'}}>
          {alertas.map((a, i) => (
            <div key={i} style={{
              padding:'12px 16px', borderRadius:'10px', fontSize:'13px', display:'flex', alignItems:'center', gap:'10px',
              background: a.cor==='red' ? '#fee2e2' : a.cor==='amber' ? '#fef3c7' : '#d8f3dc',
              border: `1px solid ${a.cor==='red' ? '#fecaca' : a.cor==='amber' ? '#fde68a' : '#b7e4c7'}`,
              color: a.cor==='red' ? '#991b1b' : a.cor==='amber' ? '#92400e' : '#2d6a4f',
            }}>
              <span>{a.cor==='red' ? '🔴' : '⚠️'}</span>
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Metrics grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'12px', marginBottom:'24px'}}>
        {PERMISSIONS.canAccessCuidados(profile!.role) && (<>
          <MetricCard label="Residentes Ativos" value={metrics?.residentes_ativos} color="green" icon="👥" onClick={() => router.push('/dashboard/residentes')}/>
          <MetricCard label="Evoluções Hoje" value={metrics?.evolucoes_hoje} color="blue" icon="📋" onClick={() => router.push('/dashboard/cuidados/evolucoes')}/>
          <MetricCard label="Aguard. Assinatura" value={metrics?.evolucoes_pendentes} color={metrics?.evolucoes_pendentes ? 'amber' : 'green'} icon="✍" onClick={() => router.push('/dashboard/cuidados/evolucoes')}/>
          <MetricCard label="Passagens Hoje" value={metrics?.passagens_hoje} color="purple" icon="🔄" onClick={() => router.push('/dashboard/cuidados/passagem')}/>
        </>)}
        {PERMISSIONS.canAccessFinanceiro(profile!.role) && (<>
          <MetricCard label="A Receber Hoje" value={`R$ ${(metrics?.a_receber_hoje||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`} color="green" icon="💰" onClick={() => router.push('/dashboard/financeiro')}/>
          <MetricCard label="A Pagar Hoje" value={`R$ ${(metrics?.a_pagar_hoje||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`} color="red" icon="💸" onClick={() => router.push('/dashboard/financeiro')}/>
          <MetricCard label="Títulos Vencidos" value={metrics?.vencidos} color={metrics?.vencidos ? 'red' : 'green'} icon="⏰" onClick={() => router.push('/dashboard/financeiro')}/>
        </>)}
        {PERMISSIONS.canAccessCozinha(profile!.role) && (
          <MetricCard label="Estoque Crítico" value={metrics?.estoque_critico} color={metrics?.estoque_critico ? 'red' : 'green'} icon="📦" onClick={() => router.push('/dashboard/cozinha/estoque')}/>
        )}
      </div>

      {/* Atalhos */}
      <div style={S.card}>
        <div style={{fontWeight:600, fontSize:'14px', marginBottom:'16px'}}>Acesso Rápido</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
          {PERMISSIONS.canAccessCuidados(profile!.role) && (<>
            <AtalhoBtn label="Nova Evolução" icon="✏️" onClick={() => router.push('/dashboard/cuidados/evolucoes')} color="#40916c"/>
            <AtalhoBtn label="Passagem de Plantão" icon="🔄" onClick={() => router.push('/dashboard/cuidados/passagem')} color="#1d4e89"/>
          </>)}
          {profile?.role !== 'cuidador' && PERMISSIONS.canAccessCuidados(profile!.role) && (
            <AtalhoBtn label="Residentes" icon="👥" onClick={() => router.push('/dashboard/residentes')} color="#5b21b6"/>
          )}
          {PERMISSIONS.canAccessMultidisciplinar(profile!.role) && (
            <AtalhoBtn label="Multidisciplinar" icon="🛡" onClick={() => router.push('/dashboard/multidisciplinar')} color="#134e4a"/>
          )}
          {PERMISSIONS.canAccessPAIPIA(profile!.role) && (
            <AtalhoBtn label="PAI / PIA" icon="📄" onClick={() => router.push('/dashboard/relatorios')} color="#92400e"/>
          )}
          {PERMISSIONS.canAccessFinanceiro(profile!.role) && (
            <AtalhoBtn label="Financeiro" icon="💰" onClick={() => router.push('/dashboard/financeiro')} color="#2d6a4f"/>
          )}
          {PERMISSIONS.canAccessCozinha(profile!.role) && (<>
            <AtalhoBtn label="Cardápio" icon="🍽" onClick={() => router.push('/dashboard/cozinha/cardapio')} color="#92400e"/>
            <AtalhoBtn label="Estoque" icon="📦" onClick={() => router.push('/dashboard/cozinha/estoque')} color="#5f5e5a"/>
          </>)}
          {PERMISSIONS.canManageUsers(profile!.role) && (
            <AtalhoBtn label="Usuários" icon="👤" onClick={() => router.push('/dashboard/usuarios')} color="#1d4e89"/>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color, icon, onClick }: { label:string; value:any; color:string; icon:string; onClick?:()=>void }) {
  const c = { green:{bg:'#d8f3dc',val:'#2d6a4f'}, blue:{bg:'#dbeafe',val:'#1d4e89'}, red:{bg:'#fee2e2',val:'#991b1b'}, amber:{bg:'#fef3c7',val:'#92400e'}, purple:{bg:'#ede9fe',val:'#5b21b6'}, teal:{bg:'#ccfbf1',val:'#134e4a'} } as any
  const col = c[color] || c.green
  return (
    <div onClick={onClick} style={{
      background:'#fff', border:`1px solid #e0dbd0`, borderRadius:'12px', padding:'16px',
      cursor: onClick ? 'pointer' : 'default',
      transition:'all .15s',
    }}
    onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.borderColor = col.val)}
    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = '#e0dbd0')}
    >
      <div style={{fontSize:'20px', marginBottom:'8px'}}>{icon}</div>
      <div style={{fontSize:'11px', color:'#9a9588', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'4px'}}>{label}</div>
      <div style={{fontSize:'22px', fontWeight:600, color: col.val}}>{value ?? '—'}</div>
    </div>
  )
}

function AtalhoBtn({ label, icon, onClick, color }: { label:string; icon:string; onClick:()=>void; color:string }) {
  return (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:'8px',
      padding:'10px 16px', background:`${color}15`, color,
      border:`1px solid ${color}30`, borderRadius:'10px',
      fontSize:'13px', fontWeight:500, cursor:'pointer', fontFamily:'inherit',
      transition:'all .15s'
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}25` }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}15` }}
    >
      <span>{icon}</span> {label}
    </button>
  )
}
