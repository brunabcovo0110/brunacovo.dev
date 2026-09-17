/* =====================================================================
   db.js — camada de acesso ao Supabase.
   Expõe window.DB com o client, o schema conhecido e dados de fallback
   usados quando o banco não está configurado ou está fora do ar.
   ===================================================================== */

(function () {
  "use strict";

  /* Schema que o terminal conhece. Serve para três coisas:
     validar nomes de tabela/coluna antes de ir ao banco, montar a saída
     do comando \d, e garantir que nada fora desta lista seja consultado. */
  var SCHEMA = {
    projetos: ["id", "titulo", "descricao", "tecnologias", "link"],
    skills: ["id", "nome", "categoria"]
  };

  /* Conteúdo mostrado se o Supabase não responder, para o site nunca
     aparecer vazio para quem chegou nele. */
  var FALLBACK = {
    skills: [
      { id: 1, nome: "HTML5", categoria: "Linguagens & Marcação" },
      { id: 2, nome: "CSS3", categoria: "Linguagens & Marcação" },
      { id: 3, nome: "JavaScript (ES6+)", categoria: "Linguagens & Marcação" },
      { id: 4, nome: "SQL", categoria: "Banco de Dados" },
      { id: 5, nome: "PostgreSQL", categoria: "Banco de Dados" },
      { id: 6, nome: "Supabase", categoria: "Banco de Dados" },
      { id: 7, nome: "Git", categoria: "Versionamento & Deploy" },
      { id: 8, nome: "GitHub", categoria: "Versionamento & Deploy" },
      { id: 9, nome: "Vercel", categoria: "Versionamento & Deploy" },
      { id: 10, nome: "Netlify", categoria: "Versionamento & Deploy" },
      { id: 11, nome: "Design Responsivo", categoria: "Interface & Efeitos" },
      { id: 12, nome: "Animações CSS", categoria: "Interface & Efeitos" },
      { id: 13, nome: "Three.js / WebGL", categoria: "Interface & Efeitos" },
      { id: 14, nome: "Figma", categoria: "Interface & Efeitos" },
      { id: 15, nome: "Acessibilidade (a11y)", categoria: "Interface & Efeitos" }
    ],
    projetos: [
      {
        id: 1,
        titulo: "Portfólio brunacovo.dev",
        descricao:
          "Este próprio site: portfólio com identidade tech, terminal SQL interativo e dados vindos de um banco Postgres real.",
        tecnologias: "HTML, CSS, JavaScript, Supabase",
        link: "https://github.com/brunacovo0110/brunacovo-dev"
      }
    ]
  };

  var cfg = window.SUPABASE_CONFIG || {};
  var client = null;
  var configError = null;

  if (!cfg.url || !cfg.anonKey) {
    configError =
      "SUPABASE_URL / SUPABASE_ANON_KEY não configurados em assets/js/config.js";
  } else if (!window.supabase || typeof window.supabase.createClient !== "function") {
    configError = "SDK do Supabase não carregou (verifique sua conexão com o CDN)";
  } else {
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false } // site público, ninguém faz login
      });
    } catch (err) {
      configError = "Falha ao criar o client do Supabase: " + err.message;
    }
  }

  /* Faz um SELECT leve só para saber se o banco responde. */
  function ping() {
    if (!client) return Promise.resolve({ ok: false, error: configError });

    return client
      .from("skills")
      .select("id", { count: "exact", head: true })
      .then(function (res) {
        if (res.error) return { ok: false, error: res.error.message };
        return { ok: true, count: res.count };
      })
      .catch(function (err) {
        return { ok: false, error: err.message };
      });
  }

  /* Busca uma tabela inteira, caindo para o fallback em caso de erro. */
  function fetchAll(table, orderBy) {
    if (!client) {
      return Promise.resolve({ rows: FALLBACK[table] || [], offline: true });
    }

    var q = client.from(table).select("*");
    if (orderBy) q = q.order(orderBy, { ascending: true });

    return q
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return { rows: res.data || [], offline: false };
      })
      .catch(function (err) {
        console.warn("[db] falha ao ler " + table + ":", err.message);
        return { rows: FALLBACK[table] || [], offline: true, error: err.message };
      });
  }

  window.DB = {
    client: client,
    schema: SCHEMA,
    tables: Object.keys(SCHEMA),
    fallback: FALLBACK,
    configError: configError,
    isReady: function () {
      return !!client;
    },
    ping: ping,
    fetchAll: fetchAll
  };
})();
