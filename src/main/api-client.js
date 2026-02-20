const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');

const API_TIMEOUT = 8000;
const API_RETRIES = 2;

const _keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 10, timeout: 60000 });

function _isNetworkError(err) {
  if (err && err.response) return false;
  const code = err && (err.code || (err.cause && err.cause.code));
  return !code || ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ECONNREFUSED', 'ENETUNREACH', 'ERR_NETWORK'].includes(code);
}

async function _withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= API_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!_isNetworkError(err) || attempt >= API_RETRIES) break;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const DEFAULT_MODE = 'primary';
const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 4310;

let CONFIG_PATH;
try {
  const { app } = require('electron');
  CONFIG_PATH = app ? path.join(app.getPath('userData'), 'device-config.json') : null;
} catch (_) { CONFIG_PATH = null; }

if (!CONFIG_PATH) {
  const appRoot = path.resolve(__dirname, '..', '..');
  CONFIG_PATH = path.join(appRoot, 'app', 'device-config.json');
}

let deviceConfig = {
  mode: DEFAULT_MODE,
  api_host: DEFAULT_API_HOST,
  api_port: DEFAULT_API_PORT,
};

function loadDeviceConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      deviceConfig = { ...deviceConfig, ...saved };
    }
  } catch (_) { }
}

function saveDeviceConfig() {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(deviceConfig, null, 2), 'utf-8');
  } catch (_) { }
}

loadDeviceConfig();

function getDeviceMode() {
  return deviceConfig.mode || DEFAULT_MODE;
}

function setDeviceMode(mode, api_host, api_port) {
  deviceConfig.mode = mode || DEFAULT_MODE;
  if (api_host) deviceConfig.api_host = api_host;
  if (api_port) deviceConfig.api_port = api_port;
  saveDeviceConfig();
  return deviceConfig;
}

function isPrimaryDevice() {
  return getDeviceMode() === 'primary';
}

function isSecondaryDevice() {
  return getDeviceMode() === 'secondary';
}

function getApiBaseUrl() {
  const host = deviceConfig.api_host || DEFAULT_API_HOST;
  const port = deviceConfig.api_port || DEFAULT_API_PORT;
  return `http://${host}:${port}/api`;
}

async function fetchFromAPI(endpoint, params = {}) {
  const url = `${getApiBaseUrl()}${endpoint}`;
  return _withRetry(async () => {
    try {
      const response = await axios.get(url, { params, timeout: API_TIMEOUT, httpAgent: _keepAliveAgent });
      return response.data;
    } catch (err) {
      throw new Error(`API fetch failed: ${err.message}`);
    }
  });
}

async function postToAPI(endpoint, body = {}) {
  const url = `${getApiBaseUrl()}${endpoint}`;
  try {
    const response = await axios.post(url, body, { timeout: API_TIMEOUT, httpAgent: _keepAliveAgent });
    return response.data;
  } catch (err) {
    throw new Error(`API post failed: ${err.message}`);
  }
}

async function putToAPI(endpoint, body = {}) {
  const url = `${getApiBaseUrl()}${endpoint}`;
  try {
    const response = await axios.put(url, body, { timeout: API_TIMEOUT, httpAgent: _keepAliveAgent });
    return response.data;
  } catch (err) {
    throw new Error(`API put failed: ${err.message}`);
  }
}

async function deleteFromAPI(endpoint) {
  const url = `${getApiBaseUrl()}${endpoint}`;
  try {
    const response = await axios.delete(url, { timeout: API_TIMEOUT, httpAgent: _keepAliveAgent });
    return response.data;
  } catch (err) {
    throw new Error(`API delete failed: ${err.message}`);
  }
}

module.exports = {
  getDeviceMode,
  setDeviceMode,
  isPrimaryDevice,
  isSecondaryDevice,
  getApiBaseUrl,
  fetchFromAPI,
  postToAPI,
  putToAPI,
  deleteFromAPI,
  getDeviceConfig: () => deviceConfig,
};
