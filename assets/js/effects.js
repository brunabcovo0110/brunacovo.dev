/* =====================================================================
   effects.js — a camada de movimento do site.

   Tudo aqui é enfeite: se o navegador for antigo, se o JS falhar ou se a
   pessoa pediu menos movimento no sistema, o site continua legível e
   completo — só fica parado.

   Regra geral de performance: eventos de scroll e mousemove só guardam o
   valor cru; quem mexe no DOM é o requestAnimationFrame, uma vez por
   quadro. Assim o navegador não recalcula layout várias vezes por gesto.
   ===================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------------------------------------------------------------
     1. Barra de progresso do scroll
     --------------------------------------------------------------- */
  function scrollProgress() {
    var bar = document.getElementById("scrollProgress");
    if (!bar) return;

    var ticking = false;

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, ratio)).toFixed(4) + ")";
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* ---------------------------------------------------------------
     2. Brilho que segue o cursor (só em mouse, nunca em toque)
     --------------------------------------------------------------- */
  function cursorGlow() {
    var glow = document.getElementById("cursorGlow");
    if (!glow || !finePointer || reduced) return;

    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 2;
    var x = targetX;
    var y = targetY;
    var visible = false;

    document.addEventListener("pointermove", function (event) {
      targetX = event.clientX;
      targetY = event.clientY;

      if (!visible) {
        visible = true;
        glow.classList.add("is-on");
      }
    }, { passive: true });

    document.addEventListener("pointerleave", function () {
      visible = false;
      glow.classList.remove("is-on");
    });

    // o brilho persegue o cursor com atraso, em vez de grudar nele
    (function loop() {
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      glow.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px,0)";
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------------------------------------------------------
     3. Parallax: elementos com data-parallax sobem mais devagar
     --------------------------------------------------------------- */
  function parallax() {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
    var glows = Array.prototype.slice.call(document.querySelectorAll(".bg-glow"));
    if (reduced || (!items.length && !glows.length)) return;

    var ticking = false;

    function update() {
      var y = window.scrollY;

      items.forEach(function (el) {
        var rate = parseFloat(el.dataset.parallax) || 0.1;
        el.style.transform = "translate3d(0," + (-y * rate).toFixed(2) + "px,0)";
      });

      glows.forEach(function (el, i) {
        var rate = 0.05 + i * 0.035;
        el.style.setProperty("--shift", (-y * rate).toFixed(2) + "px");
      });

      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* ---------------------------------------------------------------
     4. Tilt: o card se inclina na direção do mouse
     --------------------------------------------------------------- */
  function tilt(root) {
    if (reduced || !finePointer) return;

    var scope = root || document;
    var cards = scope.querySelectorAll("[data-tilt]");

    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.tiltReady) return; // não religa em cards já tratados
      card.dataset.tiltReady = "1";

      var frame = null;

      card.addEventListener("pointermove", function (event) {
        if (frame) return;

        frame = requestAnimationFrame(function () {
          var rect = card.getBoundingClientRect();

          // -0.5 a +0.5, medindo a partir do centro do card
          var px = (event.clientX - rect.left) / rect.width - 0.5;
          var py = (event.clientY - rect.top) / rect.height - 0.5;

          card.style.transform =
            "perspective(700px) rotateX(" + (-py * 7).toFixed(2) + "deg)" +
            " rotateY(" + (px * 9).toFixed(2) + "deg)" +
            " translate3d(0,-5px,0)";

          // move o reflexo junto com o cursor
          card.style.setProperty("--mx", (px * 100 + 50).toFixed(1) + "%");
          card.style.setProperty("--my", (py * 100 + 50).toFixed(1) + "%");

          frame = null;
        });
      });

      card.addEventListener("pointerleave", function () {
        if (frame) cancelAnimationFrame(frame);
        frame = null;
        card.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------------
     5. Ímã: o botão se desloca um pouco na direção do cursor
     --------------------------------------------------------------- */
  function magnetic() {
    if (reduced || !finePointer) return;

    var items = document.querySelectorAll("[data-magnetic]");

    Array.prototype.forEach.call(items, function (el) {
      el.addEventListener("pointermove", function (event) {
        var rect = el.getBoundingClientRect();
        var x = event.clientX - rect.left - rect.width / 2;
        var y = event.clientY - rect.top - rect.height / 2;

        el.style.transform =
          "translate3d(" + (x * 0.22).toFixed(1) + "px," + (y * 0.3).toFixed(1) + "px,0)";
      });

      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------------
     6. Reveal: entrada dos elementos conforme entram na tela
     --------------------------------------------------------------- */
  /* Cada elemento .reveal ganha a classe .is-visible quando aparece.
     O atributo data-reveal escolhe a direção (up, left, right, scale,
     wipe) e o CSS cuida do resto. Elementos criados depois — os cards
     vindos do Supabase — passam por aqui também, via revealWithin(). */
  function makeObserver() {
    return new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var delay = Number(entry.target.dataset.revealDelay || 0);
        setTimeout(function () {
          entry.target.classList.add("is-visible");
        }, delay);

        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
  }

  function revealWithin(root) {
    var scope = root || document;
    var items = scope.querySelectorAll(".reveal:not(.is-visible)");

    if (reduced || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(items, function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = makeObserver();

    // elementos irmãos entram em cascata, não todos de uma vez
    var groups = {};
    Array.prototype.forEach.call(items, function (el) {
      var key = el.parentNode ? (el.parentNode.className || "root") : "root";
      groups[key] = (groups[key] || 0);
      el.dataset.revealDelay = String(Math.min(groups[key] * 90, 450));
      groups[key]++;

      observer.observe(el);
    });
  }

  window.Effects = {
    reduced: reduced,
    finePointer: finePointer,
    revealWithin: revealWithin,
    tilt: tilt,
    init: function () {
      scrollProgress();
      cursorGlow();
      parallax();
      magnetic();
      tilt();
      revealWithin();
    }
  };
})();
