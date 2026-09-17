/* =====================================================================
   main.js — liga tudo: navegação, efeito de digitação do hero,
   animação de entrada das seções, skills e projetos vindos do Supabase
   e a inicialização do terminal SQL.
   ===================================================================== */

(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- 1. Navegação ---------------- */

  function setupNav() {
    var nav = $("#nav");
    var toggle = $("#navToggle");
    var links = $("#navLinks");

    var onScroll = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    });

    // fecha o menu ao escolher uma seção
    links.addEventListener("click", function (event) {
      if (event.target.tagName !== "A") return;
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });

    // marca no menu a seção que está na tela
    var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
    var anchors = Array.prototype.slice.call(links.querySelectorAll("a[href^='#']"));

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        anchors.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- 2. Efeito de digitação do hero ---------------- */

  function setupTyping() {
    var el = $("#typingText");
    var phrases = [
      "Sites simples.",
      "Sites com efeitos 3D.",
      "Sites com banco de dados.",
      "Projetos sob medida."
    ];

    if (reducedMotion) {
      el.textContent = phrases.join(" ");
      return;
    }

    var phrase = 0;
    var chars = 0;
    var erasing = false;

    function tick() {
      var current = phrases[phrase];

      if (!erasing) {
        chars++;
        el.textContent = current.slice(0, chars);

        if (chars === current.length) {
          erasing = true;
          return setTimeout(tick, 1500); // pausa lendo a frase inteira
        }
        return setTimeout(tick, 68);
      }

      chars--;
      el.textContent = current.slice(0, chars);

      if (chars === 0) {
        erasing = false;
        phrase = (phrase + 1) % phrases.length;
        return setTimeout(tick, 320);
      }
      return setTimeout(tick, 28);
    }

    tick();
  }

  /* ---------------- 3. Animação de entrada ---------------- */

  function setupReveal() {
    var items = document.querySelectorAll(".reveal");

    if (reducedMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        // pequeno escalonamento para os elementos não subirem todos juntos
        setTimeout(function () {
          entry.target.classList.add("is-visible");
        }, i * 70);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------- 4. Skills ---------------- */

  function renderSkills(rows, offline) {
    var grid = $("#skillsGrid");
    grid.innerHTML = "";

    if (!rows.length) {
      grid.innerHTML = '<div class="state-msg">nenhuma skill cadastrada ainda.</div>';
      return;
    }

    // agrupa por categoria preservando a ordem em que apareceram
    var groups = [];
    var byName = {};

    rows.forEach(function (row) {
      var key = row.categoria || "Outros";
      if (!byName[key]) {
        byName[key] = { nome: key, itens: [] };
        groups.push(byName[key]);
      }
      byName[key].itens.push(row.nome);
    });

    groups.forEach(function (group) {
      var card = document.createElement("article");
      card.className = "skillcard reveal";

      var head = document.createElement("div");
      head.className = "skillcard__head";

      var title = document.createElement("span");
      title.className = "skillcard__title";
      title.textContent = group.nome;

      var count = document.createElement("span");
      count.className = "skillcard__count";
      count.textContent = String(group.itens.length).padStart(2, "0");

      head.appendChild(title);
      head.appendChild(count);

      var tags = document.createElement("div");
      tags.className = "tags";
      group.itens.forEach(function (nome) {
        var tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = nome;
        tags.appendChild(tag);
      });

      card.appendChild(head);
      card.appendChild(tags);
      grid.appendChild(card);
    });

    if (offline) {
      var note = document.createElement("p");
      note.className = "state-msg state-msg--error";
      note.textContent = "* exibindo lista local: o banco não respondeu.";
      grid.appendChild(note);
    }

    revealNewNodes(grid);
  }

  /* ---------------- 5. Projetos ---------------- */

  function renderProjects(rows, offline) {
    var grid = $("#projectsGrid");
    grid.innerHTML = "";

    if (!rows.length) {
      grid.innerHTML =
        '<div class="state-msg">nenhum projeto publicado ainda — adicione uma linha na tabela <code>projetos</code> do Supabase e ele aparece aqui.</div>';
      return;
    }

    rows.forEach(function (row, index) {
      var card = document.createElement("article");
      card.className = "project reveal";

      var id = document.createElement("div");
      id.className = "project__id";
      id.textContent = "projeto[" + String(index + 1).padStart(2, "0") + "]";

      var title = document.createElement("h3");
      title.className = "project__title";
      title.textContent = row.titulo || "Sem título";

      var desc = document.createElement("p");
      desc.className = "project__desc";
      desc.textContent = row.descricao || "";

      card.appendChild(id);
      card.appendChild(title);
      card.appendChild(desc);

      if (row.tecnologias) {
        var tech = document.createElement("div");
        tech.className = "project__tech";
        String(row.tecnologias)
          .split(",")
          .map(function (t) { return t.trim(); })
          .filter(Boolean)
          .forEach(function (t) {
            var chip = document.createElement("span");
            chip.textContent = t;
            tech.appendChild(chip);
          });
        card.appendChild(tech);
      }

      if (row.link) {
        var link = document.createElement("a");
        link.className = "project__link";
        link.href = row.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "ver projeto ↗";
        card.appendChild(link);
      } else {
        var soon = document.createElement("span");
        soon.className = "project__link project__link--off";
        soon.textContent = "link em breve";
        card.appendChild(soon);
      }

      grid.appendChild(card);
    });

    if (offline) {
      var note = document.createElement("p");
      note.className = "state-msg state-msg--error";
      note.textContent = "* exibindo dados locais: o banco não respondeu.";
      grid.appendChild(note);
    }

    revealNewNodes(grid);
  }

  /* Elementos criados depois do setupReveal() precisam do próprio
     observer, senão ficariam invisíveis para sempre. */
  function revealNewNodes(container) {
    var nodes = container.querySelectorAll(".reveal");

    if (reducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        setTimeout(function () { entry.target.classList.add("is-visible"); }, i * 70);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    nodes.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------- 6. Terminal ---------------- */

  function setupTerminal() {
    var term = new Terminal($("#terminalOutput"), $("#terminalForm"), $("#terminalInput"));
    var status = $("#dbStatus");

    term.banner();

    DB.ping().then(function (res) {
      if (res.ok) {
        status.dataset.state = "online";
        status.textContent = "conectado";
        term.print("conectado a public.projetos, public.skills", "ok");
      } else {
        status.dataset.state = "offline";
        status.textContent = "offline";
        term.printWrapped("aviso: sem conexão com o banco — " + res.error, "error");
        term.printWrapped(
          "confira SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js",
          "warn"
        );
      }
      term.spacer();
    });

    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var query = chip.dataset.query;
        $("#terminal").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
        term.typeAndRun(query);
      });
    });
  }

  /* ---------------- 7. Boot ---------------- */

  function init() {
    setupNav();
    setupTyping();
    setupReveal();
    setupTerminal();

    DB.fetchAll("skills", "id").then(function (res) {
      renderSkills(res.rows, res.offline);
    });

    DB.fetchAll("projetos", "id").then(function (res) {
      renderProjects(res.rows, res.offline);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
