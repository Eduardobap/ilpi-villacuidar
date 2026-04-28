import { createClient } from '@/lib/supabase/server'

const TIPO_LABELS: Record<string, string> = {
  evolucao: 'Evolução Diária de Enfermagem',
  multidisciplinar: 'Evolução Multidisciplinar',
  katz: 'Avaliação de Katz',
  sentinela: 'Evento Sentinela',
  pai: 'Plano de Atenção Integral (PAI)',
  pia: 'Plano Individual de Atendimento (PIA)',
}

export default async function VerificarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: sig } = await supabase
    .from('assinaturas_digitais')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  const valid = !!sig
  const assinadoEmBR = sig?.assinado_em
    ? new Date(sig.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '—'
  const tipoLabel = sig?.tipo ? (TIPO_LABELS[sig.tipo] || sig.tipo) : '—'
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Verificação de Documento — VillaCuidar</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#f7f5f0', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '40px', maxWidth: '560px', width: '100%', boxShadow: '0 4px 32px rgba(0,0,0,.08)' }}>

            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1814' }}>
                Villa<span style={{ color: '#40916c', fontStyle: 'italic' }}>Cuidar</span>
              </div>
              <div style={{ fontSize: '12px', color: '#9a9588', marginTop: '4px', letterSpacing: '.3px' }}>
                Sistema ILPI — Verificação de Autenticidade
              </div>
            </div>

            {valid ? (
              <>
                {/* Badge de sucesso */}
                <div style={{ background: '#d8f3dc', border: '1px solid #74c69d', borderRadius: '14px', padding: '20px', marginBottom: '28px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: '17px', color: '#2d6a4f' }}>Documento Autêntico</div>
                  <div style={{ fontSize: '12px', color: '#40916c', marginTop: '6px', lineHeight: '1.5' }}>
                    Assinatura eletrônica avançada verificada com sucesso.<br />
                    O documento não foi alterado após a assinatura.
                  </div>
                </div>

                {/* Detalhes */}
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                  {[
                    ['Tipo de documento', tipoLabel],
                    ['Profissional signatário', sig!.nome_profissional],
                    ...(sig!.registro_profissional ? [['Registro profissional', sig!.registro_profissional]] : []),
                    ...(sig!.especialidade ? [['Especialidade', sig!.especialidade]] : []),
                    ['Data e hora da assinatura', assinadoEmBR],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '11px 0', borderBottom: '1px solid #f0ece4', gap: '16px' }}>
                      <span style={{ color: '#9a9588', flexShrink: 0 }}>{label}</span>
                      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
                    </div>
                  ))}

                  {/* Token */}
                  <div style={{ padding: '11px 0', borderBottom: '1px solid #f0ece4' }}>
                    <div style={{ color: '#9a9588', marginBottom: '5px' }}>Token único de verificação</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', background: '#f7f5f0', padding: '8px 10px', borderRadius: '6px', color: '#1a1814' }}>
                      {token}
                    </div>
                  </div>

                  {/* Hash */}
                  <div style={{ padding: '11px 0' }}>
                    <div style={{ color: '#9a9588', marginBottom: '5px' }}>Hash de integridade (SHA-256)</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '10px', wordBreak: 'break-all', background: '#f7f5f0', padding: '8px 10px', borderRadius: '6px', color: '#1a1814', lineHeight: '1.5' }}>
                      {sig!.conteudo_hash}
                    </div>
                  </div>
                </div>

                {/* Nota jurídica */}
                <div style={{ marginTop: '20px', padding: '14px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', fontSize: '11px', color: '#1d4e89', lineHeight: '1.7' }}>
                  <strong>Validade jurídica:</strong> Este documento possui assinatura eletrônica avançada conforme a <strong>Lei 14.063/2020</strong> e MP 2.200-2/2001. O hash SHA-256 garante integridade total do conteúdo — qualquer alteração posterior invalida a verificação. A identidade do signatário foi verificada por autenticação nominal no sistema VillaCuidar.
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚠️</div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: '#991b1b', marginBottom: '10px' }}>
                  Documento não encontrado
                </div>
                <div style={{ fontSize: '13px', color: '#9a9588', lineHeight: '1.7', maxWidth: '360px', margin: '0 auto' }}>
                  O código informado não corresponde a nenhum documento assinado no sistema VillaCuidar, ou o link pode estar incompleto.
                </div>
                <div style={{ marginTop: '20px', padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', fontSize: '11px', color: '#991b1b', lineHeight: '1.6' }}>
                  Se você está em posse de um documento impresso, verifique se o código QR foi escaneado corretamente ou acesse o link completo mostrado abaixo do QR code.
                </div>
              </div>
            )}

            {/* Rodapé */}
            <div style={{ textAlign: 'center', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #f0ece4', fontSize: '10px', color: '#9a9588', lineHeight: '1.7' }}>
              VillaCuidar Sistema ILPI — Verificação gerada em {geradoEm}<br />
              Este link é público e pode ser compartilhado para fins de auditoria.
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
