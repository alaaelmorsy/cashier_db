'use strict';

const BaseProtocol = require('./base');

class ECOPOSProtocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(serialPort, config);
  }

  async init() {
    try {
      this.port.set({ dtr: true, rts: true });
    } catch (_) {}
    await this.sleep(100);
    await this.sendNumber('0.00');
  }

  async clear() {
    await this.sendNumber('0.00');
  }

  async write(text, row = 0) {
    await this.sendNumber(text);
  }

  async setCursorPosition(row, col) {
  }

  async setBrightness(level) {
    return { success: true };
  }

  async close() {
  }

  formatNumber(value) {
    const str = String(value || '0');
    const num = parseFloat(str);
    if (isNaN(num)) return '0';
    if (num === 0) return '0';
    const formatted = num.toFixed(2);
    return formatted.replace(/\.00$/, '');
  }

  async sendNumber(value) {
    const numStr = this.formatNumber(value);
    const formattedData = numStr.padStart(8, ' ') + '\r\n';
    const buffer = Buffer.from(formattedData, 'ascii');
    await this.writeToPort(buffer);
    await this.sleep(50);
  }

  async displayItem(itemName, price, currency) {
    await this.sendNumber(parseFloat(price || 0).toFixed(2));
    return { success: true };
  }

  async displayTotal(total, currency) {
    await this.sendNumber(parseFloat(total || 0).toFixed(2));
    return { success: true };
  }

  async displayWelcome(message) {
    await this.sendNumber('0.00');
    return { success: true };
  }

  async displayThankYou(message) {
    await this.sleep(1000);
    await this.sendNumber('0.00');
    return { success: true };
  }
}

module.exports = ECOPOSProtocol;
