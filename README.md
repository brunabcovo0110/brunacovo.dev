# brunacovo.dev

Portfólio pessoal da **Bruna Barbosa Covo** — desenvolvedora de sites em formação,
criando projetos personalizados sob medida.

Site estático em **HTML, CSS e JavaScript puros**, sem framework e sem backend.
Os dados (skills e projetos) vêm de um banco **Postgres real no Supabase**,
consultado direto do navegador pelo SDK client-side.

O diferencial é o **terminal SQL interativo**: quem visita o site pode digitar
consultas `SELECT` e ver o resultado renderizado como saída de terminal, lendo
os dados de verdade do banco.

---

## Índice

- [Estrutura do projeto](#estrutura-do-projeto)
- [Rodando localmente](#rodando-localmente)
- [Configurando o Supabase](#configurando-o-supabase)
- [Como o terminal SQL funciona](#como-o-terminal-sql-funciona)
- [Segurança](#segurança)
- [Deploy na Vercel](#deploy-na-vercel)
- [Deploy na Netlify](#deploy-na-netlify)
- [Publicando no GitHub](#publicando-no-github)
- [Editando o conteúdo do site](#editando-o-conteúdo-do-site)

---

## Estrutura do projeto

```
brunacovo.dev/
├── index.html                  # página única, com todas as seções
├── assets/
│   ├── favicon.svg
│   ├── css/
│   │   └── styles.css          # estilo completo, mobile-first
│   └── js/
│       ├── config.js           # URL e anon key do Supabase
│       ├── db.js               # client do Supabase + schema + fallback
│       ├── sql-engine.js       # interpreta SELECT -> API do Supabase
│       ├── terminal.js         # a casca visual do terminal (psql)
│       └── main.js             # nav, typing, animações, render das seções
├── scripts/
│   └── build-config.mjs        # gera config.js a partir das env vars
├── supabase/
│   └── schema.sql              # tabelas, RLS e seed (para recriar o banco)
├── .env.example
├── vercel.json
├── netlify.toml
└── README.md
```

Sem `package.json` e sem dependências para instalar: o SDK do Supabase entra
por CDN no `index.html`.

---

## Rodando localmente

O site é estático, mas **não abra o `index.html` com dois cliques**. Pelo
protocolo `file://` o navegador bloqueia as requisições ao Supabase. Suba um
servidor local — qualquer um serve:

```bash
npx serve .
```

Depois abra o endereço que aparecer no terminal (normalmente
`http://localhost:3000`).

---

## Configurando o Supabase

O projeto já vem apontando para um banco funcionando. Se quiser criar o seu:

### 1. Criar as tabelas

No painel do Supabase: **SQL Editor → New query**, cole o conteúdo de
[`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.

Isso cria:

| Tabela     | Colunas                                          |
| ---------- | ------------------------------------------------ |
| `projetos` | `id`, `titulo`, `descricao`, `tecnologias`, `link` |
| `skills`   | `id`, `nome`, `categoria`                        |

…já com RLS de leitura pública ligado e alguns dados de exemplo.

### 2. Pegar as chaves

**Project Settings → API**. Você precisa de dois valores:

- **Project URL** → `SUPABASE_URL`
- **anon / public key** → `SUPABASE_ANON_KEY`

> ⚠️ A chave **`service_role`** ignora o RLS e dá acesso total ao banco.
> Ela **nunca** pode ir para o front-end, para o `.env.example` nem para o
> GitHub. Só a `anon` é usada aqui.

### 3. Informar as chaves ao site

Duas formas, escolha uma:

**a) Direto no arquivo** (mais simples, funciona em qualquer hospedagem):
edite `assets/js/config.js` e coloque os valores.

**b) Por variáveis de ambiente** (Vercel/Netlify): cadastre `SUPABASE_URL` e
`SUPABASE_ANON_KEY` no painel. No build, `scripts/build-config.mjs` roda e
reescreve o `config.js` com esses valores. Se as variáveis não existirem, o
arquivo commitado é mantido — o site continua funcionando.

---

## Como o terminal SQL funciona

O SDK client-side do Supabase **não executa SQL arbitrário** (e é bom que não
execute — seria um buraco de segurança aberto no navegador). Então o terminal
faz o seguinte:

1. Lê o SQL digitado e protege os textos entre aspas, para que um valor como
   `'sites with 3D'` não seja confundido com palavra-chave.
2. Recusa qualquer coisa que não seja `SELECT`, além de comentários (`--`,
   `/* */`) e mais de um comando por vez.
3. Faz o parse de `SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT ...` e
   valida tabela e colunas contra uma lista fixa (`DB.schema`).
4. Traduz o resultado para chamadas da API:
   `.from('skills').select('nome,categoria').eq('categoria', 'SQL').limit(50)`.
5. Desenha a resposta como uma tabela no estilo `psql`.

### Sintaxe aceita

```sql
SELECT colunas | * | COUNT(*) FROM tabela
  [WHERE coluna operador valor [AND|OR ...]]
  [ORDER BY coluna ASC|DESC]
  [LIMIT n];
```

Operadores: `=` `!=` `<>` `>` `<` `>=` `<=` `LIKE` `ILIKE` `IN` `IS NULL` `IS NOT NULL`.

Meta-comandos: `help`, `clear`, `\dt` (lista tabelas), `\d <tabela>` (colunas).
As setas ↑ e ↓ percorrem o histórico.

### Limitações conhecidas

`JOIN`, subconsultas, `GROUP BY`, funções de agregação além de `COUNT(*)`,
parênteses no `WHERE` e misturar `AND` com `OR` na mesma consulta não são
suportados — o terminal responde com uma mensagem explicando. O teto é de
200 linhas por consulta.

---

## Segurança

O terminal é público, então a leitura é a única coisa possível — em três
camadas independentes:

1. **No navegador**: `sql-engine.js` só reconhece `SELECT`. `INSERT`, `UPDATE`,
   `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `GRANT` e companhia são recusados
   antes de qualquer requisição sair da máquina de quem visita.
2. **Na allowlist**: só as tabelas `projetos` e `skills` e só as colunas
   declaradas em `db.js` podem ser consultadas.
3. **No banco**: RLS ligado nas duas tabelas, com política apenas de `SELECT`.
   Os privilégios de escrita também foram revogados das roles `anon` e
   `authenticated`. Mesmo alguém chamando a API pelo console do navegador
   recebe `permission denied`.

A camada 3 é a que realmente importa: as duas primeiras são conveniência e
boa mensagem de erro, mas o Postgres é quem garante.

---

## Deploy na Vercel

### Pelo site (recomendado)

1. Suba o projeto para o GitHub (veja a seção seguinte).
2. Entre em [vercel.com/new](https://vercel.com/new) e importe o repositório
   `brunacovo-dev`.
3. Em **Framework Preset**, deixe **Other**. O `vercel.json` já cuida do resto.
4. Abra **Environment Variables** e adicione:

   | Name                 | Value                          |
   | -------------------- | ------------------------------ |
   | `SUPABASE_URL`       | a Project URL do Supabase      |
   | `SUPABASE_ANON_KEY`  | a chave **anon** do Supabase   |

5. Clique em **Deploy**.

A cada `git push` na branch principal, a Vercel publica de novo sozinha.

### Pelo terminal

```bash
npm i -g vercel
vercel
```

---

## Deploy na Netlify

Mesmo caminho: importe o repositório, e o `netlify.toml` já define o comando de
build (`node scripts/build-config.mjs`) e a pasta publicada (`.`). As variáveis
`SUPABASE_URL` e `SUPABASE_ANON_KEY` ficam em **Site settings → Environment
variables**.

---

## Publicando no GitHub

Com o repositório `brunacovo-dev` já criado na sua conta (vazio, sem README):

```bash
git remote add origin https://github.com/brunacovo0110/brunacovo-dev.git
git branch -M main
git push -u origin main
```

Nos pushes seguintes, basta:

```bash
git add .
git commit -m "descrição do que mudou"
git push
```

---

## Editando o conteúdo do site

**Skills e projetos** não ficam no código: são linhas no banco. Para mudar,
abra o painel do Supabase → **Table Editor** → escolha `projetos` ou `skills` →
**Insert row**. O site pega a mudança no próximo carregamento, sem precisar de
novo deploy.

Na tabela `projetos`, o campo `tecnologias` é um texto com os itens separados
por vírgula (`HTML, CSS, JavaScript`) — o site quebra em etiquetas sozinho. Se
`link` ficar vazio, o card mostra "link em breve".

**Textos fixos** (hero, sobre, contato) estão no `index.html`. As frases do
efeito de digitação estão em `assets/js/main.js`, na função `setupTyping`.

---

## Contato

- WhatsApp: [+55 35 99931-5579](https://wa.me/5535999315579)
- E-mail: [brunabcovo@gmail.com](mailto:brunabcovo@gmail.com)
- Instagram: [@bruhx_0110](https://instagram.com/bruhx_0110)
- GitHub: [brunacovo0110](https://github.com/brunacovo0110)
