/* =========================================================
   AlphaRamos Roulette — Hackathon 2026
   JavaScript Vanilla · 100% offline · sin dependencias.

   Arquitectura (separación de responsabilidades):
     - Store      : estado + persistencia en localStorage
     - Wheel       : render de la ruleta en Canvas
     - Spinner     : lógica de giro (selección imparcial + animación)
     - Confetti    : celebración en Canvas
     - Sound       : efectos con WebAudio (sin archivos externos)
     - UI          : enlaza DOM, eventos y flujo
   ========================================================= */
(function () {
  'use strict';

  /* =======================================================
     Utilidades
     ======================================================= */
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;

  // Núcleo lógico puro (alpha-core.js). Debe cargarse antes que app.js.
  const Core = window.AlphaCore;

  const randomInt = Core.randomInt;
  const parseParticipants = Core.parseParticipants;

  /* =======================================================
     Store — estado y persistencia
     ======================================================= */
  const STORAGE_KEY = 'alpharamos-roulette:v1';

  const Store = {
    state: {
      participantsText: '',
      winners: [],
      prize: '',
      soundOn: true,
      presentation: false,
    },

    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && typeof saved === 'object') {
          Object.assign(this.state, saved);
        }
      } catch (_) {
        /* Datos corruptos: se ignoran y se parte de cero. */
      }
      return this.state;
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (_) {
        /* Sin persistencia disponible: la app sigue funcionando en memoria. */
      }
    },

    /** Participantes activos = texto - ganadores confirmados. */
    activeParticipants() {
      return Core.activeParticipants(this.state.participantsText, this.state.winners);
    },
  };

  /* =======================================================
     Paleta de segmentos (inspirada en AlphaRamos)
     ======================================================= */
  const SEGMENT_COLORS = [
    { from: '#0066FF', to: '#0A2E7A' }, // azul eléctrico
    { from: '#00C2FF', to: '#065A78' }, // cyan
    { from: '#151922', to: '#0B0D12' }, // azul muy oscuro
    { from: '#A256FF', to: '#4B208C' }, // morado
    { from: '#2ED67B', to: '#125E3A' }, // verde
  ];
  const SEGMENT_TEXT = '#FFFFFF';

  /* =======================================================
     Wheel — render en Canvas
     ======================================================= */
  const Wheel = {
    canvas: null,
    ctx: null,
    dpr: 1,
    size: 900,
    names: [],
    rotation: 0, // radianes

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },

    resize() {
      const wrap = this.canvas.closest('.wheel-wrap');
      const area = this.canvas.closest('.wheel-area');
      // Lado del cuadrado = menor dimensión disponible del área de la ruleta.
      let cssSize = 700;
      if (area) {
        const w = area.clientWidth;
        const h = area.clientHeight;
        if (w > 0 && h > 0) cssSize = Math.max(220, Math.min(w, h));
      }
      if (wrap) {
        wrap.style.width = cssSize + 'px';
        wrap.style.height = cssSize + 'px';
      }
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.size = Math.round(cssSize * this.dpr);
      this.canvas.width = this.size;
      this.canvas.height = this.size;
      this.render();
    },

    setNames(names) {
      this.names = names;
      this.render();
    },

    setRotation(rad) {
      this.rotation = rad;
      this.render();
    },

    /** Ángulo (en radianes) que ocupa cada segmento. */
    segmentAngle() {
      return Core.segmentAngle(this.names.length);
    },

    render() {
      const ctx = this.ctx;
      if (!ctx) return;
      const s = this.size;
      const cx = s / 2;
      const cy = s / 2;
      const r = s / 2 - Math.round(s * 0.02);

      ctx.clearRect(0, 0, s, s);

      const names = this.names;
      const n = names.length;

      // Anillo exterior luminoso.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + s * 0.006, 0, TAU);
      ctx.lineWidth = s * 0.018;
      ctx.strokeStyle = 'rgba(0, 194, 255, 0.55)';
      ctx.shadowColor = 'rgba(0, 194, 255, 0.6)';
      ctx.shadowBlur = s * 0.02;
      ctx.stroke();
      ctx.restore();

      if (n === 0) {
        this.drawEmpty(ctx, cx, cy, r, s);
        return;
      }

      const seg = this.segmentAngle();
      const font = this.pickFontSize(n, r);

      for (let i = 0; i < n; i++) {
        // El puntero está arriba (-90°). El segmento i inicia en:
        const start = this.rotation - Math.PI / 2 + i * seg;
        const end = start + seg;

        // Sector con degradado radial.
        const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        const grad = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
        grad.addColorStop(0, color.from);
        grad.addColorStop(1, color.to);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Separador fino entre segmentos.
        ctx.lineWidth = Math.max(1, s * 0.0016);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.stroke();

        // Texto radial.
        this.drawLabel(ctx, names[i], cx, cy, r, start + seg / 2, font, seg);
      }

      // Borde interior sutil.
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.lineWidth = s * 0.004;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.stroke();
    },

    drawLabel(ctx, name, cx, cy, r, mid, fontSize, seg) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = SEGMENT_TEXT;
      ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = fontSize * 0.28;

      // El texto se ancla en el borde exterior y crece hacia el centro,
      // manteniéndose despejado del hub central.
      const outer = r * 0.95;
      const maxWidth = r * 0.68;
      const label = this.fitText(ctx, name, maxWidth);

      // En la mitad izquierda de la rueda el texto quedaría boca abajo:
      // se voltea 180° para que siempre sea legible desde fuera.
      const onLeft = Math.cos(mid) < 0;
      if (onLeft) {
        ctx.rotate(Math.PI);
        ctx.textAlign = 'left';
        ctx.fillText(label, -outer, 0);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(label, outer, 0);
      }
      ctx.restore();
    },

    /** Trunca con puntos suspensivos si el nombre no cabe. */
    fitText(ctx, text, maxWidth) {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let t = text;
      while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
        t = t.slice(0, -1);
      }
      return t + '…';
    },

    /** Tamaño de fuente adaptativo según número de participantes. */
    pickFontSize(n, r) {
      // Fuente grande con pocos participantes; se reduce al crecer la lista.
      if (n <= 8) return r * 0.092;
      if (n <= 14) return r * 0.078;
      if (n <= 22) return r * 0.062;
      if (n <= 34) return r * 0.05;
      return Math.max(r * 0.03, r * 1.4 / n);
    },

    drawEmpty(ctx, cx, cy, r, s) {
      const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, '#151922');
      grad.addColorStop(1, '#0B0D12');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = grad;
      ctx.fill();

      // Texto por debajo del hub central para que sea legible.
      ctx.fillStyle = 'rgba(229,230,230,0.65)';
      ctx.font = `600 ${s * 0.034}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Agrega participantes', cx, cy + s * 0.20);
      ctx.fillStyle = 'rgba(229,230,230,0.4)';
      ctx.font = `400 ${s * 0.024}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText('en el panel lateral', cx, cy + s * 0.255);
    },

    /** Índice del segmento actualmente bajo el puntero superior. */
    indexUnderPointer() {
      return Core.indexUnderPointer(this.rotation, this.names.length);
    },
  };

  /* =======================================================
     Sound — efectos con WebAudio (sin archivos)
     ======================================================= */
  const Sound = {
    ctx: null,
    enabled: true,

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },

    tick() {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.06);
    },

    win() {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
      notes.forEach((f, i) => {
        const t = ctx.currentTime + i * 0.12;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.42);
      });
    },
  };

  /* =======================================================
     Confetti — celebración en Canvas
     ======================================================= */
  const Confetti = {
    canvas: null,
    ctx: null,
    pieces: [],
    raf: 0,
    colors: ['#0066FF', '#00C2FF', '#2ED67B', '#A256FF', '#FFFFFF'],

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    },

    resize() {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
    },

    start() {
      this.resize();
      const w = this.canvas.width;
      const count = 180;
      this.pieces = [];
      for (let i = 0; i < count; i++) {
        this.pieces.push({
          x: Math.random() * w,
          y: -20 - Math.random() * this.canvas.height,
          r: 4 + Math.random() * 7,
          c: this.colors[randomInt(this.colors.length)],
          vy: 2 + Math.random() * 4,
          vx: -1.5 + Math.random() * 3,
          rot: Math.random() * TAU,
          vr: -0.2 + Math.random() * 0.4,
          shape: Math.random() > 0.5 ? 'rect' : 'circle',
        });
      }
      cancelAnimationFrame(this.raf);
      this.loop();
    },

    loop() {
      const ctx = this.ctx;
      const h = this.canvas.height;
      const w = this.canvas.width;
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of this.pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vr;
        if (p.y < h + 20) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.r / 1.6, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive > 0) {
        this.raf = requestAnimationFrame(() => this.loop());
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    },

    stop() {
      cancelAnimationFrame(this.raf);
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },
  };

  /* =======================================================
     Spinner — selección imparcial + animación
     ======================================================= */
  const Spinner = {
    spinning: false,

    /**
     * Gira la ruleta hasta un ganador elegido ANTES de animar.
     * @param {number} winnerIndex índice del ganador ya seleccionado
     * @param {function} onTick     callback al cruzar un segmento
     * @param {function} onDone     callback al terminar
     */
    spinTo(winnerIndex, onTick, onDone) {
      const n = Wheel.names.length;

      // Rotación objetivo calculada por el núcleo: el ganador (ya elegido)
      // queda exactamente bajo el puntero tras varias vueltas completas.
      const turns = 5 + randomInt(2); // 5–6 vueltas completas
      const startRotation = Wheel.rotation;
      const finalRotation = Core.computeTargetRotation(startRotation, winnerIndex, n, turns);
      const totalRotation = finalRotation - startRotation;

      const duration = 5600 + randomInt(900); // 5.6 – 6.5 s
      const startTime = performance.now();

      let lastIndex = Wheel.indexUnderPointer();
      this.spinning = true;

      const easeOut = (t) => 1 - Math.pow(1 - t, 4); // desaceleración natural

      const frame = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeOut(t);
        Wheel.setRotation(startRotation + totalRotation * eased);

        const idx = Wheel.indexUnderPointer();
        if (idx !== lastIndex) {
          lastIndex = idx;
          if (onTick) onTick(t);
        }

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          // Alinea exactamente al objetivo (elimina error de coma flotante).
          Wheel.setRotation(startRotation + totalRotation);
          this.spinning = false;
          if (onDone) onDone();
        }
      };
      requestAnimationFrame(frame);
    },
  };

  /* =======================================================
     UI — enlace del DOM y flujo de la aplicación
     ======================================================= */
  const UI = {
    el: {},
    pendingConfirm: null,

    init() {
      Store.load();
      Sound.enabled = Store.state.soundOn;

      this.cache();
      Wheel.init(this.el.wheel);
      Confetti.init(this.el.confetti);

      this.bind();
      this.hydrate();
      this.refreshWheel();
      this.renderWinners();
      this.applyPresentation(Store.state.presentation);
      this.updateSpinAvailability();

      // Recalcula el tamaño de la ruleta una vez el layout está listo.
      requestAnimationFrame(() => Wheel.resize());
    },

    cache() {
      const ids = [
        'prizeInput', 'wheel', 'wheelWrap', 'wheelPointer', 'hubSpin',
        'spinBtn', 'spinHint', 'participantsInput', 'participantCount',
        'winnersList', 'clearHistory', 'sidebar', 'sidebarToggle',
        'soundToggle', 'presentationToggle', 'fullscreenToggle', 'resetSession',
        'winnerOverlay', 'confetti', 'winnerName', 'winnerPrize', 'winnerPrizeValue',
        'confirmWinner', 'repeatDraw', 'confirmOverlay', 'confirmMessage',
        'confirmYes', 'confirmNo', 'liveRegion', 'solyIdle', 'app',
      ];
      ids.forEach((id) => { this.el[id] = $(id); });
      this.el.app = document.getElementById('app');
    },

    hydrate() {
      this.el.participantsInput.value = Store.state.participantsText;
      this.el.prizeInput.value = Store.state.prize;
      this.el.soundToggle.setAttribute('aria-pressed', String(Store.state.soundOn));
      this.gracefulImages();
    },

    /** Oculta imágenes de Soly que no puedan cargarse (sin romper el diseño). */
    gracefulImages() {
      document.querySelectorAll('.soly-img').forEach((img) => {
        img.addEventListener('error', () => {
          const fig = img.closest('.soly');
          if (fig) fig.style.display = 'none';
        });
      });
    },

    bind() {
      // Participantes: actualización inmediata de la ruleta.
      this.el.participantsInput.addEventListener('input', () => {
        Store.state.participantsText = this.el.participantsInput.value;
        Store.save();
        // Evita reordenar la ruleta a mitad de un giro (mantiene la equidad).
        if (Spinner.spinning) return;
        this.refreshWheel();
        this.updateSpinAvailability();
      });

      // Premio.
      this.el.prizeInput.addEventListener('input', () => {
        Store.state.prize = this.el.prizeInput.value.trim();
        Store.save();
      });

      // Girar: botón, hub y barra espaciadora.
      this.el.spinBtn.addEventListener('click', () => this.startSpin());
      this.el.hubSpin.addEventListener('click', () => this.startSpin());
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !this.isTyping(e.target) && !this.isModalOpen()) {
          e.preventDefault();
          this.startSpin();
        }
        if (e.key === 'Escape') this.closeConfirm();
      });

      // Acciones del ganador.
      this.el.confirmWinner.addEventListener('click', () => this.confirmWinner());
      this.el.repeatDraw.addEventListener('click', () => this.closeWinner());

      // Historial.
      this.el.clearHistory.addEventListener('click', () => {
        this.askConfirm('¿Limpiar todo el historial de ganadores?', () => {
          Store.state.winners = [];
          Store.save();
          this.renderWinners();
          this.refreshWheel();
          this.updateSpinAvailability();
        });
      });

      // Sonido.
      this.el.soundToggle.addEventListener('click', () => {
        Sound.enabled = !Sound.enabled;
        Store.state.soundOn = Sound.enabled;
        Store.save();
        this.el.soundToggle.setAttribute('aria-pressed', String(Sound.enabled));
        if (Sound.enabled) Sound.tick();
      });

      // Modo presentación.
      this.el.presentationToggle.addEventListener('click', () => {
        this.applyPresentation(!Store.state.presentation);
      });

      // Pantalla completa.
      this.el.fullscreenToggle.addEventListener('click', () => this.toggleFullscreen());

      // Reiniciar sesión.
      this.el.resetSession.addEventListener('click', () => {
        this.askConfirm('¿Reiniciar la sesión? Se borrarán participantes, ganadores y premio.', () => {
          this.resetSession();
        });
      });

      // Sidebar (móvil).
      this.el.sidebarToggle.addEventListener('click', () => {
        this.el.sidebar.classList.toggle('open');
      });

      // Confirmación genérica.
      this.el.confirmYes.addEventListener('click', () => {
        const fn = this.pendingConfirm;
        this.closeConfirm();
        if (fn) fn();
      });
      this.el.confirmNo.addEventListener('click', () => this.closeConfirm());

      // Reajustar confetti al cambiar tamaño mientras se muestra.
      window.addEventListener('resize', () => {
        if (!this.el.winnerOverlay.hidden) Confetti.resize();
      });
    },

    isTyping(target) {
      return target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
    },
    isModalOpen() {
      return !this.el.winnerOverlay.hidden || !this.el.confirmOverlay.hidden;
    },

    refreshWheel() {
      const active = Store.activeParticipants();
      Wheel.setNames(active);
      this.el.participantCount.textContent = String(active.length);
    },

    updateSpinAvailability() {
      const canSpin = Store.activeParticipants().length > 0 && !Spinner.spinning;
      this.el.spinBtn.disabled = !canSpin;
      this.el.hubSpin.disabled = !canSpin;
    },

    /* -------- Flujo de giro -------- */
    startSpin() {
      if (Spinner.spinning) return; // impide giros simultáneos
      const active = Store.activeParticipants();
      if (active.length === 0) return;

      Sound.ensure(); // desbloquea audio con la interacción del usuario

      // 1) Selección imparcial del ganador ANTES de animar.
      const winnerIndex = randomInt(active.length);
      const winnerName = active[winnerIndex];

      // 2) Bloqueo de la UI.
      this.el.spinBtn.disabled = true;
      this.el.hubSpin.disabled = true;
      this.el.spinBtn.classList.add('is-pressed');
      this.el.wheelWrap.classList.add('is-spinning');
      this.announce('Girando la ruleta…');

      // 3) Animación que representa el resultado.
      Spinner.spinTo(
        winnerIndex,
        () => { Sound.tick(); this.pulsePointer(); },
        () => {
          this.el.wheelWrap.classList.remove('is-spinning');
          this.el.spinBtn.classList.remove('is-pressed');
          this.showWinner(winnerName);
          this.updateSpinAvailability();
        }
      );
    },

    pulsePointer() {
      const p = this.el.wheelPointer;
      p.classList.remove('tick');
      void p.offsetWidth; // reinicia la animación
      p.classList.add('tick');
    },

    /* -------- Pantalla de ganador -------- */
    showWinner(name) {
      this.currentWinner = name;
      this.el.winnerName.textContent = name;

      const prize = Store.state.prize;
      if (prize) {
        this.el.winnerPrizeValue.textContent = prize;
        this.el.winnerPrize.hidden = false;
      } else {
        this.el.winnerPrize.hidden = true;
      }

      this.el.winnerOverlay.hidden = false;
      Confetti.start();
      Sound.win();
      this.announce('Tenemos ganador: ' + name);
      this.el.confirmWinner.focus();
    },

    closeWinner() {
      this.el.winnerOverlay.hidden = true;
      Confetti.stop();
      this.currentWinner = null;
      this.updateSpinAvailability();
    },

    confirmWinner() {
      if (this.currentWinner) {
        Store.state.winners.push(this.currentWinner);
        Store.save();
        this.renderWinners();
        this.refreshWheel();
      }
      this.closeWinner();
    },

    renderWinners() {
      const list = this.el.winnersList;
      const winners = Store.state.winners;
      list.innerHTML = '';
      if (winners.length === 0) {
        const li = document.createElement('li');
        li.className = 'winners-empty';
        li.textContent = 'Aún no hay ganadores confirmados.';
        list.appendChild(li);
        return;
      }
      winners.forEach((name) => {
        const li = document.createElement('li');
        li.textContent = name;
        list.appendChild(li);
      });
    },

    /* -------- Presentación / fullscreen -------- */
    applyPresentation(on) {
      Store.state.presentation = on;
      Store.save();
      this.el.app.classList.toggle('presentation', on);
      this.el.presentationToggle.setAttribute('aria-pressed', String(on));
      // El canvas debe recalcular su tamaño tras cambiar el layout.
      requestAnimationFrame(() => Wheel.resize());
    },

    toggleFullscreen() {
      const doc = document;
      const el = doc.documentElement;
      if (!doc.fullscreenElement) {
        (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
      } else {
        (doc.exitFullscreen || doc.webkitExitFullscreen || function () {}).call(doc);
      }
    },

    resetSession() {
      Store.state = {
        participantsText: '',
        winners: [],
        prize: '',
        soundOn: Store.state.soundOn,
        presentation: Store.state.presentation,
      };
      Store.save();
      this.el.participantsInput.value = '';
      this.el.prizeInput.value = '';
      this.refreshWheel();
      this.renderWinners();
      this.updateSpinAvailability();
    },

    /* -------- Confirmación genérica -------- */
    askConfirm(message, onYes) {
      this.el.confirmMessage.textContent = message;
      this.pendingConfirm = onYes;
      this.el.confirmOverlay.hidden = false;
      this.el.confirmNo.focus();
    },
    closeConfirm() {
      this.el.confirmOverlay.hidden = true;
      this.pendingConfirm = null;
    },

    announce(msg) {
      this.el.liveRegion.textContent = msg;
    },
  };

  /* Arranque cuando el DOM está listo. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UI.init());
  } else {
    UI.init();
  }
})();
