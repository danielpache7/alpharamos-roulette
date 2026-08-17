/* =========================================================
   Pruebas unitarias del núcleo lógico (alpha-core.js).
   Se ejecutan igual en el navegador (tests.html) y en Node
   (run-node.js). Cubren SOLO lógica pura: equidad del sorteo,
   parseo de participantes y geometría/rotación de la ruleta.
   ========================================================= */
(function (root, factory) {
  'use strict';
  var api = { register: factory() };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AlphaSpec = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAU = Math.PI * 2;

  /** Generador determinista (mulberry32) para pruebas reproducibles. */
  function seededUint32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0);
    };
  }

  return function register(t, Core) {
    /* ---------- parseParticipants ---------- */
    t.test('parseParticipants recorta espacios e ignora líneas vacías', function () {
      t.deepEq(Core.parseParticipants('  Ana \n\n José  \n   \nLuis'), ['Ana', 'José', 'Luis']);
    });

    t.test('parseParticipants soporta pegado desde Excel (CRLF)', function () {
      t.deepEq(Core.parseParticipants('Ana\r\nJosé\r\nLuis'), ['Ana', 'José', 'Luis']);
    });

    t.test('parseParticipants con entrada no textual devuelve lista vacía', function () {
      t.deepEq(Core.parseParticipants(null), []);
      t.deepEq(Core.parseParticipants(undefined), []);
    });

    /* ---------- activeParticipants ---------- */
    t.test('activeParticipants elimina a los ganadores confirmados', function () {
      t.deepEq(
        Core.activeParticipants('Ana\nJosé\nLuis', ['José']),
        ['Ana', 'Luis']
      );
    });

    t.test('activeParticipants deduplica sin distinguir mayúsculas y conserva el orden', function () {
      t.deepEq(
        Core.activeParticipants('Ana\nana\nANA\nJosé', []),
        ['Ana', 'José']
      );
    });

    t.test('activeParticipants sin participantes devuelve lista vacía', function () {
      t.deepEq(Core.activeParticipants('', []), []);
      t.deepEq(Core.activeParticipants('   \n  \n', []), []);
    });

    /* ---------- segmentAngle ---------- */
    t.test('segmentAngle reparte el círculo en partes iguales', function () {
      t.close(Core.segmentAngle(4), TAU / 4);
      t.close(Core.segmentAngle(8), TAU / 8);
    });

    t.test('segmentAngle con 0 participantes devuelve el círculo completo', function () {
      t.close(Core.segmentAngle(0), TAU);
    });

    /* ---------- randomInt ---------- */
    t.test('randomInt con max <= 0 devuelve 0', function () {
      t.eq(Core.randomInt(0), 0);
      t.eq(Core.randomInt(-5), 0);
    });

    t.test('randomInt aplica el módulo al valor del generador', function () {
      var gen = function () { return 25; };
      t.eq(Core.randomInt(10, gen), 5);
    });

    t.test('randomInt usa muestreo por rechazo para evitar sesgo', function () {
      // 0xFFFFFFFF queda fuera del límite para max=3 y debe rechazarse.
      var seq = [0xffffffff, 7];
      var i = 0;
      var gen = function () { return seq[i++]; };
      t.eq(Core.randomInt(3, gen), 1); // 7 % 3
    });

    t.test('randomInt nunca sale del rango [0, max)', function () {
      var gen = seededUint32(12345);
      for (var k = 0; k < 5000; k++) {
        var v = Core.randomInt(7, gen);
        t.ok(v >= 0 && v < 7, 'valor fuera de rango: ' + v);
      }
    });

    t.test('randomInt es estadísticamente uniforme (equidad del sorteo)', function () {
      var gen = seededUint32(2026);
      var n = 6;
      var draws = 60000;
      var counts = new Array(n).fill(0);
      for (var k = 0; k < draws; k++) counts[Core.randomInt(n, gen)]++;
      var expected = draws / n;
      for (var i = 0; i < n; i++) {
        var dev = Math.abs(counts[i] - expected) / expected;
        t.ok(dev < 0.05, 'sesgo en índice ' + i + ': ' + (dev * 100).toFixed(1) + '%');
      }
    });

    /* ---------- indexUnderPointer ---------- */
    t.test('indexUnderPointer sin participantes devuelve -1', function () {
      t.eq(Core.indexUnderPointer(0, 0), -1);
    });

    t.test('indexUnderPointer devuelve un índice válido', function () {
      for (var n = 1; n <= 20; n++) {
        var idx = Core.indexUnderPointer(Math.random() * TAU, n);
        t.ok(idx >= 0 && idx < n, 'índice inválido para n=' + n);
      }
    });

    /* ---------- computeTargetRotation (representación del resultado) ---------- */
    t.test('computeTargetRotation siempre avanza y da las vueltas pedidas', function () {
      for (var trial = 0; trial < 500; trial++) {
        var n = 1 + Math.floor(Math.random() * 40);
        var winner = Math.floor(Math.random() * n);
        var current = Math.random() * 100;
        var turns = 5 + Math.floor(Math.random() * 2);
        var final = Core.computeTargetRotation(current, winner, n, turns);
        var advance = final - current;
        t.ok(advance >= turns * TAU - 1e-9, 'menos vueltas de las pedidas');
        t.ok(advance < (turns + 1) * TAU + 1e-9, 'demasiadas vueltas');
      }
    });

    t.test('el ganador SIEMPRE cae bajo el puntero (equidad ↔ animación)', function () {
      var sizes = [1, 2, 3, 5, 8, 13, 20, 37, 50, 100];
      for (var s = 0; s < sizes.length; s++) {
        var n = sizes[s];
        for (var winner = 0; winner < n; winner++) {
          var current = Math.random() * TAU;
          var turns = 5 + Math.floor(Math.random() * 2);
          var final = Core.computeTargetRotation(current, winner, n, turns);
          var landed = Core.indexUnderPointer(final, n);
          t.eq(landed, winner, 'n=' + n + ' esperaba ganador ' + winner);
        }
      }
    });
  };
});
