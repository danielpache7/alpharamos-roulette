/* Micro-arnés de pruebas sin dependencias (navegador + Node). */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TestHarness = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fmt(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return JSON.stringify(v);
    return String(v);
  }

  function createRunner() {
    var tests = [];
    var t = {
      test: function (name, fn) { tests.push({ name: name, fn: fn }); },
      ok: function (cond, msg) {
        if (!cond) throw new Error(msg || 'se esperaba un valor verdadero');
      },
      eq: function (actual, expected, msg) {
        if (actual !== expected) {
          throw new Error((msg ? msg + ': ' : '') + 'esperado ' + fmt(expected) + ' pero fue ' + fmt(actual));
        }
      },
      deepEq: function (actual, expected, msg) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error((msg ? msg + ': ' : '') + fmt(actual) + ' != ' + fmt(expected));
        }
      },
      close: function (actual, expected, eps, msg) {
        eps = eps == null ? 1e-9 : eps;
        if (Math.abs(actual - expected) > eps) {
          throw new Error((msg ? msg + ': ' : '') + '|' + actual + ' - ' + expected + '| > ' + eps);
        }
      },
    };

    function run() {
      var results = [];
      for (var i = 0; i < tests.length; i++) {
        try {
          tests[i].fn();
          results.push({ name: tests[i].name, pass: true });
        } catch (e) {
          results.push({ name: tests[i].name, pass: false, error: e.message });
        }
      }
      return results;
    }

    return { t: t, run: run };
  }

  return { createRunner: createRunner };
});
