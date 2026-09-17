-- =====================================================================
-- brunacovo.dev — schema do portfólio
-- ---------------------------------------------------------------------
-- Este arquivo já foi aplicado no projeto Supabase criado para o site.
-- Ele fica aqui para: (a) recriar o banco do zero se precisar, e
-- (b) documentar exatamente quais permissões o site usa.
--
-- Como rodar: painel do Supabase > SQL Editor > cole tudo > Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.projetos (
  id          bigint generated always as identity primary key,
  titulo      text not null,
  descricao   text,
  tecnologias text,          -- lista separada por vírgula: "HTML, CSS, JS"
  link        text
);

create table if not exists public.skills (
  id        bigint generated always as identity primary key,
  nome      text not null,
  categoria text not null default 'Outros'
);

comment on table public.projetos is 'Projetos exibidos no portfólio. Leitura pública, escrita apenas via painel do Supabase.';
comment on table public.skills  is 'Tecnologias exibidas na seção Skills. Leitura pública, escrita apenas via painel do Supabase.';

-- ---------------------------------------------------------------------
-- 2. Row Level Security — SOMENTE LEITURA pública
-- ---------------------------------------------------------------------
-- Com o RLS ligado e apenas políticas de SELECT, qualquer INSERT,
-- UPDATE ou DELETE vindo da chave anon é negado pelo próprio Postgres.
alter table public.projetos enable row level security;
alter table public.skills   enable row level security;

drop policy if exists "leitura publica de projetos" on public.projetos;
create policy "leitura publica de projetos"
  on public.projetos
  for select
  to anon, authenticated
  using (true);

drop policy if exists "leitura publica de skills" on public.skills;
create policy "leitura publica de skills"
  on public.skills
  for select
  to anon, authenticated
  using (true);

-- Reforço: além do RLS, tira o privilégio de escrita das roles públicas.
revoke insert, update, delete, truncate on public.projetos from anon, authenticated;
revoke insert, update, delete, truncate on public.skills   from anon, authenticated;

grant select on public.projetos to anon, authenticated;
grant select on public.skills   to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Dados de exemplo (seed)
-- ---------------------------------------------------------------------
insert into public.skills (nome, categoria) values
  ('HTML5',                 'Linguagens & Marcação'),
  ('CSS3',                  'Linguagens & Marcação'),
  ('JavaScript (ES6+)',     'Linguagens & Marcação'),
  ('SQL',                   'Banco de Dados'),
  ('PostgreSQL',            'Banco de Dados'),
  ('Supabase',              'Banco de Dados'),
  ('Git',                   'Versionamento & Deploy'),
  ('GitHub',                'Versionamento & Deploy'),
  ('Vercel',                'Versionamento & Deploy'),
  ('Netlify',               'Versionamento & Deploy'),
  ('Design Responsivo',     'Interface & Efeitos'),
  ('Animações CSS',         'Interface & Efeitos'),
  ('Three.js / WebGL',      'Interface & Efeitos'),
  ('Figma',                 'Interface & Efeitos'),
  ('Acessibilidade (a11y)', 'Interface & Efeitos');

insert into public.projetos (titulo, descricao, tecnologias, link) values
  ('Portfólio brunacovo.dev',
   'Este próprio site: portfólio com identidade tech, terminal SQL interativo e dados vindos de um banco Postgres real.',
   'HTML, CSS, JavaScript, Supabase',
   'https://github.com/brunacovo0110/brunacovo-dev');

-- ---------------------------------------------------------------------
-- 4. Conferência
-- ---------------------------------------------------------------------
-- Deve retornar rowsecurity = true para as duas tabelas:
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
