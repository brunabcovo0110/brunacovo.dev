/* =====================================================================
   lab-3d.js — malha de pontos em 3D desenhada no canvas 2D.

   Não usa Three.js nem nenhuma biblioteca: os pontos ficam distribuídos
   na superfície de uma esfera, giram em torno dos eixos X e Y e são
   achatados na tela por uma projeção em perspectiva simples.

   A matemática toda cabe em três passos:
     1. distribuir os pontos    -> espiral de Fibonacci na esfera
     2. girar                   -> rotação em X e depois em Y
     3. projetar                -> x2d = x * (fov / (fov + z))

   Quanto maior o z (mais longe), menor o divisor, menor o ponto.
   ===================================================================== */

(function () {
  "use strict";

  var POINTS = 130;          // quantidade de pontos na esfera
  var RADIUS = 1;            // raio em unidades de mundo
  var FOV = 3.2;             // distância da câmera: menor = mais perspectiva
  var LINK_DIST = 0.52;      // distância máxima (em mundo) para ligar 2 pontos
  var MAX_DPR = 2;           // teto de densidade de pixels, por performance

  function Lab3D(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud || {};

    this.points = this.buildSphere(POINTS);
    this.rotX = -0.35;
    this.rotY = 0;

    // alvo que o mouse define e a rotação persegue, para o movimento
    // chegar suave em vez de grudar no cursor
    this.targetX = -0.35;
    this.targetY = 0;

    this.spin = 0.0016;       // giro constante, mesmo sem mouse
    this.running = false;
    this.frames = 0;
    this.lastFpsAt = 0;

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);

    this.bind();
    this.resize();
  }

  /* ---------- 1. distribuição ---------- */
  /* Espiral de Fibonacci: espalha N pontos quase uniformemente sobre a
     esfera, sem aglomerar nos polos como aconteceria com lat/long. */
  Lab3D.prototype.buildSphere = function (count) {
    var points = [];
    var golden = Math.PI * (3 - Math.sqrt(5)); // ângulo áureo

    for (var i = 0; i < count; i++) {
      var y = 1 - (i / (count - 1)) * 2;       // de +1 a -1
      var ring = Math.sqrt(1 - y * y);         // raio do anel naquela altura
      var theta = golden * i;

      points.push({
        x: Math.cos(theta) * ring * RADIUS,
        y: y * RADIUS,
        z: Math.sin(theta) * ring * RADIUS
      });
    }

    return points;
  };

  /* ---------- 2. tela ---------- */
  Lab3D.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // a esfera ocupa ~38% da menor dimensão, para respirar nas bordas
    this.scale = Math.min(rect.width, rect.height) * 0.38;
  };

  /* ---------- 3. rotação + projeção ---------- */
  Lab3D.prototype.project = function (point) {
    var cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
    var cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);

    // gira em X
    var y1 = point.y * cosX - point.z * sinX;
    var z1 = point.y * sinX + point.z * cosX;

    // gira em Y
    var x2 = point.x * cosY - z1 * sinY;
    var z2 = point.x * sinY + z1 * cosY;

    // perspectiva: o que está longe encolhe
    var depth = FOV / (FOV + z2);

    return {
      x: this.width / 2 + x2 * this.scale * depth,
      y: this.height / 2 + y1 * this.scale * depth,
      depth: depth,
      z: z2,
      wx: x2, wy: y1, wz: z2
    };
  };

  /* ---------- 4. desenho ---------- */
  Lab3D.prototype.draw = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    var projected = this.points.map(this.project, this);

    // ligações primeiro, para os pontos ficarem por cima
    ctx.lineWidth = 1;
    for (var i = 0; i < projected.length; i++) {
      for (var j = i + 1; j < projected.length; j++) {
        var a = projected[i], b = projected[j];

        var dx = a.wx - b.wx, dy = a.wy - b.wy, dz = a.wz - b.wz;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > LINK_DIST) continue;

        // linha some conforme os pontos se afastam e conforme vão ao fundo
        var near = 1 - dist / LINK_DIST;
        var back = (a.depth + b.depth) / 2;
        var alpha = near * back * 0.42;
        if (alpha < 0.012) continue;

        ctx.strokeStyle = "rgba(56, 189, 248, " + alpha.toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // pontos de trás primeiro, para a sobreposição ficar correta
    projected
      .slice()
      .sort(function (a, b) { return b.z - a.z; })
      .forEach(function (p) {
        var size = Math.max(0.6, p.depth * 1.9);
        var alpha = Math.min(1, Math.max(0.12, (p.depth - 0.6) * 2.2));

        // os pontos da frente ganham um halo ciano
        if (p.depth > 1.02) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = "rgba(34, 211, 238, 0.9)";
          ctx.fillStyle = "rgba(125, 240, 255, " + alpha.toFixed(3) + ")";
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(56, 189, 248, " + (alpha * 0.75).toFixed(3) + ")";
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

    ctx.shadowBlur = 0;
  };

  /* ---------- 5. laço de animação ---------- */
  Lab3D.prototype.frame = function (now) {
    if (!this.running) return;

    // persegue o alvo do mouse com amortecimento
    this.rotX += (this.targetX - this.rotX) * 0.055;
    this.rotY += (this.targetY - this.rotY) * 0.055;
    this.targetY += this.spin; // e segue girando sozinha

    this.draw();
    this.tickFps(now);

    requestAnimationFrame(this.frame);
  };

  Lab3D.prototype.tickFps = function (now) {
    if (!this.hud.fps) return;

    this.frames++;
    if (!this.lastFpsAt) this.lastFpsAt = now;

    if (now - this.lastFpsAt >= 500) {
      var fps = Math.round((this.frames * 1000) / (now - this.lastFpsAt));
      this.hud.fps.textContent = fps + " fps";
      this.frames = 0;
      this.lastFpsAt = now;
    }
  };

  Lab3D.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.lastFpsAt = 0;
    requestAnimationFrame(this.frame);
  };

  Lab3D.prototype.stop = function () {
    this.running = false;
  };

  /* Um quadro só, para quem pediu menos movimento no sistema. */
  Lab3D.prototype.renderStill = function () {
    this.rotX = -0.35;
    this.rotY = 0.6;
    this.draw();
    if (this.hud.fps) this.hud.fps.textContent = "estático";
  };

  /* ---------- 6. entrada do usuário ---------- */
  Lab3D.prototype.pointTo = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();

    // -1 a +1 dentro do canvas
    var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ny = ((clientY - rect.top) / rect.height) * 2 - 1;

    this.targetY = nx * 1.15;
    this.targetX = -0.35 + ny * 0.85;
  };

  Lab3D.prototype.bind = function () {
    var self = this;

    window.addEventListener("resize", this.resize);

    this.canvas.addEventListener("pointermove", function (event) {
      self.pointTo(event.clientX, event.clientY);
    });

    // ao sair, volta devagar para o giro padrão
    this.canvas.addEventListener("pointerleave", function () {
      self.targetX = -0.35;
    });

    this.canvas.addEventListener("touchmove", function (event) {
      if (!event.touches.length) return;
      event.preventDefault(); // não arrasta a página enquanto gira a esfera
      self.pointTo(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: false });
  };

  window.Lab3D = Lab3D;
})();
