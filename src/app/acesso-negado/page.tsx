'use client'

export default function AcessoNegadoPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f7f5f0', fontFamily: 'DM Sans, sans-serif', padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '48px 40px', maxWidth: '440px',
        textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)',
      }}>
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔒</div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1814', marginBottom: '10px' }}>
          Acesso Negado
        </div>
        <div style={{ fontSize: '14px', color: '#5c5850', lineHeight: '1.7', marginBottom: '28px' }}>
          Seu dispositivo ou rede <strong>não está autorizado</strong> a acessar o sistema.<br /><br />
          O acesso está configurado para permitir apenas dispositivos homologados pelo administrador.
          Entre em contato com o responsável para regularizar seu acesso.
        </div>
        <a
          href="/login"
          style={{
            display: 'inline-block', padding: '11px 28px', background: '#40916c',
            color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Voltar ao Login
        </a>
      </div>
    </div>
  )
}
