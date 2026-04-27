// ============================================================
// VillaCuidar — Tipos TypeScript
// ============================================================

export type UserRole =
  | 'admin' | 'enfermeira' | 'tecnico' | 'cuidador'
  | 'nutricionista' | 'financeiro' | 'multidisciplinar'

export type PostoEnfermagem = 'posto_1' | 'posto_2' | 'posto_3'

export type EspecialidadeMulti =
  | 'medico' | 'fisioterapeuta' | 'psicologo'
  | 'terapeuta_ocupacional' | 'assistente_social' | 'nutricionista_multi'

export type Turno = 'diurno' | 'noturno'
export type StatusEvolucao = 'rascunho' | 'pendente' | 'assinada' | 'editada_enfermeira'
export type StatusFinanceiro = 'pendente' | 'pago' | 'recebido' | 'vencido' | 'cancelado'
export type TipoLancamento = 'receber' | 'pagar'
export type StatusResidente = 'ativo' | 'internado' | 'falecido' | 'alta'

// ── Profiles ──────────────────────────────────────────────
export interface Profile {
  id: string
  full_name: string
  role: UserRole
  posto?: PostoEnfermagem
  especialidade?: EspecialidadeMulti
  coren?: string
  active: boolean
  created_at: string
  updated_at: string
}

// ── Residentes ────────────────────────────────────────────
export interface Residente {
  id: string
  nome: string
  data_nascimento: string
  cpf?: string
  rg?: string
  foto_url?: string
  quarto: string
  posto: PostoEnfermagem
  data_entrada: string
  status: StatusResidente
  diagnosticos?: string
  alergias?: string
  observacoes_medicas?: string
  nivel_dependencia?: string
  responsavel_nome?: string
  responsavel_parentesco?: string
  responsavel_telefone?: string
  responsavel_email?: string
  plano_saude?: string
  mensalidade?: number
  created_at: string
  updated_at: string
  // computed
  idade?: number
}

// ── Evoluções Diárias ─────────────────────────────────────
export interface EvolucaoDiaria {
  id: string
  residente_id: string
  data: string
  turno: Turno
  posto: PostoEnfermagem
  pressao_arterial?: string
  temperatura?: number
  saturacao_o2?: number
  frequencia_cardiaca?: number
  frequencia_respiratoria?: number
  glicemia?: number
  peso?: number
  condicao_geral?: string
  nivel_consciencia?: string
  humor?: string
  sono?: string
  alimentacao?: string
  hidratacao?: string
  eliminacoes?: string
  higiene?: string
  posicionamento?: string
  evolucao_texto: string
  intercorrencias?: string
  pendencias_proximo_turno?: string
  medicacoes_administradas?: string
  status: StatusEvolucao
  preenchido_por?: string
  assinado_por?: string
  assinado_em?: string
  editado_por?: string
  editado_em?: string
  created_at: string
  updated_at: string
  // joins
  residente?: Residente
  preenchido_por_profile?: Profile
  assinado_por_profile?: Profile
}

// ── Passagem de Plantão ───────────────────────────────────
export interface PassagemPlantao {
  id: string
  data: string
  turno: Turno
  posto?: PostoEnfermagem
  texto_gerado: string
  gerado_por?: string
  gerado_em: string
  recebido_por?: string
  recebido_em?: string
}

// ── Evolução Multidisciplinar ─────────────────────────────
export interface EvolucaoMultidisciplinar {
  id: string
  residente_id: string
  data: string
  especialidade: EspecialidadeMulti
  tipo_atendimento?: string
  evolucao_texto: string
  conduta?: string
  objetivos?: string
  proximo_atendimento?: string
  created_by: string
  updated_by?: string
  created_at: string
  updated_at: string
  residente?: Residente
  created_by_profile?: Profile
}

// ── PAI / PIA ─────────────────────────────────────────────
export interface PAI {
  id: string
  residente_id: string
  data_inicio: string
  data_validade: string
  diagnosticos?: string
  objetivos?: string
  metas?: string
  intervencoes?: string
  responsavel_id?: string
  created_at: string
  updated_at: string
  residente?: Residente
}

