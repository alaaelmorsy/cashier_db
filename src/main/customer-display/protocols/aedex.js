'use strict';

const BaseProtocol = require('./base');

const SOH = 0x01;
const STX = 0x02;
const ETX = 0x03;
const EOT = 0x04;
const CLR = 0x0C;

class AEDEXProtocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(serialPort, config);
  }

  async init() {
    await this.writeToPort(Buffer.from([SOH, 0x30, 0x30]));
    await this.sleep(50);
  }

  async clear() {
    await this.writeToPort(Buffer.from([CLR]));
    await this.sleep(50);
  }

  async setCursorPosition(row, col) {
    const rowChar = String(row).charCodeAt(0);
    const colChar = String(col).charCodeAt(0);
    await this.writeToPort(Buffer.from([SOH, rowChar, colChar]));
  }

  async setBrightness(level) {
    const l = Math.max(0, Math.min(100, level));
    const val = Math.floor(l / 100 * 7) + 1;
    await this.writeToPort(Buffer.from([SOH, 0x42, 0x30 + val]));
    return { success: true };
  }

  async write(text, row = 0) {
    await this.setCursorPosition(row, 0);
    const encoded = this.encodeText(text);
    const buf = Buffer.alloc(encoded.length + 2);
    buf[0] = STX;
    encoded.copy(buf, 1);
    buf[encoded.length + 1] = ETX;
    await this.writeToPort(buf);
  }

  async close() {
    await this.clear();
    await this.writeToPort(Buffer.from([EOT]));
  }
}

module.exports = AEDEXProtocol;
