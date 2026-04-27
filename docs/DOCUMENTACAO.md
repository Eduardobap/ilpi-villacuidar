# VillaCuidar — Sistema ILPI
## Documentação Completa do Sistema

---

## 1. VISÃO GERAL

Sistema web completo para gestão de Instituições de Longa Permanência para Idosos (ILPI), hospedado em nuvem gratuita com:

- **Frontend:** Next.js 14 (React) — hospedado na Vercel (grátis)
- **Backend/Banco:** Supabase (PostgreSQL + Auth + Storage) — grátis até 500MB
- **IA:** Anthropic Claude API para geração de relatórios
- **URL final:** `https://seu-nome.vercel.app`

---

## 2. PERFIS DE ACESSO (ROLES)

| Perfil | Código | Acesso |
|---|---|---|
| Administrador | `admin` | Sistema completo |
| Enfermeira | `enfermeira` | Módulo Cuidados completo (todos os postos) |
| Técnico de Enfermagem | `tecnico` | Módulo Cuidados — conferir e assinar evoluções |
| Cuidador | `cuidador` | Preencher evoluções do seu posto + ver passagens |
| Nutricionista | `nutricionista` | Módulo Cozinha completo |
| Equipe Financeira | `financeiro` | Módulo Financeiro completo |
| Multidisciplinar | `multidisciplinar` | Ver histórico de todos + editar apenas suas evoluções |

### Sub-perfis Multidisciplinar
- Médico(a)
- Fisioterapeuta
- Psicólogo(a)
- Terapeuta Ocupacional
- Assistente Social

### Postos de Enfermagem
- **Posto 1** — Quartos 101–110
- **Posto 2** — Quartos 111–120
- **Posto 3** — Quartos 121–130

---

## 3. MATRIZ DE PERMISSÕES DETALHADA

### Módulo Cuidados

| Funcionalidade | Admin | Enfermeira | Técnico | Cuidador |
|---|:---:|:---:|:---:|:---:|
| Ver evoluções (todos os postos) | ✅ | ✅ | ✅ | ❌ |
| Ver evoluções (seu posto) | ✅ | ✅ | ✅ | ✅ |
| Preencher evolução diária | ✅ | ✅ | ✅ | ✅ |
| Editar evolução (antes de assinar) | ✅ | ✅ | ✅ | ✅ (própria) |
| Editar evolução (após assinar técnico) | ✅ | ✅ | ❌ | ❌ |
| Assinar evolução | ✅ | ✅ | ✅ | ❌ |
| Ver passagem de plantão | ✅ | ✅ | ✅ | ✅ (seu posto) |
| Gerar passagem automática (IA) | ✅ | ✅ | ❌ | ❌ |
| Cadastrar residente | ✅ | ✅ | ❌ | ❌ |
| PAI / PIA | ✅ | ✅ | ❌ | ❌ |

### Módulo Multidisciplinar

| Funcionalidade | Admin | Enfermeira | Multidisciplinar |
|---|:---:|:---:|:---:|
| Ver histórico completo do residente | ✅ | ✅ | ✅ |
| Criar evolução da sua área | ✅ | ✅ | ✅ |
| Editar evolução da sua área | ✅ | ✅ | ✅ (só as próprias) |
| Editar evolução de outra área | ✅ | ✅ | ❌ |

### Módulo Financeiro

| Funcionalidade | Admin | Financeiro |
|---|:---:|:---:|
| Ver contas | ✅ | ✅ |
| Criar/Editar lançamentos | ✅ | ✅ |
| Importar extrato | ✅ | ✅ |
| Relatórios financeiros | ✅ | ✅ |

### Módulo Cozinha

| Funcionalidade | Admin | Nutricionista |
|---|:---:|:---:|
| Cardápio semanal | ✅ | ✅ |
| Gestão de estoque | ✅ | ✅ |
| Alertas de compra | ✅ | ✅ |

---

## 4. ESTRUTURA DO BANCO DE DADOS (SQL)

Ver arquivo: `sql/001_schema.sql`

---

## 5. GUIA DE INSTALAÇÃO

### Pré-requisitos
- Conta gratuita em: supabase.com
- Conta gratuita em: vercel.com
- Node.js 18+ instalado no seu computador (para deploy inicial)

### Passo a Passo

#### 5.1 Configurar Supabase
1. Acesse supabase.com → New Project
2. Dê o nome: `ilpi-villacuidar`
3. Escolha uma senha forte para o banco
4. Região: South America (São Paulo)
5. Aguarde criar (~2 minutos)
6. Vá em: SQL Editor → New Query
7. Cole o conteúdo de `sql/001_schema.sql` e execute
8. Após executar, cole `sql/002_seed.sql` (dados iniciais)
9. Vá em: Settings → API e copie:
   - `Project URL` → será sua `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → será sua `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → será sua `SUPABASE_SERVICE_ROLE_KEY`

#### 5.2 Deploy na Vercel
1. Acesse vercel.com → New Project
2. Conecte ao repositório GitHub (ou faça upload da pasta)
3. Em "Environment Variables", adicione:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Clique em Deploy
5. Em ~3 minutos seu sistema estará em: `https://ilpi-villacuidar.vercel.app`

#### 5.3 Primeiro acesso
- Usuário: `admin@ilpi.com`
- Senha: `Admin@2026` (troque imediatamente)

---

## 6. CRIANDO USUÁRIOS

O administrador acessa o sistema → Menu "Usuários" → "Novo Usuário" e preenche:
- Nome completo
- E-mail (será o login)
- Perfil (role)
- Posto (se cuidador ou técnico)
- Sub-especialidade (se multidisciplinar)

O sistema envia e-mail automático de boas-vindas com link para definir a senha.

---

## 7. FLUXO DE EVOLUÇÃO DIÁRIA

```
Cuidador preenche evolução
        ↓
Evolução salva com status "Pendente"
        ↓
Técnico de Enfermagem confere
        ↓
Técnico assina com PIN
        ↓
Evolução com status "Assinada"
        ↓
Enfermeira pode visualizar e editar se necessário
        ↓
IA gera passagem de plantão automaticamente às 18h50 e 06h50
```

---

## 8. SUPORTE

Para dúvidas técnicas, entre em contato com o desenvolvedor que fizer o deploy.
