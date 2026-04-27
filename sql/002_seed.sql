-- ============================================================
-- VillaCuidar — Dados Iniciais (Seed)
-- Execute APÓS o schema (001_schema.sql)
-- ============================================================

-- Categorias financeiras padrão
INSERT INTO categorias_financeiras (nome, tipo) VALUES
  ('Mensalidade', 'receber'),
  ('Convênio', 'receber'),
  ('Outros', 'receber'),
  ('Fornecedor Medicamentos', 'pagar'),
  ('Fornecedor Fraldas', 'pagar'),
  ('Fornecedor Alimentação', 'pagar'),
  ('Folha de Pagamento', 'pagar'),
  ('Energia Elétrica', 'pagar'),
  ('Água e Esgoto', 'pagar'),
  ('Internet e Telefone', 'pagar'),
  ('Manutenção', 'pagar'),
  ('Equipamentos', 'pagar'),
  ('Outros Despesas', 'pagar');

-- Categorias de estoque
INSERT INTO categorias_estoque (nome) VALUES
  ('Carnes e Proteínas'),
  ('Grãos e Cereais'),
  ('Laticínios'),
  ('Frutas e Verduras'),
  ('Óleos e Temperos'),
  ('Produtos de Higiene'),
  ('Medicamentos e Insumos'),
  ('Limpeza');

-- ============================================================
-- ADMIN INICIAL
-- Para criar o admin: no Supabase → Authentication → Users
-- Crie o usuário com email: admin@ilpi.com, senha: Admin@2026
-- Depois execute este UPDATE após a criação:
-- ============================================================

-- UPDATE profiles SET role = 'admin', full_name = 'Administrador'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@ilpi.com');

-- ============================================================
-- RESIDENTE DE EXEMPLO
-- ============================================================
INSERT INTO residentes (
  nome, data_nascimento, quarto, posto, data_entrada,
  diagnosticos, responsavel_nome, responsavel_telefone, mensalidade, nivel_dependencia
) VALUES
  ('Maria José da Silva', '1942-03-15', '101', 'posto_1', '2024-01-10',
   'HAS, Demência leve, Osteoporose', 'Ana Paula Silva', '(21) 99999-0001', 2800.00, 'moderado'),
  ('José Carlos Pereira', '1947-06-22', '102', 'posto_1', '2023-08-05',
   'DM tipo 2, Parkinson estágio inicial', 'Cláudia Pereira', '(21) 99999-0002', 3200.00, 'leve'),
  ('Ana Lima Santos', '1950-11-08', '103', 'posto_1', '2024-03-20',
   'Osteoporose, Depressão, Hipertireoidismo', 'Marcos Santos', '(21) 99999-0003', 2400.00, 'leve'),
  ('Roberto Souza', '1945-07-30', '104', 'posto_1', '2022-11-15',
   'ICC, HAS, Gota', 'Fernanda Souza', '(21) 99999-0004', 3500.00, 'moderado'),
  ('Luzia Ferreira', '1938-04-05', '111', 'posto_2', '2023-05-12',
   'Alzheimer moderado, HAS', 'Carlos Ferreira', '(21) 99999-0005', 4200.00, 'total'),
  ('Antônio Costa', '1943-09-18', '112', 'posto_2', '2024-02-01',
   'DPOC, Tabagismo prévio', 'Rita Costa', '(21) 99999-0006', 2900.00, 'moderado');

-- Itens de estoque iniciais
INSERT INTO itens_estoque (nome, unidade, quantidade_atual, quantidade_minima, fornecedor) VALUES
  ('Arroz', 'kg', 25, 20, 'Distribuidora RS'),
  ('Feijão', 'kg', 18, 10, 'Distribuidora RS'),
  ('Carne Bovina', 'kg', 4, 10, 'Frigorífico Bom Gosto'),
  ('Frango', 'kg', 12, 8, 'Frigorífico Bom Gosto'),
  ('Peixe', 'kg', 6, 5, 'Peixaria Central'),
  ('Óleo de Soja', 'L', 3, 8, 'Distribuidora RS'),
  ('Leite Integral', 'L', 30, 20, 'Laticínios Norte'),
  ('Ovos', 'dúzia', 8, 5, 'Granja Feliz'),
  ('Pão Francês', 'kg', 3, 2, 'Padaria Local'),
  ('Banana', 'kg', 10, 8, 'Hortifruti Central'),
  ('Maçã', 'kg', 6, 5, 'Hortifruti Central'),
  ('Tomate', 'kg', 4, 3, 'Hortifruti Central'),
  ('Fraldas Adulto G2', 'unidade', 12, 40, 'MedCare Distribuidora'),
  ('Fraldas Adulto G3', 'unidade', 24, 40, 'MedCare Distribuidora'),
  ('Luvas Descartáveis P', 'caixa', 5, 4, 'MedCare Distribuidora'),
  ('Luvas Descartáveis M', 'caixa', 3, 4, 'MedCare Distribuidora'),
  ('Álcool 70%', 'L', 8, 5, 'MedCare Distribuidora'),
  ('Sabonete Líquido', 'L', 4, 3, 'Higienize'),
  ('Papel Higiênico', 'rolo', 48, 40, 'Higienize'),
  ('Detergente', 'L', 6, 4, 'Higienize');
