'use strict';

const BaseProtocol = require('./base');

const ESC = 0x1B;
const LF  = 0x0A;
const CR  = 0x0D;
const CLR = 0x0C;

class ESCPOSProtocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(serialPort, config);
  }

  async init() {
    await this.writeToPort(Buffer.from([ESC, 0x40]));
    await this.sleep(50);
  }

  async clear() {
    await this.writeToPort(Buffer.from([CLR]));
    await this.sleep(50);
  }

  async setCursorPosition(row, col) {
    await this.writeToPort(Buffer.from([ESC, 0x6C, col + 1, row + 1]));
  }

  async setBrightness(level) {
    const l = Math.max(0, Math.min(100, level));
    const val = Math.floor(l / 100 * 3);
    await this.writeToPort(Buffer.from([ESC, 0x2A, val]));
    return { success: true };
  }

  async write(text, row = 0) {
    await this.setCursorPosition(row, 0);
    const encoded = this.encodeText(text);
    await this.writeToPort(Buffer.concat([encoded, Buffer.from([CR, LF])]));
  }

  async displayItem(itemName, price, currency) {
    await this.clear();
    const nameStr = this.truncateText(String(itemName || ''), this.columns - 1);
    const priceStr = this.formatPrice(price, currency);
    if (this.rows >= 2) {
      await this.write(nameStr, 0);
      await this.write(this.padText(priceStr, this.columns, 'right'), 1);
    } else {
      const line = this.truncateText(nameStr + ' ' + priceStr, this.columns);
      await this.write(line, 0);
    }
    return { success: true };
  }

  async displayTotal(total, currency) {
    await this.clear();
    const totalStr = this.formatPrice(total, currency);
    if (this.rows >= 2) {
      await this.write(this.padText('TOTAL', this.columns, 'center'), 0);
      await this.write(this.padText(totalStr, this.columns, 'center'), 1);
    } else {
      await this.write(this.padText('TOTAL: ' + totalStr, this.columns, 'center'), 0);
    }
    return { success: true };
  }

  async close() {
  }
}

module.exports = ESCPOSProtocol;
