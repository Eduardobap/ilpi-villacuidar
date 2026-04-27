-- ============================================================
-- VillaCuidar ILPI — Schema do Banco de Dados
-- Execute no Supabase SQL Editor
-- ============================================================

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'admin', 'enfermeira', 'tecnico', 'cuidador',
  'nutricionista', 'financeiro', 'multidisciplinar'
);

CREATE TYPE posto_enfermagem AS ENUM ('posto_1', 'posto_2', 'posto_3');

CREATE TYPE especialidade_multi AS ENUM (
  'medico', 'fisioterapeuta', 'psicologo',
  'terapeuta_ocupacional', 'assistente_social', 'nutricionista_multi'
);

CREATE TYPE turno AS ENUM ('diurno', 'noturno');

CREATE TYPE status_evolucao AS ENUM ('rascunho', 'pendente', 'assinada', 'editada_enfermeira');

CREATE TYPE status_financeiro AS ENUM ('pendente', 'pago', 'recebido', 'vencido', 'cancelado');

CREATE TYPE tipo_lancamento AS ENUM ('receber', 'pagar');

CREATE TYPE status_residente AS ENUM ('ativo', 'internado', 'falecido', 'alta');

-- ============================================================
-- TABELA: profiles (estende auth.users do Supabase)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  posto posto_enfermagem, -- apenas para cuidador e tecnico
  especialidade especialidade_multi, -- apenas para multidisciplinar
  coren TEXT, -- para enfermeira e tecnico
  active BOOLEAN DEFAULT TRUE,
  pin_hash TEXT, -- PIN para assinatura de evoluções (técnicos)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: residentes
-- ============================================================
CREATE TABLE residentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  cpf TEXT UNIQUE,
  rg TEXT,
  foto_url TEXT,
  quarto TEXT NOT NULL,
  posto posto_enfermagem NOT NULL,
  data_entrada DATE NOT NULL,
  status status_residente DEFAULT 'ativo',
  -- Diagnósticos
  diagnosticos TEXT,
  alergias TEXT,
  observacoes_medicas TEXT,
  -- Dependência
  nivel_dependencia TEXT, -- independente, leve, moderado, total
  -- Responsável
  responsavel_nome TEXT,
  responsavel_parentesco TEXT,
  responsavel_telefone TEXT,
  responsavel_email TEXT,
  -- Plano
  plano_saude TEXT,
  mensalidade DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: evolucoes_diarias
-- ============================================================
CREATE TABLE evolucoes_diarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  residente_id UUID NOT NULL REFERENCES residentes(id),
  data DATE NOT NULL,
  turno turno NOT NULL,
  posto posto_enfermagem NOT NULL,
  -- Sinais vitais
  pressao_arterial TEXT,
  temperatura DECIMAL(4,1),
  saturacao_o2 DECIMAL(5,1),
  frequencia_cardiaca INTEGER,
  frequencia_respiratoria INTEGER,
  glicemia INTEGER,
  peso DECIMAL(5,2),
  -- Avaliações
  condicao_geral TEXT, -- bom, regular, mau
  nivel_consciencia TEXT,
  humor TEXT,
  sono TEXT,
  alimentacao TEXT, -- total, parcial, recusou
  hidratacao TEXT,
  eliminacoes TEXT,
  higiene TEXT,
  posicionamento TEXT,
  -- Texto livre
  evolucao_texto TEXT NOT NULL,
  intercorrencias TEXT,
  pendencias_proximo_turno TEXT,
  medicacoes_administradas TEXT,
  -- Status e assinatura
  status status_evolucao DEFAULT 'rascunho',
  preenchido_por UUID REFERENCES profiles(id),
  assinado_por UUID REFERENCES profiles(id),
  assinado_em TIMESTAMPTZ,
  editado_por UUID REFERENCES profiles(id),
  editado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(residente_id, data, turno)
);

-- ============================================================
-- TABELA: passagens_plantao
-- ============================================================
CREATE TABLE passagens_plantao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data DATE NOT NULL,
  turno turno NOT NULL,
  posto posto_enfermagem,
  texto_gerado TEXT NOT NULL, -- gerado pela IA
  gerado_por UUID REFERENCES profiles(id),
  gerado_em TIMESTAMPTZ DEFAULT NOW(),
  recebido_por UUID REFERENCES profiles(id),
  recebido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: evolucoes_multidisciplinares
