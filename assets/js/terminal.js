/* =====================================================================
   terminal.js — a casca visual do terminal.
   Cuida de imprimir linhas, desenhar tabelas no estilo psql, guardar o
   histórico (setas ↑ ↓) e tratar os meta-comandos (help, clear, \dt…).
   A interpretação do SQL em si fica em sql-engine.js.
   ===================================================================== */

(function () {
  "use strict";

  var MAX_CELL = 44; // largura máxima de uma célula antes de cortar com …

  function Terminal(screenEl, formEl, inputEl) {
    this.screen = screenEl;
    this.form = formEl;
    this.input = inputEl;
    this.history = [];
    this.historyIndex = -1;
    this.busy = false;

    this.bind();
  }

  /* ---------------- saída ---------------- */

  Terminal.prototype.print = function (text, cls) {
    var line = document.createElement("div");
    line.className = "tline" + (cls ? " tline--" + cls : "");
    line.textContent = text === undefined ? "" : String(text);
    this.screen.appendChild(line);
    this.scrollToEnd();
    return line;
  };

  Terminal.prototype.printWrapped = function (text, cls) {
    var line = this.print(text, cls);
    line.classList.add("tline--wrap");
    return line;
  };

  Terminal.prototype.spacer = function () {
    var el = document.createElement("div");
    el.className = "tline tline--spacer";
    this.screen.appendChild(el);
  };

  /* Ecoa o comando digitado com o prompt na frente. */
  Terminal.prototype.echo = function (sql) {
    var line = document.createElement("div");
    line.className = "tline tline--cmd tline--wrap";

    var prompt = document.createElement("b");
    prompt.textContent = "bruna@db=> ";
    line.appendChild(prompt);
    line.appendChild(document.createTextNode(sql));

    this.screen.appendChild(line);
    this.scrollToEnd();
  };

  Terminal.prototype.clear = function () {
    this.screen.innerHTML = "";
  };

  Terminal.prototype.scrollToEnd = function () {
    this.screen.scrollTop = this.screen.scrollHeight;
  };

  /* ---------------- tabela estilo psql ---------------- */

  function cellText(value) {
    if (value === null || value === undefined) return "NULL";
    var text = String(value).replace(/\s+/g, " ");
    return text.length > MAX_CELL ? text.slice(0, MAX_CELL - 1) + "…" : text;
  }

  Terminal.prototype.printTable = function (columns, rows) {
    var body = rows.map(function (row) { return row.map(cellText); });

    // largura de cada coluna = maior conteúdo daquela coluna
    var widths = columns.map(function (col, i) {
      return body.reduce(function (max, row) {
        return Math.max(max, row[i].length);
      }, col.length);
    });

    var pad = function (text, width) {
      return text + " ".repeat(width - text.length);
    };

    this.print(
      " " + columns.map(function (c, i) { return pad(c, widths[i]); }).join(" | "),
      "head"
    );

    this.print(
      widths.map(function (w) { return "-".repeat(w + 2); }).join("+"),
      "rule"
    );

    var self = this;
    body.forEach(function (row) {
      self.print(
        " " + row.map(function (cell, i) { return pad(cell, widths[i]); }).join(" | "),
        "table"
      );
    });

    var label = rows.length === 1 ? "(1 linha)" : "(" + rows.length + " linhas)";
    this.print(label, "info");
  };

  /* ---------------- meta-comandos ---------------- */

  Terminal.prototype.banner = function () {
    this.print("psql (PostgreSQL 17 · Supabase) — modo somente leitura", "ok");
    this.print("Digite uma consulta SELECT e aperte Enter. Digite help para ajuda.", "info");
    this.spacer();
  };

  Terminal.prototype.help = function () {
    this.print("COMANDOS", "head");
    [
      ["SELECT ...",        "consulta as tabelas (somente leitura)"],
      ["\\dt",              "lista as tabelas disponíveis"],
      ["\\d <tabela>",      "mostra as colunas de uma tabela"],
      ["help",              "mostra esta ajuda"],
      ["clear",             "limpa a tela"]
    ].forEach(function (pair) {
      this.print("  " + pair[0].padEnd(16) + pair[1], "info");
    }, this);

    this.spacer();
    this.print("SINTAXE ACEITA", "head");
    this.printWrapped("  SELECT colunas | * | COUNT(*) FROM tabela", "info");
    this.printWrapped("         [WHERE coluna op valor [AND|OR ...]]", "info");
    this.printWrapped("         [ORDER BY coluna ASC|DESC] [LIMIT n];", "info");
    this.printWrapped("  Operadores: = != > < >= <= LIKE ILIKE IN IS NULL", "info");

    this.spacer();
    this.print("EXEMPLOS", "head");
    [
      "SELECT * FROM projetos;",
      "SELECT nome FROM skills WHERE categoria = 'Banco de Dados';",
      "SELECT nome, categoria FROM skills ORDER BY nome ASC LIMIT 5;",
      "SELECT COUNT(*) FROM skills;"
    ].forEach(function (ex) {
      this.printWrapped("  " + ex, "key");
    }, this);

    this.spacer();
    this.printWrapped(
      "Escrita (INSERT/UPDATE/DELETE/DROP) é bloqueada aqui e também pelo RLS do banco.",
      "warn"
    );
  };

  Terminal.prototype.listTables = function () {
    this.printTable(
      ["schema", "tabela", "colunas"],
      DB.tables.map(function (t) {
        return ["public", t, DB.schema[t].length];
      })
    );
  };

  Terminal.prototype.describe = function (name) {
    var table = String(name || "").trim().toLowerCase().replace(/;$/, "");
    var cols = DB.schema[table];

    if (!cols) {
      this.print('erro: tabela "' + table + '" não encontrada.', "error");
      this.print("dica: tabelas disponíveis — " + DB.tables.join(", "), "warn");
      return;
    }

    this.print('Tabela "public.' + table + '"', "head");
    this.printTable(
      ["coluna", "tipo", "acesso"],
      cols.map(function (c) {
        return [c, c === "id" ? "bigint" : "text", "SELECT"];
      })
    );
  };

  /* ---------------- execução ---------------- */

  Terminal.prototype.submit = function (raw) {
    var sql = String(raw || "").trim();
    if (!sql || this.busy) return;

    this.echo(sql);
    this.remember(sql);
    this.input.value = "";

    var command = sql.toLowerCase().replace(/;$/, "").trim();

    if (command === "clear" || command === "\\c" || command === "cls") {
      this.clear();
      this.banner();
      return;
    }

    if (command === "help" || command === "\\h" || command === "?") {
      this.help();
      this.spacer();
      return;
    }

    if (command === "\\dt" || command === "show tables") {
      this.listTables();
      this.spacer();
      return;
    }

    if (command.indexOf("\\d ") === 0) {
      this.describe(command.slice(3));
      this.spacer();
      return;
    }

    this.execute(sql);
  };

  Terminal.prototype.execute = function (sql) {
    var self = this;
    this.busy = true;

    var pending = this.print("executando…", "info");

    SqlEngine.run(sql)
      .then(function (result) {
        pending.remove();

        if (result.kind === "noop") return;

        if (result.rowCount === 0) {
          self.print("(0 linhas)", "info");
        } else {
          self.printTable(result.columns, result.rows);
        }

        if (result.truncated) {
          self.print(
            "aviso: saída limitada a " + SqlEngine.maxRows + " linhas. Use LIMIT para pedir menos.",
            "warn"
          );
        }

        self.print("tempo: " + result.ms + " ms", "info");
      })
      .catch(function (err) {
        pending.remove();
        self.printWrapped("ERRO: " + (err.message || err), "error");
        if (err.hint) self.printWrapped("dica: " + err.hint, "warn");
      })
      .then(function () {
        self.busy = false;
        self.spacer();
        self.scrollToEnd();
      });
  };

  /* ---------------- histórico e eventos ---------------- */

  Terminal.prototype.remember = function (sql) {
    if (this.history[this.history.length - 1] !== sql) this.history.push(sql);
    this.historyIndex = this.history.length;
  };

  Terminal.prototype.navigateHistory = function (step) {
    if (!this.history.length) return;

    this.historyIndex = Math.min(
      Math.max(this.historyIndex + step, 0),
      this.history.length
    );

    this.input.value =
      this.historyIndex === this.history.length ? "" : this.history[this.historyIndex];

    // manda o cursor para o fim do texto recuperado
    var pos = this.input.value.length;
    requestAnimationFrame(function () { this.input.setSelectionRange(pos, pos); }.bind(this));
  };

  Terminal.prototype.bind = function () {
    var self = this;

    this.form.addEventListener("submit", function (event) {
      event.preventDefault();
      self.submit(self.input.value);
    });

    this.input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        self.navigateHistory(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        self.navigateHistory(1);
      } else if (event.key === "l" && event.ctrlKey) {
        event.preventDefault();
        self.clear();
        self.banner();
      }
    });

    // clicar em qualquer canto da tela joga o foco para o input
    this.screen.addEventListener("click", function () {
      if (!window.getSelection().toString()) self.input.focus();
    });
  };

  /* Digita um comando caractere a caractere e executa no fim — usado
     pelos botões de exemplo, para parecer que alguém está digitando. */
  Terminal.prototype.typeAndRun = function (sql) {
    if (this.busy) return;

    var self = this;
    var i = 0;
    this.input.value = "";
    this.input.focus();

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      this.submit(sql);
      return;
    }

    this.busy = true;
    (function tick() {
      if (i >= sql.length) {
        self.busy = false;
        self.submit(sql);
        return;
      }
      self.input.value += sql[i++];
      setTimeout(tick, 18);
    })();
  };

  window.Terminal = Terminal;
})();
