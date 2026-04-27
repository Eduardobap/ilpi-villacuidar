-- ============================================================
-- 003_configuracoes.sql — Execute após o schema principal
-- ============================================================

CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY DEFAULT 1,
  assinatura_modo TEXT NOT NULL DEFAULT 'click'
    CHECK (assinatura_modo IN ('pin','click','admin')),
  ilpi_nome TEXT DEFAULT 'VillaCuidar',
  ilpi_cnpj TEXT,
  ilpi_endereco TEXT,
  ilpi_telefone TEXT,
  ilpi_responsavel_tecnico TEXT,
  ilpi_coren_rt TEXT,
  numero_residentes_maximo INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro inicial
INSERT INTO configuracoes (id, assinatura_modo, numero_residentes_maximo)
VALUES (1, 'click', 60)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_select" ON configuracoes FOR SELECT USING (
  auth_role() IN ('admin','enfermeira','tecnico','cuidador','nutricionista','financeiro','multidisciplinar')
);
CREATE POLICY "config_update" ON configuracoes FOR UPDATE USING (auth_role() = 'admin');
CREATE POLICY "config_insert" ON configuracoes FOR INSERT WITH CHECK (auth_role() = 'admin');