-- ============================================================
CREATE TABLE evolucoes_multidisciplinares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  residente_id UUID NOT NULL REFERENCES residentes(id),
  data DATE NOT NULL,
  especialidade especialidade_multi NOT NULL,
  tipo_atendimento TEXT, -- avaliacao, evolucao, interconsulta, alta
  evolucao_texto TEXT NOT NULL,
  conduta TEXT,
  objetivos TEXT,
  proximo_atendimento DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: pai (Plano de Atenção Individual)
-- ============================================================
CREATE TABLE pai (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  residente_id UUID NOT NULL REFERENCES residentes(id),
  data_inicio DATE NOT NULL,
  data_validade DATE NOT NULL,
  diagnosticos TEXT,
  objetivos TEXT,
  metas TEXT,
  intervencoes TEXT,
  responsavel_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: pia (Plano Individual de Atenção)
-- ============================================================
CREATE TABLE pia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  residente_id UUID NOT NULL REFERENCES residentes(id),
  data DATE NOT NULL,
  avaliacao_funcional TEXT,
  aspectos_sociais TEXT,
  atividades_preferidas TEXT,
  plano_vida TEXT,
  preferencias TEXT,
  responsavel_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MÓDULO FINANCEIRO
-- ============================================================

CREATE TABLE categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo tipo_lancamento NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo tipo_lancamento NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status status_financeiro DEFAULT 'pendente',
  categoria_id UUID REFERENCES categorias_financeiras(id),
  residente_id UUID REFERENCES residentes(id), -- se mensalidade
  observacoes TEXT,
  comprovante_url TEXT,
  conciliado BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE extrato_bancario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_lancamento DATE NOT NULL,
  descricao_banco TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL, -- positivo = crédito, negativo = débito
  categoria_ia TEXT,
  lancamento_id UUID REFERENCES lancamentos_financeiros(id),
  status_conciliacao TEXT DEFAULT 'nao_conciliado', -- conciliado, divergencia, nao_conciliado
  importado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MÓDULO COZINHA
-- ============================================================

CREATE TABLE categorias_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL
);

CREATE TABLE itens_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL, -- kg, L, un, cx, etc.
  quantidade_atual DECIMAL(10,3) DEFAULT 0,
  quantidade_minima DECIMAL(10,3) NOT NULL,
  categoria_id UUID REFERENCES categorias_estoque(id),
  fornecedor TEXT,
  custo_unitario DECIMAL(10,2),
  data_ultima_compra DATE,
  data_proxima_compra DATE, -- calculada pela IA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES itens_estoque(id),
  tipo TEXT NOT NULL, -- entrada, saida, ajuste
  quantidade DECIMAL(10,3) NOT NULL,
  motivo TEXT,
  referencia_cardapio_id UUID,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cardapio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data DATE NOT NULL,
  refeicao TEXT NOT NULL, -- cafe, almoco, lanche, jantar
  descricao TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE receitas_ingredientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cardapio_id UUID NOT NULL REFERENCES cardapio(id) ON DELETE CASCADE,
  item_estoque_id UUID NOT NULL REFERENCES itens_estoque(id),
  quantidade_por_pessoa DECIMAL(10,3) NOT NULL,
  numero_porcoes INTEGER NOT NULL DEFAULT 24
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE residentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolucoes_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE passagens_plantao ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolucoes_multidisciplinares ENABLE ROW LEVEL SECURITY;
ALTER TABLE pai ENABLE ROW LEVEL SECURITY;
ALTER TABLE pia ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE extrato_bancario ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardapio ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas_ingredientes ENABLE ROW LEVEL SECURITY;

-- Helper: pegar o role do usuário logado
CREATE OR REPLACE FUNCTION auth_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_posto() RETURNS posto_enfermagem AS $$
  SELECT posto FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_especialidade() RETURNS especialidade_multi AS $$
  SELECT especialidade FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES: usuário vê o próprio; admin vê todos
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid() OR auth_role() = 'admin'
);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth_role() = 'admin');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  id = auth.uid() OR auth_role() = 'admin'
);

