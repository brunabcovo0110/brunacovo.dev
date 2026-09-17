/* =====================================================================
   sql-engine.js — interpretador de SELECT para o terminal do portfólio.

   O client-side do Supabase não executa SQL arbitrário (e é bom que não
   execute). Então aqui o SQL digitado é lido, validado e traduzido para
   chamadas da API PostgREST — .from().select().eq().order().limit().

   Três camadas de segurança, nesta ordem:
     1. Este arquivo só reconhece SELECT. Qualquer outro verbo é
        recusado antes de qualquer requisição sair do navegador.
     2. Tabelas e colunas são checadas contra uma allowlist (DB.schema).
     3. No banco, o RLS só tem política de SELECT — mesmo que alguém
        contorne 1 e 2 via console, a escrita é negada pelo Postgres.
   ===================================================================== */

(function () {
  "use strict";

  var MAX_ROWS = 200; // teto de linhas por consulta, para não travar a tela

  /* Verbos recusados de cara. A mensagem de erro cita o verbo encontrado. */
  var BLOCKED = [
    "insert", "update", "delete", "drop", "alter", "create", "truncate",
    "grant", "revoke", "merge", "upsert", "replace", "call", "do", "copy",
    "vacuum", "analyze", "reindex", "cluster", "comment", "refresh",
    "begin", "commit", "rollback", "savepoint", "lock", "listen", "notify",
    "prepare", "execute", "deallocate", "discard", "set", "reset",
    "pg_sleep", "pg_read_file", "dblink"
  ];

  /* --------------------------------------------------------------- */
  /* Erros com dica embutida                                          */
  /* --------------------------------------------------------------- */
  function SqlError(message, hint) {
    this.name = "SqlError";
    this.message = message;
    this.hint = hint || null;
  }
  SqlError.prototype = Object.create(Error.prototype);

  function fail(message, hint) {
    throw new SqlError(message, hint);
  }

  /* --------------------------------------------------------------- */
  /* Máscara de literais                                              */
  /* --------------------------------------------------------------- */
  /* Troca 'texto entre aspas' por marcadores antes de validar, para que
     um valor como 'sites with 3D' não seja confundido com a palavra-
     chave WITH. Os valores voltam na hora de montar o filtro. */
  function maskLiterals(sql) {
    var literals = [];
    var masked = "";
    var i = 0;

    while (i < sql.length) {
      var ch = sql[i];

      if (ch === "'") {
        var value = "";
        i++;
        var closed = false;

        while (i < sql.length) {
          if (sql[i] === "'") {
            if (sql[i + 1] === "'") { // '' é um apóstrofo escapado
              value += "'";
              i += 2;
              continue;
            }
            i++;
            closed = true;
            break;
          }
          value += sql[i];
          i++;
        }

        if (!closed) fail("aspas simples não fechadas na consulta.", "Exemplo: WHERE categoria = 'SQL'");

        masked += "@@L" + literals.length + "@@";
        literals.push(value);
        continue;
      }

      masked += ch;
      i++;
    }

    return { masked: masked, literals: literals };
  }

  function unmask(token, literals) {
    var m = /^@@L(\d+)@@$/.exec(token.trim());
    return m ? { isString: true, value: literals[Number(m[1])] } : null;
  }

  /* --------------------------------------------------------------- */
  /* Validação                                                        */
  /* --------------------------------------------------------------- */
  function validate(masked) {
    if (/--/.test(masked) || /\/\*/.test(masked)) {
      fail("comentários SQL não são aceitos aqui.", "Mande só a consulta, sem -- ou /* */");
    }

    // sobra ; no meio => alguém tentou encadear comandos
    var withoutTrailing = masked.replace(/;\s*$/, "");
    if (withoutTrailing.indexOf(";") !== -1) {
      fail("só uma consulta por vez.", "Remova o ; do meio do comando.");
    }

    var lower = withoutTrailing.toLowerCase();
    for (var i = 0; i < BLOCKED.length; i++) {
      var word = BLOCKED[i];
      if (new RegExp("\\b" + word + "\\b").test(lower)) {
        fail(
          'comando "' + word.toUpperCase() + '" bloqueado: este terminal é somente leitura.',
          "Só SELECT roda aqui — e o banco também só permite leitura pública."
        );
      }
    }

    if (!/^\s*select\b/i.test(withoutTrailing)) {
      fail(
        "só consultas SELECT são aceitas.",
        "Digite help para ver os comandos disponíveis."
      );
    }

    return withoutTrailing.trim();
  }

  /* --------------------------------------------------------------- */
  /* Parsing                                                          */
  /* --------------------------------------------------------------- */
  var STATEMENT = new RegExp(
    "^select\\s+(.+?)" +                       // 1: colunas
    "\\s+from\\s+([a-z_][a-z0-9_]*)" +         // 2: tabela
    "(?:\\s+where\\s+(.+?))?" +                // 3: condições
    "(?:\\s+order\\s+by\\s+(.+?))?" +          // 4: ordenação
    "(?:\\s+limit\\s+(\\d+))?" +               // 5: limite
    "\\s*$",
    "i"
  );

  function parse(statement, literals) {
    var m = STATEMENT.exec(statement.replace(/\s+/g, " "));
    if (!m) {
      fail(
        "não consegui entender essa consulta.",
        "Formato aceito: SELECT colunas FROM tabela [WHERE ...] [ORDER BY ...] [LIMIT n];"
      );
    }

    var table = m[2].toLowerCase();
    var cols = DB.schema[table];
    if (!cols) {
      fail(
        'a tabela "' + table + '" não existe.',
        "Tabelas disponíveis: " + DB.tables.join(", ") + ". Use \\dt para listar."
      );
    }

    return {
      table: table,
      columns: parseColumns(m[1], table, cols),
      where: m[3] ? parseWhere(m[3], table, cols, literals) : null,
      orderBy: m[4] ? parseOrderBy(m[4], table, cols) : null,
      limit: m[5] ? Math.min(Number(m[5]), MAX_ROWS) : MAX_ROWS
    };
  }

  function assertColumn(name, table, cols) {
    if (cols.indexOf(name) === -1) {
      fail(
        'a coluna "' + name + '" não existe em ' + table + ".",
        "Colunas de " + table + ": " + cols.join(", ")
      );
    }
    return name;
  }

  function parseColumns(raw, table, cols) {
    var text = raw.trim();

    if (text === "*") return { kind: "all", list: cols.slice() };

    if (/^count\s*\(\s*\*\s*\)$/i.test(text)) return { kind: "count", list: ["count"] };

    var parts = text.split(",").map(function (p) { return p.trim(); });
    var list = parts.map(function (p) {
      if (/^count\s*\(/i.test(p)) {
        fail("COUNT só é aceito sozinho, na forma SELECT COUNT(*) FROM tabela;");
      }
      var name = p.toLowerCase();
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
        fail('"' + p + '" não é um nome de coluna válido.', "Expressões e funções não são suportadas.");
      }
      return assertColumn(name, table, cols);
    });

    return { kind: "list", list: list };
  }

  /* WHERE simples: condições ligadas só por AND ou só por OR. */
  function parseWhere(raw, table, cols, literals) {
    var text = raw.trim();
    var hasAnd = /\band\b/i.test(text);
    var hasOr = /\bor\b/i.test(text);

    if (hasAnd && hasOr) {
      fail(
        "combinar AND com OR na mesma consulta ainda não é suportado.",
        "Use só AND ou só OR (sem parênteses)."
      );
    }

    var glue = hasOr ? "or" : "and";
    var chunks = text.split(hasOr ? /\bor\b/i : /\band\b/i);

    var conditions = chunks.map(function (chunk) {
      return parseCondition(chunk.trim(), table, cols, literals);
    });

    return { glue: glue, conditions: conditions };
  }

  var CONDITION = /^([a-z_][a-z0-9_]*)\s*(=|!=|<>|>=|<=|>|<|(?:not\s+)?like|(?:not\s+)?ilike|is\s+not\s+null|is\s+null|in)\s*(.*)$/i;

  function parseCondition(raw, table, cols, literals) {
    var m = CONDITION.exec(raw);
    if (!m) {
      fail(
        'não entendi a condição "' + raw + '".',
        "Formato: coluna = valor. Operadores: = != > < >= <= LIKE ILIKE IN IS NULL"
      );
    }

    var column = assertColumn(m[1].toLowerCase(), table, cols);
    var op = m[2].toLowerCase().replace(/\s+/g, " ");
    var rest = (m[3] || "").trim();

    if (op === "is null") return { column: column, method: "is", value: null };
    if (op === "is not null") return { column: column, method: "not.is", value: null };

    if (op === "in") {
      var inner = /^\((.*)\)$/.exec(rest);
      if (!inner) fail("IN precisa de uma lista entre parênteses.", "Exemplo: WHERE id IN (1, 2, 3)");
      var values = inner[1].split(",").map(function (v) { return readValue(v.trim(), literals); });
      if (!values.length) fail("a lista do IN está vazia.");
      return { column: column, method: "in", value: values };
    }

    if (!rest) fail('faltou o valor depois de "' + m[2] + '".');

    var value = readValue(rest, literals);
    var methods = {
      "=": "eq", "!=": "neq", "<>": "neq",
      ">": "gt", "<": "lt", ">=": "gte", "<=": "lte",
      "like": "like", "ilike": "ilike",
      "not like": "not.like", "not ilike": "not.ilike"
    };

    return { column: column, method: methods[op], value: value };
  }

  function readValue(token, literals) {
    var str = unmask(token, literals);
    if (str) return str.value;

    var t = token.trim();
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if (/^true$/i.test(t)) return true;
    if (/^false$/i.test(t)) return false;
    if (/^null$/i.test(t)) return null;

    fail(
      'valor "' + t + '" não reconhecido.',
      "Texto vai entre aspas simples: WHERE categoria = 'SQL'"
    );
  }

  function parseOrderBy(raw, table, cols) {
    return raw.split(",").map(function (part) {
      var bits = part.trim().split(/\s+/);
      var column = assertColumn(bits[0].toLowerCase(), table, cols);
      var dir = (bits[1] || "asc").toLowerCase();

      if (bits.length > 2 || (dir !== "asc" && dir !== "desc")) {
        fail('ordenação inválida em "' + part.trim() + '".', "Use: ORDER BY coluna ASC|DESC");
      }
      return { column: column, ascending: dir === "asc" };
    });
  }

  /* --------------------------------------------------------------- */
  /* Execução: plano -> chamadas do SDK                               */
  /* --------------------------------------------------------------- */
  function applyFilters(query, where) {
    if (!where) return query;

    if (where.glue === "and") {
      where.conditions.forEach(function (c) {
        if (c.method === "is") return void (query = query.is(c.column, null));
        if (c.method === "not.is") return void (query = query.not(c.column, "is", null));
        if (c.method === "not.like") return void (query = query.not(c.column, "like", c.value));
        if (c.method === "not.ilike") return void (query = query.not(c.column, "ilike", c.value));
        if (c.method === "in") return void (query = query.in(c.column, c.value));
        query = query[c.method](c.column, c.value);
      });
      return query;
    }

    // OR vira a sintaxe "col.op.valor,col.op.valor" do PostgREST.
    // Texto sai entre aspas duplas para que vírgulas no valor não sejam
    // lidas como separador de condição.
    var quote = function (v) {
      return typeof v === "string" ? '"' + v.replace(/"/g, '\\"') + '"' : String(v);
    };

    var parts = where.conditions.map(function (c) {
      if (c.method === "is") return c.column + ".is.null";
      if (c.method === "not.is") return c.column + ".not.is.null";
      if (c.method === "in") return c.column + ".in.(" + c.value.map(quote).join(",") + ")";
      return c.column + "." + c.method + "." + quote(c.value);
    });

    return query.or(parts.join(","));
  }

  function runPlan(plan) {
    if (!DB.isReady()) {
      return Promise.reject(
        new SqlError(
          "sem conexão com o banco.",
          DB.configError || "Confira SUPABASE_URL e SUPABASE_ANON_KEY."
        )
      );
    }

    var started = performance.now();

    if (plan.columns.kind === "count") {
      var countQuery = DB.client.from(plan.table).select("*", { count: "exact", head: true });
      countQuery = applyFilters(countQuery, plan.where);

      return countQuery.then(function (res) {
        if (res.error) throw new SqlError(res.error.message, res.error.hint || null);
        return {
          kind: "table",
          columns: ["count"],
          rows: [[res.count]],
          rowCount: 1,
          ms: Math.round(performance.now() - started)
        };
      });
    }

    var selected = plan.columns.list;
    var query = DB.client.from(plan.table).select(selected.join(","));
    query = applyFilters(query, plan.where);

    if (plan.orderBy) {
      plan.orderBy.forEach(function (o) {
        query = query.order(o.column, { ascending: o.ascending });
      });
    }

    query = query.limit(plan.limit);

    return query.then(function (res) {
      if (res.error) throw new SqlError(res.error.message, res.error.hint || null);

      var data = res.data || [];
      return {
        kind: "table",
        columns: selected,
        rows: data.map(function (row) {
          return selected.map(function (c) { return row[c]; });
        }),
        rowCount: data.length,
        truncated: data.length === plan.limit && plan.limit === MAX_ROWS,
        ms: Math.round(performance.now() - started)
      };
    });
  }

  /* --------------------------------------------------------------- */
  /* API pública                                                      */
  /* --------------------------------------------------------------- */
  function run(input) {
    return new Promise(function (resolve) {
      var sql = String(input || "").trim();
      if (!sql) return resolve({ kind: "noop" });

      var masked = maskLiterals(sql);
      var statement = validate(masked.masked);
      var plan = parse(statement, masked.literals);
      resolve(runPlan(plan));
    });
  }

  window.SqlEngine = {
    run: run,
    maxRows: MAX_ROWS,
    SqlError: SqlError
  };
})();
