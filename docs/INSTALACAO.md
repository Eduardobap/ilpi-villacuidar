# GUIA DE INSTALAÇÃO — VillaCuidar ILPI
## Passo a passo completo para hospedar na nuvem (sem custo inicial)

---

## ✅ PRÉ-REQUISITOS (tudo gratuito)

1. **Supabase** → crie conta em: https://supabase.com
2. **Vercel** → crie conta em: https://vercel.com
3. **GitHub** → crie conta em: https://github.com (necessário para conectar com Vercel)
4. **Anthropic** → crie conta em: https://console.anthropic.com (para a IA)

---

## PASSO 1 — Configurar o Supabase (banco de dados)

1. Acesse **supabase.com** e faça login
2. Clique em **"New project"**
3. Preencha:
   - Nome: `villacuidar`
   - Senha do banco: crie uma senha forte e **GUARDE-A**
   - Região: **South America (São Paulo)**
4. Aguarde ~2 minutos até o projeto criar
5. No menu lateral, clique em **"SQL Editor"** → **"New query"**

### Execute os scripts SQL nesta ordem:

**Query 1:** Cole o conteúdo do arquivo `sql/001_schema.sql` e clique em **"Run"**

**Query 2:** Cole o conteúdo do arquivo `sql/002_seed.sql` e clique em **"Run"**

**Query 3:** Cole o conteúdo do arquivo `sql/003_configuracoes.sql` e clique em **"Run"**

6. Vá em **Settings → API** e copie:
   - **Project URL** (começa com `https://`)
   - **anon public** (começa com `eyJ`)
   - **service_role** (começa com `eyJ`) — guarde em local seguro!

---

## PASSO 2 — Criar o usuário Administrador

No Supabase, vá em **Authentication → Users → "Add user"**:
- Email: `admin@suailpi.com.br`
- Password: crie uma senha segura
- Marque **"Auto Confirm User"**
- Clique em **"Create user"**

Após criar, vá em **SQL Editor** e execute:
```sql
UPDATE profiles 
SET role = 'admin', full_name = 'Administrador'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@suailpi.com.br');
```

---

## PASSO 3 — Obter a chave da IA (Anthropic)

1. Acesse **console.anthropic.com**
2. Faça login (ou crie conta gratuita)
3. Vá em **API Keys → "Create Key"**
4. Copie a chave (começa com `sk-ant-`)
5. Adicione crédito mínimo ($5) para usar a IA de relatórios

---

## PASSO 4 — Publicar o código no GitHub

1. Acesse **github.com** → **"New repository"**
2. Nome: `villacuidar-ilpi`
3. Deixe **privado** (Private)
4. Clique em **"Create repository"**

Envie os arquivos deste projeto para o repositório.
*(Se não souber usar Git, peça ajuda ao desenvolvedor ou use o GitHub Desktop)*

---

## PASSO 5 — Deploy na Vercel

1. Acesse **vercel.com** e faça login com sua conta GitHub
2. Clique em **"New Project"**
3. Escolha o repositório `villacuidar-ilpi`
4. Na seção **"Environment Variables"**, adicione:

```
NEXT_PUBLIC_SUPABASE_URL     = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY    = eyJhbGc...
ANTHROPIC_API_KEY            = sk-ant-...
```

5. Clique em **"Deploy"**
6. Aguarde ~3 minutos
7. Seu sistema estará disponível em: `https://villacuidar-ilpi.vercel.app`

---

## PASSO 6 — Primeiro acesso e configuração

1. Acesse o link da Vercel
2. Faça login com o e-mail e senha do admin criados no Passo 2
3. Vá em **Usuários** → **"+ Novo Usuário"** e cadastre toda a equipe:
   - Enfermeiras
   - Técnicos de Enfermagem (com posto fixo)
   - Cuidadores (com posto fixo: 1, 2 ou 3)
   - Nutricionista
   - Equipe Financeira
   - Equipe Multidisciplinar (com especialidade)
4. Vá em **Usuários → Configurações de Assinatura** e escolha o modo
5. Vá em **Residentes** e cadastre os 60 residentes

---

## CUSTOS MENSAIS ESTIMADOS

| Serviço | Plano Gratuito | Quando Pagar |
|---|---|---|
| **Vercel** | Grátis (projetos ilimitados) | Nunca, para este porte |
| **Supabase** | Grátis até 500MB e 50.000 requisições/mês | Crescimento acima do limite |
| **Anthropic IA** | Pago por uso | ~R$ 5–15/mês para uso normal |

**Custo médio total: R$ 5 a R$ 15/mês** (apenas IA)

---

## SUPORTE TÉCNICO

Em caso de dúvidas técnicas durante a instalação, consulte:
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs

---

## SEGURANÇA

✅ Todos os dados ficam no Brasil (servidor São Paulo do Supabase)
✅ Comunicação criptografada (HTTPS)
✅ Autenticação segura via Supabase Auth
✅ Permissões por perfil (RLS no banco de dados)
✅ Nenhum dado é compartilhado com terceiros
