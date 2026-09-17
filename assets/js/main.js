/* =====================================================================
   main.js — liga tudo: navegação, efeito de digitação do hero, a malha
   3D do Lab e o conteúdo vindo do Supabase (skills e projetos).
   Os efeitos de movimento ficam em effects.js.
   ===================================================================== */

(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- 1. Abrir sempre no topo ---------------- */

  /* Num site de uma página só, duas coisas do navegador faziam o visitante
     cair no meio do site em vez de começar pelo hero:

     1. scrollRestoration: ao recarregar (F5) ou reabrir a aba, o navegador
        devolve a pessoa exatamente onde ela tinha parado.
     2. o #secao que sobrava na URL depois de clicar no menu: quem abrisse
        aquele endereço de novo pulava direto para a seção.

     Aqui as duas são desligadas. A rolagem suave do menu passa a ser feita
     no JS (setupSmoothLinks), sem escrever nada na URL. */
  function setupScrollStart() {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    // limpa o #secao herdado, sem criar entrada nova no histórico
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }

    /* Só voltamos ao topo enquanto a pessoa não tiver mexido na página.
       Sem esta trava, quem clicasse no menu durante o carregamento (as
       imagens e fontes ainda descendo) era puxado de volta ao topo pelo
       "load" no meio da rolagem. */
    var userMoved = false;
    var markMoved = function () { userMoved = true; };

    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (evt) {
      window.addEventListener(evt, markMoved, { passive: true });
    });

    var toTop = function () {
      if (!userMoved) window.scrollTo(0, 0);
    };

    toTop();
    window.addEventListener("load", toTop);

    // no celular, voltar para a aba restaura da memória e não dispara "load"
    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;
      userMoved = false; // é uma abertura nova aos olhos de quem está vendo
      window.scrollTo(0, 0);
    });
  }

  /* ---------------- 2. Rolagem suave dos links ---------------- */

  /* Os links do menu continuam sendo âncoras de verdade (funcionam sem JS,
     dá para abrir em outra aba), mas o clique é interceptado para rolar
     sem deixar o #secao na barra de endereço. */
  function setupSmoothLinks() {
    var NAV_OFFSET = 76; // altura da nav fixa, para a seção não ficar por baixo

    document.addEventListener("click", function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;

      // deixa o navegador cuidar de ctrl+clique, clique do meio etc.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      var alvo = document.querySelector(link.getAttribute("href"));
      if (!alvo) return;

      event.preventDefault();

      var y = alvo.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
      window.scrollTo({
        top: Math.max(0, y),
        behavior: reduced ? "auto" : "smooth"
      });
    });
  }

  /* ---------------- 3. Navegação ---------------- */

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

    links.addEventListener("click", function (event) {
      if (event.target.tagName !== "A") return;
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });

    // marca no menu a seção que está na tela
    var anchors = Array.prototype.slice.call(links.querySelectorAll("a[href^='#']"));
    var sections = anchors
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);

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

  /* ---------------- 4. Efeito de digitação do hero ---------------- */

  function setupTyping() {
    var el = $("#typingText");
    var phrases = [
      "Sites simples.",
      "Sites com efeitos 3D.",
      "Sites com banco de dados.",
      "Projetos sob medida."
    ];

    if (reduced) {
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

  /* ---------------- 5. Retrato do Sobre ---------------- */

  /* Se o arquivo da foto não estiver na pasta, o círculo mostra as
     iniciais em vez do ícone de imagem quebrada do navegador. */
  function setupAvatar() {
    var wrap = $("#sobreAvatar");
    if (!wrap) return;

    var img = wrap.querySelector("img");
    if (!img) return;

    var markMissing = function () { wrap.classList.add("is-missing"); };

    img.addEventListener("error", markMissing);

    // imagem que já falhou antes deste script rodar
    if (img.complete && img.naturalWidth === 0) markMissing();
  }

  /* ---------------- 6. Lab 3D ---------------- */

  function setupLab() {
    var canvas = $("#lab3d");
    if (!canvas || typeof Lab3D !== "function") return;

    var lab = new Lab3D(canvas, { fps: $("#labFps") });
    $("#labPoints").textContent = lab.points.length + " pontos";

    if (reduced) {
      lab.renderStill();
      return;
    }

    // só anima enquanto a seção está na tela: fora dela, nada de gastar
    // bateria desenhando 60 vezes por segundo
    var watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) lab.start();
        else lab.stop();
      });
    }, { threshold: 0.05 });

    watcher.observe(canvas);

    // e também pausa quando a aba vai para segundo plano
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) lab.stop();
      else if (canvas.getBoundingClientRect().top < window.innerHeight) lab.start();
    });
  }

  /* ---------------- 7. Skills ---------------- */

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
      card.dataset.reveal = "up";
      card.dataset.tilt = "";

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
      group.itens.forEach(function (nome, i) {
        var tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = nome;
        tag.style.setProperty("--pop-delay", (i * 55) + "ms");
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

    Effects.revealWithin(grid);
    Effects.tilt(grid);
    buildMarquee(rows);
  }

  /* Faixa infinita com os nomes das tecnologias. O conteúdo é duplicado
     para que a emenda entre o fim e o começo não apareça. */
  function buildMarquee(rows) {
    var track = $("#marqueeTrack");
    if (!track || !rows.length) return;

    var names = rows.map(function (r) { return r.nome; });
    track.innerHTML = "";

    for (var pass = 0; pass < 2; pass++) {
      names.forEach(function (nome) {
        var item = document.createElement("span");
        item.className = "marquee__item";
        item.textContent = nome;
        track.appendChild(item);

        var sep = document.createElement("span");
        sep.className = "marquee__sep";
        sep.textContent = "//";
        track.appendChild(sep);
      });
    }
  }

  /* ---------------- 8. Projetos ---------------- */

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
      card.dataset.reveal = "up";
      card.dataset.tilt = "";

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

    Effects.revealWithin(grid);
    Effects.tilt(grid);
  }

  /* ---------------- 9. Boot ---------------- */

  function init() {
    setupNav();
    setupSmoothLinks();
    setupTyping();
    setupAvatar();
    setupLab();
    Effects.init();

    DB.fetchAll("skills", "id").then(function (res) {
      renderSkills(res.rows, res.offline);
    });

    DB.fetchAll("projetos", "id").then(function (res) {
      renderProjects(res.rows, res.offline);
    });
  }

  /* Este roda já, sem esperar o DOMContentLoaded: quanto antes o scroll
     for zerado, menor a chance de a pessoa ver a página piscar no meio. */
  setupScrollStart();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
