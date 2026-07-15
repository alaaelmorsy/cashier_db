'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const WORKER_TIMEOUT_MS = 60000;

function defaultRuntimePaths() {
  if (process.versions.electron && process.resourcesPath && !process.defaultApp) {
    return {
      nodePath: path.join(process.resourcesPath, 'runtime', 'node.exe'),
      workerPath: path.join(process.resourcesPath, 'assets', 'zatca-crypto-worker.cjs'),
    };
  }
  return {
    nodePath: path.resolve(__dirname, '../../../node_modules/node-win-x64/bin/node.exe'),
    workerPath: path.resolve(__dirname, 'crypto-worker.js'),
  };
}

function boundedOutput(child) {
  let output = '';
  let exceeded = false;
  return {
    append(chunk) {
      if (Buffer.byteLength(output) + chunk.length > MAX_OUTPUT_BYTES) {
        exceeded = true;
        child.kill();
      } else {
        output += chunk.toString('utf8');
      }
    },
    exceeded: () => exceeded,
    text: () => output,
  };
}

function parseWorkerResponse(output) {
  try {
    return JSON.parse(output);
  } catch (_) {
    throw new Error('تعذر قراءة استجابة محرك تشفير ZATCA');
  }
}

function cryptoWorkerError(response) {
  const error = new Error(response.error?.message || 'فشلت عملية التشفير الخاصة بـ ZATCA');
  error.code = response.error?.code || 'ZATCA_CRYPTO_ERROR';
  return error;
}

function runCryptoAction(action, payload, runtime = defaultRuntimePaths()) {
  return new Promise((resolve, reject) => {
    const child = spawn(runtime.nodePath, [runtime.workerPath], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = boundedOutput(child);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, WORKER_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => stdout.append(chunk));
    child.stderr.resume();
    child.on('error', () => reject(new Error('تعذر تشغيل محرك التشفير الخاص بـ ZATCA')));
    child.on('close', () => {
      clearTimeout(timeout);
      if (timedOut) return reject(new Error('انتهت مهلة محرك تشفير ZATCA'));
      if (stdout.exceeded()) return reject(new Error('استجابة محرك تشفير ZATCA أكبر من الحد المسموح'));
      let response;
      try { response = parseWorkerResponse(stdout.text()); } catch (error) { return reject(error); }
      if (!response.ok) return reject(cryptoWorkerError(response));
      resolve(response.result);
    });
    child.stdin.end(JSON.stringify({ action, payload }));
  });
}

module.exports = { defaultRuntimePaths, runCryptoAction };