export interface PIA {
  id: string
  residente_id: string
  data: string
  avaliacao_funcional?: string
  aspectos_sociais?: string
  atividades_preferidas?: string
  plano_vida?: string
  preferencias?: string
  responsavel_id?: string
  created_at: string
  updated_at: string
  residente?: Residente
}

// ── Financeiro ────────────────────────────────────────────
export interface LancamentoFinanceiro {
  id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: StatusFinanceiro
  categoria_id?: string
  residente_id?: string
  observacoes?: string
  comprovante_url?: string
  conciliado: boolean
  created_by?: string
  created_at: string
  updated_at: string
  residente?: Residente
}

export interface ExtratoBancario {
  id: string
  data_lancamento: string
  descricao_banco: string
  valor: number
  categoria_ia?: string
  lancamento_id?: string
  status_conciliacao: string
  importado_em: string
}

// ── Estoque / Cozinha ─────────────────────────────────────
export interface ItemEstoque {
  id: string
  nome: string
  unidade: string
  quantidade_atual: number
  quantidade_minima: number
  fornecedor?: string
  custo_unitario?: number
  data_ultima_compra?: string
  data_proxima_compra?: string
  created_at: string
  updated_at: string
  // computed
  nivel_percentual?: number
  status_nivel?: 'ok' | 'atencao' | 'critico'
}

export interface Cardapio {
  id: string
  data: string
  refeicao: string
  descricao: string
  created_by?: string
  created_at: string
  ingredientes?: ReceitaIngrediente[]
}

export interface ReceitaIngrediente {
  id: string
  cardapio_id: string
  item_estoque_id: string
  quantidade_por_pessoa: number
  numero_porcoes: number
  item?: ItemEstoque
}

// ── Helpers ───────────────────────────────────────────────
export const POSTO_LABELS: Record<PostoEnfermagem, string> = {
  posto_1: 'Posto 1',
  posto_2: 'Posto 2',
  posto_3: 'Posto 3',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  enfermeira: 'Enfermeira',
  tecnico: 'Técnico de Enfermagem',
  cuidador: 'Cuidador(a)',
  nutricionista: 'Nutricionista',
  financeiro: 'Equipe Financeira',
  multidisciplinar: 'Equipe Multidisciplinar',
}

export const ESPECIALIDADE_LABELS: Record<EspecialidadeMulti, string> = {
  medico: 'Médico(a)',
  fisioterapeuta: 'Fisioterapeuta',
  psicologo: 'Psicólogo(a)',
  terapeuta_ocupacional: 'Terapeuta Ocupacional',
  assistente_social: 'Assistente Social',
  nutricionista_multi: 'Nutricionista',
}

export const TURNO_LABELS: Record<Turno, string> = {
  diurno: '☀️ Diurno (07h – 19h)',
  noturno: '🌙 Noturno (19h – 07h)',
}

// Permissões por role
export const PERMISSIONS = {
  canAccessCuidados: (role: UserRole) =>
    ['admin', 'enfermeira', 'tecnico', 'cuidador'].includes(role),

  canSeeAllPostos: (role: UserRole) =>
    ['admin', 'enfermeira', 'tecnico'].includes(role),

  canSignEvolucao: (role: UserRole) =>
    ['admin', 'enfermeira', 'tecnico'].includes(role),

  canEditSignedEvolucao: (role: UserRole) =>
    ['admin', 'enfermeira'].includes(role),

  canGeneratePassagem: (role: UserRole) =>
    ['admin', 'enfermeira'].includes(role),

  canAccessFinanceiro: (role: UserRole) =>
    ['admin', 'financeiro'].includes(role),

  canAccessCozinha: (role: UserRole) =>
    ['admin', 'nutricionista'].includes(role),

  canAccessMultidisciplinar: (role: UserRole) =>
    ['admin', 'enfermeira', 'multidisciplinar'].includes(role),

  canManageUsers: (role: UserRole) =>
    role === 'admin',

  canAccessPAIPIA: (role: UserRole) =>
    ['admin', 'enfermeira'].includes(role),
}
