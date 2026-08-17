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
    master: null,
    comp: null,
    makeup: null,
    riser: null,
    cheer: null,
    _noiseBuf: null,

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          // Cadena: master → compresor → makeup → salida.
          // El compresor evita saturación al sumar muchas voces y el makeup
          // sube el volumen percibido para que TODO se escuche con fuerza.
          this.master = this.ctx.createGain();
          this.master.gain.value = 1.0;
          this.comp = this.ctx.createDynamicsCompressor();
          this.comp.threshold.value = -18;
          this.comp.knee.value = 24;
          this.comp.ratio.value = 12;
          this.comp.attack.value = 0.003;
          this.comp.release.value = 0.25;
          this.makeup = this.ctx.createGain();
          this.makeup.gain.value = 1.9;
          this.master.connect(this.comp);
          this.comp.connect(this.makeup);
          this.makeup.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },

    /* ---- helpers de síntesis ---- */
    _noise() {
      if (this._noiseBuf) return this._noiseBuf;
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * 1);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
      return buf;
    },

    _blip(freq, type, t, dur, peak) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.03);
    },

    /* ---- efectos ---- */

    /** Silbido de arranque cuando la ruleta empieza a girar. */
    whoosh() {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(280, t);
      bp.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.65);
    },

    /**
     * Clic de segmento. El tono sube conforme la ruleta se acerca al final
     * (intensity 0→1) para acumular tensión.
     */
    tick(intensity) {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const k = Math.max(0, Math.min(1, intensity || 0));
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 760 + k * 620;
      const vol = 0.1 + k * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.06);
    },

    /** Riser sostenido que crece durante la fase de suspenso final. */
    startRiser() {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx || this.riser) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o2.type = 'sawtooth';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(560, t + 3.2);
      o2.frequency.setValueAtTime(300, t);
      o2.frequency.exponentialRampToValueAtTime(840, t + 3.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 2.6);
      o.connect(g);
      o2.connect(g);
      g.connect(this.master);
      o.start(t);
      o2.start(t);
      this.riser = { o, o2, g };
    },

    stopRiser() {
      if (!this.riser || !this.ctx) return;
      const { o, o2, g } = this.riser;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      try { o.stop(t + 0.25); o2.stop(t + 0.25); } catch (_) {}
      this.riser = null;
    },

    /** Golpe grave de impacto (más un click de ataque). */
    _boom(t, peak) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.72);
      this._blip(120, 'square', t, 0.05, 0.35);
    },

    /** Nota de acorde con osciladores desafinados (más cuerpo). */
    _stab(f, t, dur) {
      const ctx = this.ctx;
      [0, -6, 6].forEach((det) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.05);
      });
    },

    /** "Pop" de fuego artificial: estallido de ruido + chispa aguda. */
    _pop(t) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this._noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200 + Math.random() * 1900;
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.22);
      this._blip(1900 + Math.random() * 1600, 'sine', t + 0.01, 0.16, 0.14);
    },

    /** Ovación / aplausos sostenidos (ruido filtrado con tremolo). */
    startCheer(t, dur) {
      const ctx = this.ensure();
      if (!ctx) return;
      this.stopCheer();
      const end = t + (dur || 3.2);
      const src = ctx.createBufferSource();
      src.buffer = this._noise();
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.26, t + 0.4);
      g.gain.setValueAtTime(0.26, end - 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      // Tremolo → sensación de palmas de multitud.
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 11;
      lfoG.gain.value = 0.12;
      lfo.connect(lfoG).connect(g.gain);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
      lfo.start(t);
      src.stop(end + 0.1);
      lfo.stop(end + 0.1);
      this.cheer = { src, lfo, g };
    },

    stopCheer() {
      if (!this.cheer || !this.ctx) return;
      const { src, lfo, g } = this.cheer;
      const t = this.ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        src.stop(t + 0.3);
        lfo.stop(t + 0.3);
      } catch (_) {}
      this.cheer = null;
    },

    /**
     * Gran celebración multicapa (~3.5 s):
     * doble impacto + fanfarria de acordes + corrida ascendente +
     * cascada de campanas + pops de fuegos + ovación sostenida.
     */
    win() {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;

      // Doble impacto grave.
      this._boom(t0, 0.9);
      this._boom(t0 + 0.5, 0.55);

      // Fanfarria: progresión de acordes triunfal.
      const chords = [
        { t: 0.00, notes: [523.25, 659.25, 783.99] },          // C mayor
        { t: 0.42, notes: [587.33, 698.46, 880.00] },          // Dm/F
        { t: 0.84, notes: [659.25, 830.61, 987.77] },          // E-ish
        { t: 1.26, notes: [523.25, 659.25, 783.99, 1046.5] },  // C + octava
      ];
      chords.forEach((ch) => ch.notes.forEach((f) => this._stab(f, t0 + ch.t, 0.7)));

      // Corrida ascendente triunfal.
      [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1318.5, 1568].forEach((f, i) => {
        this._blip(f, 'triangle', t0 + 1.7 + i * 0.06, 0.32, 0.22);
      });

      // Cascada de campanas brillantes.
      [1568, 1760, 2093, 2637, 3136].forEach((f, i) => {
        this._blip(f, 'sine', t0 + 2.4 + i * 0.09, 0.55, 0.16);
      });

      // Ráfaga de pops de fuegos artificiales.
      for (let i = 0; i < 7; i++) this._pop(t0 + 0.2 + i * 0.32);

      // Ovación sostenida de fondo.
      this.startCheer(t0, 3.6);
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
    running: false,
    interval: 0,
    timers: [],
    colors: ['#0066FF', '#00C2FF', '#2ED67B', '#A256FF', '#FFD166', '#FF5470', '#FFFFFF'],

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
      this.pieces = [];
      this.running = true;

      // Ráfaga inicial abundante desde arriba.
      this.burstTop(260);

      // Primeros estallidos escalonados para el impacto inicial.
      this.clearTimers();
      for (let i = 0; i < 7; i++) {
        this.timers.push(setTimeout(() => {
          if (this.running) this.firework();
        }, 150 + i * 380));
      }
      for (let i = 1; i <= 3; i++) {
        this.timers.push(setTimeout(() => {
          if (this.running) this.burstTop(120);
        }, i * 700));
      }

      // La celebración continúa indefinidamente mientras el modal esté abierto.
      // Cada ciclo genera confeti y un fuego artificial; stop() lo cancela.
      this.interval = setInterval(() => {
        if (!this.running) return;
        this.burstTop(90);
        this.firework();
      }, 1800);

      cancelAnimationFrame(this.raf);
      this.loop();
    },

    clearTimers() {
      this.timers.forEach((id) => clearTimeout(id));
      this.timers = [];
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = 0;
      }
    },

    /** Confeti que cae desde el borde superior (cintas y discos). */
    burstTop(count) {
      const w = this.canvas.width;
      const h = this.canvas.height;
      for (let i = 0; i < count; i++) {
        this.pieces.push({
          x: Math.random() * w,
          y: -20 - Math.random() * h * 0.5,
          r: 4 + Math.random() * 8,
          c: this.colors[randomInt(this.colors.length)],
          vx: -1.6 + Math.random() * 3.2,
          vy: 2 + Math.random() * 4,
          g: 0.04 + Math.random() * 0.05,
          rot: Math.random() * TAU,
          vr: -0.25 + Math.random() * 0.5,
          shape: ['rect', 'circle', 'star'][randomInt(3)],
          life: 0,
          maxLife: 380 + Math.random() * 220,
        });
      }
    },

    /** Explosión radial tipo fuego artificial en la zona superior. */
    firework() {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const cx = w * (0.2 + Math.random() * 0.6);
      const cy = h * (0.15 + Math.random() * 0.35);
      const color = this.colors[randomInt(this.colors.length)];
      const n = 46 + randomInt(26);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + Math.random() * 0.1;
        const speed = 3 + Math.random() * 6;
        this.pieces.push({
          x: cx,
          y: cy,
          r: 2.5 + Math.random() * 3,
          c: Math.random() > 0.35 ? color : '#FFFFFF',
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          g: 0.05,
          rot: 0,
          vr: 0,
          shape: 'spark',
          life: 0,
          maxLife: 60 + Math.random() * 40,
        });
      }
      if (Sound.enabled && Sound.ctx) Sound._pop(Sound.ctx.currentTime);
    },

    loop() {
      const ctx = this.ctx;
      const h = this.canvas.height;
      const w = this.canvas.width;
      ctx.clearRect(0, 0, w, h);

      const next = [];
      for (const p of this.pieces) {
        p.life++;
        p.vy += p.g;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        const lifeLeft = 1 - p.life / p.maxLife;
        if (lifeLeft <= 0 || p.y > h + 30) continue;
        next.push(p);

        const alpha = p.shape === 'spark' ? Math.max(0, lifeLeft) : Math.min(1, lifeLeft * 2.2);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.shape === 'spark') {
          ctx.shadowColor = p.c;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, TAU);
          ctx.fill();
        } else if (p.shape === 'rect') {
          ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.7);
        } else if (p.shape === 'star') {
          this.drawStar(ctx, p.r);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.r / 1.6, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      this.pieces = next;

      // El loop no caduca: la pantalla de celebración permanece viva y
      // sigue generando partículas hasta que Confetti.stop() sea llamado.
      if (this.running) {
        this.raf = requestAnimationFrame(() => this.loop());
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    },

    drawStar(ctx, r) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        const a2 = a + TAU / 10;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
      }
      ctx.closePath();
      ctx.fill();
    },

    stop() {
      this.running = false;
      this.clearTimers();
      cancelAnimationFrame(this.raf);
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },
  };

  /* =======================================================
     Fx — campo de partículas de fondo (Canvas)
     Sutil en reposo; se intensifica mientras la ruleta gira.
     ======================================================= */
  const Fx = {
    canvas: null,
    ctx: null,
    raf: 0,
    dpr: 1,
    w: 0,
    h: 0,
    particles: [],
    intensity: 0,        // valor animado (0 reposo → 1 girando)
    targetIntensity: 0,  // objetivo hacia el que se interpola
    colors: ['#0066FF', '#00C2FF', '#A256FF', '#2ED67B'],

    init(canvas) {
      if (!canvas) return;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.spawn();
      cancelAnimationFrame(this.raf);
      this.loop();
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.w = this.canvas.clientWidth || window.innerWidth;
      this.h = this.canvas.clientHeight || window.innerHeight;
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Reajusta la densidad si cambió mucho el área.
      if (this.particles.length) this.spawn();
    },

    /** Densidad proporcional al área, acotada para no cargar CPU. */
    spawn() {
      const count = Math.max(36, Math.min(120, Math.round((this.w * this.h) / 16000)));
      this.particles = [];
      for (let i = 0; i < count; i++) this.particles.push(this.makeParticle(true));
    },

    makeParticle(anywhere) {
      return {
        x: Math.random() * this.w,
        y: anywhere ? Math.random() * this.h : this.h + 10,
        r: 0.8 + Math.random() * 2.2,
        vy: 0.15 + Math.random() * 0.35,
        sway: 0.3 + Math.random() * 0.8,
        phase: Math.random() * TAU,
        c: this.colors[randomInt(this.colors.length)],
        a: 0.14 + Math.random() * 0.32,
      };
    },

    /** Cambia el estado objetivo; la transición se suaviza en el loop. */
    setSpinning(on) {
      this.targetIntensity = on ? 1 : 0;
    },

    loop() {
      const ctx = this.ctx;
      if (!ctx) return;
      // Interpolación suave hacia la intensidad objetivo.
      this.intensity += (this.targetIntensity - this.intensity) * 0.06;
      const boost = 1 + this.intensity * 4;   // multiplicador de velocidad
      const glow = this.intensity;            // brillo adicional

      ctx.clearRect(0, 0, this.w, this.h);
      for (const p of this.particles) {
        p.phase += 0.01 * boost;
        p.y -= p.vy * boost;
        p.x += Math.sin(p.phase) * p.sway * (0.4 + this.intensity);
        if (p.y < -10) Object.assign(p, this.makeParticle(false));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + this.intensity * 0.8), 0, TAU);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.min(1, p.a * (1 + this.intensity * 1.4));
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 2 + glow * 12;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      this.raf = requestAnimationFrame(() => this.loop());
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
      const turns = 6 + randomInt(3); // 6–8 vueltas completas (más recorrido)
      const startRotation = Wheel.rotation;
      const finalRotation = Core.computeTargetRotation(startRotation, winnerIndex, n, turns);
      const totalRotation = finalRotation - startRotation;

      // Giro largo para crear tensión: arranca veloz y agoniza al final.
      const duration = 8800 + randomInt(1600); // 8.8 – 10.4 s
      const startTime = performance.now();

      let lastIndex = Wheel.indexUnderPointer();
      this.spinning = true;

      // Potencia 5: cola de desaceleración muy prolongada (suspenso al final).
      const easeOut = (t) => 1 - Math.pow(1 - t, 5);

      // Rebote amortiguado al encajar: da sensación física de "clavarse".
      // Oscila dentro del segmento ganador y termina exactamente en el objetivo.
      const settle = () => {
        const settleDur = 640;
        const seg = Wheel.segmentAngle();
        const amp = Math.min(seg * 0.16, 0.09);
        const s0 = performance.now();
        const step = (now) => {
          const p = Math.min((now - s0) / settleDur, 1);
          const wobble = Math.sin(p * Math.PI * 3) * amp * (1 - p);
          Wheel.setRotation(finalRotation + wobble);
          if (p < 1) {
            requestAnimationFrame(step);
          } else {
            Wheel.setRotation(finalRotation);
            this.spinning = false;
            if (onDone) onDone();
          }
        };
        requestAnimationFrame(step);
      };

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
          // Alinea al objetivo y remata con el rebote de asentamiento.
          Wheel.setRotation(finalRotation);
          settle();
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
      Fx.init(this.el.fxCanvas);

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
        'wheel', 'wheelWrap', 'wheelPointer', 'hubSpin',
        'spinBtn', 'spinHint', 'participantsInput', 'participantCount',
        'winnersList', 'clearHistory', 'sidebar', 'sidebarToggle',
        'soundToggle', 'presentationToggle', 'fullscreenToggle', 'resetSession',
        'winnerOverlay', 'confetti', 'winnerName',
        'continueWinner', 'confirmOverlay', 'confirmMessage',
        'confirmYes', 'confirmNo', 'liveRegion', 'solyIdle', 'app', 'fxCanvas',
      ];
      ids.forEach((id) => { this.el[id] = $(id); });
      this.el.app = document.getElementById('app');
    },

    hydrate() {
      this.el.participantsInput.value = Store.state.participantsText;
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

      // Acciones del ganador: el ganador ya fue registrado al revelarse.
      this.el.continueWinner.addEventListener('click', () => this.closeWinner());

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
        this.askConfirm('¿Reiniciar la sesión? Se borrarán participantes y ganadores.', () => {
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
      this.el.app.classList.add('is-spinning');
      this._suspenseOn = false;
      Fx.setSpinning(true);
      Sound.whoosh();
      this.announce('Girando la ruleta…');

      // 3) Animación que representa el resultado.
      Spinner.spinTo(
        winnerIndex,
        (t) => {
          Sound.tick(t);
          this.pulsePointer();
          // Fase de suspenso en la recta final: efectos y riser al máximo.
          if (!this._suspenseOn && t >= 0.72) {
            this._suspenseOn = true;
            this.el.app.classList.add('is-suspense');
            Sound.startRiser();
          }
        },
        () => {
          this.el.wheelWrap.classList.remove('is-spinning');
          this.el.app.classList.remove('is-spinning');
          this.el.app.classList.remove('is-suspense');
          this.el.spinBtn.classList.remove('is-pressed');
          this._suspenseOn = false;
          Fx.setSpinning(false);
          Sound.stopRiser();
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

      // El resultado queda confirmado automáticamente al revelarse. Así el
      // nombre desaparece de la ruleta aunque el ganador no esté presente.
      const normalizedName = name.trim().toLocaleLowerCase();
      const alreadyWon = Store.state.winners.some((winner) => (
        String(winner).trim().toLocaleLowerCase() === normalizedName
      ));
      if (!alreadyWon) {
        Store.state.winners.push(name);
        Store.save();
        this.renderWinners();
        this.refreshWheel();
      }

      this.el.winnerName.textContent = name;
      this.el.winnerOverlay.hidden = false;
      Confetti.start();
      Sound.win();
      this.announce('Tenemos ganador: ' + name);
      this.el.continueWinner.focus();
    },

    closeWinner() {
      this.el.winnerOverlay.hidden = true;
      Confetti.stop();
      Sound.stopCheer();
      this.currentWinner = null;
      this.updateSpinAvailability();
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
        soundOn: Store.state.soundOn,
        presentation: Store.state.presentation,
      };
      Store.save();
      this.el.participantsInput.value = '';
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
