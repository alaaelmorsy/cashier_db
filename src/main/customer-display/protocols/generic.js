'use strict';

const BaseProtocol = require('./base');

const CR = 0x0D;
const LF = 0x0A;

class GenericProtocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(serialPort, config);
  }

  async init() {
    await this.clear();
  }

  async clear() {
    for (let i = 0; i < this.rows; i++) {
      const spaces = ' '.repeat(this.columns);
      const encoded = this.encodeText(spaces);
      await this.writeToPort(Buffer.concat([encoded, Buffer.from([CR, LF])]));
    }
  }

  async write(text, row = 0) {
    const encoded = this.encodeText(String(text || ''));
    await this.writeToPort(Buffer.concat([encoded, Buffer.from([CR, LF])]));
  }

  async setCursorPosition(row, col) {
  }

  async setBrightness(level) {
    return { success: true };
  }

  async close() {
  }
}

module.exports = GenericProtocol;
