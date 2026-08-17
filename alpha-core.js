/* =========================================================
   AlphaRamos Roulette — Núcleo lógico puro (sin DOM)
   Reutilizable en el navegador (window.AlphaCore) y en Node
   (module.exports) para poder probarlo con pruebas unitarias.

   Aquí vive SOLO la lógica testeable e imparcial:
     - selección aleatoria sin sesgo
     - parseo y deduplicado de participantes
     - geometría de la ruleta (ángulos, índice bajo el puntero)
     - cálculo de la rotación objetivo del giro

   No contiene animación, Canvas ni acceso al DOM.
   ========================================================= */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api; // Node / pruebas
  }
  if (typeof window !== 'undefined') {
    window.AlphaCore = api; // Navegador
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAU = Math.PI * 2;

  /**
   * Generador uint32 por defecto: usa crypto.getRandomValues cuando existe
   * (navegador o Node moderno) y cae a Math.random como último recurso.
   */
  function defaultUint32() {
    var g = (typeof globalThis !== 'undefined' && globalThis.crypto) ||
            (typeof window !== 'undefined' && window.crypto);
    if (g && typeof g.getRandomValues === 'function') {
      return function () {
        var buf = new Uint32Array(1);
        g.getRandomValues(buf);
        return buf[0];
      };
    }
    return function () {
      return Math.floor(Math.random() * 0x100000000);
    };
  }

  /**
   * Entero aleatorio imparcial en el rango [0, max).
   * Usa muestreo por rechazo para eliminar el sesgo por módulo.
   * @param {number} max  límite superior exclusivo
   * @param {function=} nextU32  generador de uint32 (inyectable para pruebas)
   */
  function randomInt(max, nextU32) {
    if (!(max > 0)) return 0;
    var gen = nextU32 || defaultUint32();
    var limit = Math.floor(0xffffffff / max) * max;
    var v;
    do {
      v = gen() >>> 0;
    } while (v >= limit);
    return v % max;
  }

  /** Normaliza texto libre a una lista de nombres (una por línea). */
  function parseParticipants(raw) {
    if (typeof raw !== 'string') return [];
    return raw
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });
  }

  /**
   * Participantes activos = nombres del texto, sin duplicados
   * (comparación sin distinguir mayúsculas) y sin ganadores confirmados.
   * Conserva el orden de aparición.
   */
  function activeParticipants(text, winners) {
    var all = parseParticipants(text);
    var won = new Set((winners || []).map(function (w) {
      return String(w).trim().toLowerCase();
    }));
    var seen = new Set();
    var result = [];
    for (var i = 0; i < all.length; i++) {
      var name = all[i];
      var key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!won.has(key)) result.push(name);
    }
    return result;
  }

  /** Ángulo (radianes) que ocupa cada segmento para n participantes. */
  function segmentAngle(n) {
    return n > 0 ? TAU / n : TAU;
  }

  /**
   * Índice del segmento que queda bajo el puntero superior (12 en punto)
   * para una rotación dada. Devuelve -1 si no hay participantes.
   *
   * Convención de dibujo: el segmento i cubre
   *   [rotation - PI/2 + i*seg, rotation - PI/2 + (i+1)*seg]
   * y el puntero está fijo en -PI/2.
   */
  function indexUnderPointer(rotation, n) {
    if (n <= 0) return -1;
    var seg = segmentAngle(n);
    var a = (((-rotation) % TAU) + TAU) % TAU;
    return Math.floor(a / seg) % n;
  }

  /**
   * Rotación final para que el CENTRO del segmento ganador quede
   * exactamente bajo el puntero, tras "turns" vueltas completas.
   * El ganador se decide ANTES; esto solo representa ese resultado.
   *
   * @param {number} currentRotation  rotación actual (radianes)
   * @param {number} winnerIndex      índice del ganador ya elegido
   * @param {number} n                total de participantes
   * @param {number} turns            vueltas completas antes de frenar
   * @returns {number} rotación final absoluta (>= currentRotation)
   */
  function computeTargetRotation(currentRotation, winnerIndex, n, turns) {
    var seg = segmentAngle(n);
    var targetMod = ((-(winnerIndex + 0.5) * seg) % TAU + TAU) % TAU;
    var currentMod = ((currentRotation % TAU) + TAU) % TAU;
    var delta = ((targetMod - currentMod) % TAU + TAU) % TAU;
    return currentRotation + turns * TAU + delta;
  }

  return {
    TAU: TAU,
    randomInt: randomInt,
    parseParticipants: parseParticipants,
    activeParticipants: activeParticipants,
    segmentAngle: segmentAngle,
    indexUnderPointer: indexUnderPointer,
    computeTargetRotation: computeTargetRotation,
  };
});
