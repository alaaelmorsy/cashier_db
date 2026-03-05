'use strict';

const BaseProtocol = require('./base');

const STX = 0x02;
const ETX = 0x03;
const DC2 = 0x12;
const CLR = 0x0C;
const CR  = 0x0D;
const LF  = 0x0A;

class CD5220Protocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(serialPort, config);
  }

  async init() {
    await this.writeToPort(Buffer.from([DC2]));
    await this.sleep(50);
  }

  async clear() {
    await this.writeToPort(Buffer.from([CLR]));
    await this.sleep(50);
  }

  async setCursorPosition(row, col) {
    await this.writeToPort(Buffer.from([STX, 0x47, 0x30 + row, 0x30 + col, ETX]));
  }

  async setBrightness(level) {
    const l = Math.max(0, Math.min(100, level));
    let val;
    if (l <= 25) val = 1;
    else if (l <= 50) val = 2;
    else if (l <= 75) val = 3;
    else val = 4;
    await this.writeToPort(Buffer.from([STX, 0x42, 0x30 + val, ETX]));
    return { success: true };
  }

  async write(text, row = 0) {
    await this.setCursorPosition(row, 0);
    const encoded = this.encodeText(text);
    await this.writeToPort(Buffer.concat([encoded, Buffer.from([CR, LF])]));
  }

  async close() {
  }
}

module.exports = CD5220Protocol;
