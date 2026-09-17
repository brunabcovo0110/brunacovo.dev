/* =====================================================================
   db.js — camada de acesso ao Supabase.
   Expõe window.DB com o client e a leitura das tabelas do portfólio.
   Se o banco não responder, devolve uma cópia local do conteúdo para o
   site nunca aparecer vazio para quem chegou nele.
   ===================================================================== */

(function () {
  "use strict";

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
      { id: 13, nome: "Canvas / 3D", categoria: "Interface & Efeitos" },
      { id: 14, nome: "Figma", categoria: "Interface & Efeitos" },
      { id: 15, nome: "Acessibilidade (a11y)", categoria: "Interface & Efeitos" }
    ],
    projetos: [
      {
        id: 1,
        titulo: "Estância Moda Country",
        descricao:
          "Site para loja de moda country, com formulário de contato gravando as mensagens em banco de dados e informações de contato editáveis pelo painel.",
        tecnologias: "HTML, CSS, JavaScript, Supabase",
        link: "https://estancia-country.vercel.app"
      },
      {
        id: 2,
        titulo: "Portfólio brunacovo.dev",
        descricao:
          "Este próprio site: portfólio com identidade tech, malha 3D animada em canvas puro e conteúdo vindo de um banco Postgres real.",
        tecnologias: "HTML, CSS, JavaScript, Supabase",
        link: "https://github.com/brunabcovo0110/brunacovo.dev"
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

  if (configError) console.warn("[db] " + configError);

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
    fallback: FALLBACK,
    configError: configError,
    isReady: function () { return !!client; },
    fetchAll: fetchAll
  };
})();