-- RESIDENTES: cuidador só vê seu posto; demais veem todos (exceto financeiro)
CREATE POLICY "residentes_select" ON residentes FOR SELECT USING (
  auth_role() IN ('admin', 'enfermeira', 'tecnico', 'multidisciplinar')
  OR (auth_role() = 'cuidador' AND posto = auth_posto())
  OR (auth_role() = 'nutricionista')
);
CREATE POLICY "residentes_insert" ON residentes FOR INSERT WITH CHECK (
  auth_role() IN ('admin', 'enfermeira')
);
CREATE POLICY "residentes_update" ON residentes FOR UPDATE USING (
  auth_role() IN ('admin', 'enfermeira')
);

-- EVOLUÇÕES: cuidador só acessa seu posto; tecnico/enfermeira veem tudo
CREATE POLICY "evolucoes_select" ON evolucoes_diarias FOR SELECT USING (
  auth_role() IN ('admin', 'enfermeira', 'tecnico')
  OR (auth_role() = 'cuidador' AND posto = auth_posto())
);
CREATE POLICY "evolucoes_insert" ON evolucoes_diarias FOR INSERT WITH CHECK (
  auth_role() IN ('admin', 'enfermeira', 'tecnico', 'cuidador')
);
CREATE POLICY "evolucoes_update" ON evolucoes_diarias FOR UPDATE USING (
  auth_role() IN ('admin', 'enfermeira')
  OR (auth_role() = 'tecnico' AND status = 'pendente')
  OR (auth_role() = 'cuidador' AND preenchido_por = auth.uid() AND status = 'rascunho')
);

-- EVOLUCOES MULTI: cada profissional edita só as suas
CREATE POLICY "multi_select" ON evolucoes_multidisciplinares FOR SELECT USING (
  auth_role() IN ('admin', 'enfermeira', 'multidisciplinar')
);
CREATE POLICY "multi_insert" ON evolucoes_multidisciplinares FOR INSERT WITH CHECK (
  auth_role() IN ('admin', 'enfermeira', 'multidisciplinar')
);
CREATE POLICY "multi_update" ON evolucoes_multidisciplinares FOR UPDATE USING (
  auth_role() IN ('admin', 'enfermeira')
  OR (auth_role() = 'multidisciplinar' AND created_by = auth.uid())
);

-- FINANCEIRO: apenas admin e financeiro
CREATE POLICY "financeiro_all" ON lancamentos_financeiros FOR ALL USING (
  auth_role() IN ('admin', 'financeiro')
);
CREATE POLICY "extrato_all" ON extrato_bancario FOR ALL USING (
  auth_role() IN ('admin', 'financeiro')
);

-- COZINHA: nutricionista e admin
CREATE POLICY "estoque_all" ON itens_estoque FOR ALL USING (
  auth_role() IN ('admin', 'nutricionista')
);
CREATE POLICY "cardapio_all" ON cardapio FOR ALL USING (
  auth_role() IN ('admin', 'nutricionista')
);
CREATE POLICY "receitas_all" ON receitas_ingredientes FOR ALL USING (
  auth_role() IN ('admin', 'nutricionista')
);

-- PASSAGEM: cuidador vê do seu posto; demais veem tudo
CREATE POLICY "passagem_select" ON passagens_plantao FOR SELECT USING (
  auth_role() IN ('admin', 'enfermeira', 'tecnico')
  OR (auth_role() = 'cuidador' AND (posto = auth_posto() OR posto IS NULL))
);
CREATE POLICY "passagem_insert" ON passagens_plantao FOR INSERT WITH CHECK (
  auth_role() IN ('admin', 'enfermeira')
);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_residentes_updated BEFORE UPDATE ON residentes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_evolucoes_updated BEFORE UPDATE ON evolucoes_diarias FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_multi_updated BEFORE UPDATE ON evolucoes_multidisciplinares FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lancamentos_updated BEFORE UPDATE ON lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_estoque_updated BEFORE UPDATE ON itens_estoque FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TRIGGER: ao criar usuário no auth, cria profile automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cuidador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
