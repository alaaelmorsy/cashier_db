'use strict';

const path = require('node:path');
const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '../src/main/zatca/crypto-worker.js')],
  outfile: path.resolve(__dirname, '../assets/zatca-crypto-worker.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  minify: true,
  legalComments: 'none',
});

