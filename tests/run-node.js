/* Ejecuta las pruebas del núcleo en Node:  node tests/run-node.js */
'use strict';
var Core = require('../alpha-core.js');
var harness = require('./harness.js');
var spec = require('./spec.js');

var runner = harness.createRunner();
spec.register(runner.t, Core);
var results = runner.run();

var passed = 0;
results.forEach(function (r) {
  if (r.pass) {
    passed++;
    console.log('\u2713 ' + r.name);
  } else {
    console.log('\u2717 ' + r.name + '\n   \u2192 ' + r.error);
  }
});

console.log('\n' + passed + '/' + results.length + ' pruebas superadas');
process.exit(passed === results.length ? 0 : 1);
