# brunacovo.dev

Portfólio pessoal da **Bruna Barbosa Covo** — desenvolvedora de sites em formação,
criando projetos personalizados sob medida.

Site estático em **HTML, CSS e JavaScript puros**, sem framework e sem backend.
Os dados (skills e projetos) vêm de um banco **Postgres real no Supabase**,
consultado direto do navegador pelo SDK client-side.

O destaque visual é o **Lab**: uma malha de pontos em 3D desenhada em
`<canvas>` que gira acompanhando o mouse — sem Three.js, sem biblioteca
nenhuma, só matemática.

---

## Índice

- [Estrutura do projeto](#estrutura-do-projeto)
- [Rodando localmente](#rodando-localmente)
- [Configurando o Supabase](#configurando-o-supabase)
- [O Lab 3D](#o-lab-3d)
- [As animações](#as-animações)
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
│   ├── img/
│   │   └── bruna.png           # retrato exibido na seção Sobre
│   ├── css/
│   │   └── styles.css          # estilo completo, mobile-first
│   └── js/
│       ├── config.js           # URL e anon key do Supabase
│       ├── db.js               # client do Supabase + dados de fallback
│       ├── lab-3d.js           # a malha de pontos em 3D no canvas
│       ├── effects.js          # scroll, parallax, tilt, reveal, ímã
│       └── main.js             # nav, typing e render das seções
├── scripts/
│   └── build-config.mjs        # gera config.js a partir das env vars
├── supabase/
│   └── schema.sql              # tabelas, RLS e seed (para recriar o banco)
├── .env.example
├── vercel.json
├── netlify.toml
└── README.md
```

Ordem das seções na página: **Hero → Sobre → Contato → Skills → Lab → Projetos**.
O contato fica no alto de propósito, para quem entrar não precisar rolar até o
fim para achar o WhatsApp.

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

| Tabela     | Colunas                                            |
| ---------- | -------------------------------------------------- |
| `projetos` | `id`, `titulo`, `descricao`, `tecnologias`, `link` |
| `skills`   | `id`, `nome`, `categoria`                          |

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

## O Lab 3D

`assets/js/lab-3d.js` desenha 130 pontos distribuídos na superfície de uma
esfera, gira tudo e achata na tela. São três passos:

1. **Distribuir** — espiral de Fibonacci: cada ponto avança pelo ângulo áureo
   (`π × (3 − √5)`), o que espalha os pontos por igual sem amontoar nos polos,
   como aconteceria dividindo por latitude e longitude.
2. **Girar** — rotação em X e depois em Y, com seno e cosseno.
3. **Projetar** — perspectiva simples: `escala = fov / (fov + z)`. Quem está
   longe tem `z` maior, divisor maior, e encolhe. É isso que dá a sensação de
   profundidade.

As linhas só são desenhadas entre pontos a menos de `0.52` de distância **no
espaço 3D**, e a transparência cai conforme eles se afastam ou vão para o
fundo. Os pontos são ordenados por profundidade antes de desenhar, para os da
frente ficarem por cima — e só os da frente ganham o halo ciano.

O movimento do mouse não gira a esfera direto: ele define um *alvo*, e a
rotação persegue esse alvo (`rot += (alvo − rot) × 0.055`). É o que faz o giro
parecer que tem peso em vez de grudar no cursor.

**Performance:** a animação só roda quando a seção está na tela
(`IntersectionObserver`) e pausa quando a aba vai para segundo plano. Com
`prefers-reduced-motion`, desenha um único quadro parado.

---

## As animações

Ficam todas em `assets/js/effects.js`:

| Efeito             | O que faz                                                     |
| ------------------ | ------------------------------------------------------------- |
| Barra de progresso | linha neon no topo mostrando o quanto da página já foi lida    |
| Brilho no cursor   | halo azul que segue o mouse com atraso (só em telas com mouse) |
| Parallax           | nome e tagline sobem mais devagar que o resto ao rolar         |
| Reveal             | cada bloco entra de uma direção, em cascata                    |
| Tilt               | cards se inclinam para o lado do cursor, com reflexo junto     |
| Ímã                | botões do hero se deslocam um pouco na direção do mouse        |

No CSS ainda há o gradiente do nome em movimento, o brilho que atravessa o
botão principal, a faixa infinita de tecnologias, as tags que pipocam uma a
uma e o anel que pulsa atrás da esfera.

Dois cuidados que valem lembrar se for mexer:

- **Eventos de scroll e mousemove só guardam o valor cru.** Quem mexe no DOM é
  o `requestAnimationFrame`, uma vez por quadro — senão o navegador recalcula
  layout várias vezes por gesto e trava.
- **Nada de `clip-path` no estado inicial de um elemento observado.** Um
  `clip-path: inset(0 100% 0 0)` zera a área visível, o `IntersectionObserver`
  nunca considera o elemento na tela, ele nunca recebe `.is-visible` e some
  para sempre. Foi exatamente o que aconteceu com o `<h1>` do hero na primeira
  versão; hoje o efeito de entrada dele é feito com `letter-spacing`.

Tudo respeita `prefers-reduced-motion`: com a opção ligada no sistema, o site
fica parado sem perder nenhum conteúdo.

---

## Segurança

As duas tabelas são públicas só para **leitura**:

- **RLS ligado** nas duas, com política apenas de `SELECT`.
- Os privilégios de `INSERT`, `UPDATE`, `DELETE` e `TRUNCATE` foram
  **revogados** das roles `anon` e `authenticated`.
- Mesmo alguém chamando a API pelo console do navegador com a chave pública
  recebe `permission denied`.

A anon key é pública por natureza — ela só consegue fazer o que as políticas do
banco permitirem. Quem garante a segurança é o Postgres, não o JavaScript.

---

## Deploy na Vercel

### Pelo site (recomendado)

1. Suba o projeto para o GitHub (veja a seção seguinte).
2. Entre em [vercel.com/new](https://vercel.com/new) e importe o repositório
   `brunacovo.dev`.
3. Em **Framework Preset**, deixe **Other**. O `vercel.json` já cuida do resto.
4. Abra **Environment Variables** e adicione:

   | Name                | Value                        |
   | ------------------- | ---------------------------- |
   | `SUPABASE_URL`      | a Project URL do Supabase    |
   | `SUPABASE_ANON_KEY` | a chave **anon** do Supabase |

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

O repositório é [brunabcovo0110/brunacovo.dev](https://github.com/brunabcovo0110/brunacovo.dev).
Para enviar mudanças:

```bash
git add . && git commit -m "descrição do que mudou" && git push
```

Se precisar reconfigurar o remote do zero:

```bash
git remote add origin https://github.com/brunabcovo0110/brunacovo.dev.git
git branch -M main
git push -u origin main
```

---

## Editando o conteúdo do site

**Skills e projetos** não ficam no código: são linhas no banco. Para mudar,
abra o painel do Supabase → **Table Editor** → escolha `projetos` ou `skills` →
**Insert row**. O site pega a mudança no próximo carregamento, sem precisar de
novo deploy.

Na tabela `projetos`, o campo `tecnologias` é um texto com os itens separados
por vírgula (`HTML, CSS, JavaScript`) — o site quebra em etiquetas sozinho. Se
`link` ficar vazio, o card mostra "link em breve". Os cards aparecem na ordem
do `id`.

**Textos fixos** (hero, sobre, contato) estão no `index.html`. As frases do
efeito de digitação estão em `assets/js/main.js`, na função `setupTyping`.

---

## Contato

- WhatsApp: [+55 35 99931-5579](https://wa.me/5535999315579)
- E-mail: [brunabcovo@gmail.com](mailto:brunabcovo@gmail.com)
- Instagram: [@bruhx_0110](https://instagram.com/bruhx_0110)
- GitHub: [brunabcovo0110](https://github.com/brunabcovo0110)
