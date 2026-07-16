const { thermalPageSizeForContent } = require('../src/main/report-print');

describe('thermalPageSizeForContent', () => {
  it('extends the thermal page beyond 297mm when report content is taller', () => {
    expect(thermalPageSizeForContent(1600, 80000)).toEqual({
      width: 80000,
      height: 431334,
    });
  });

  it('keeps the standard 297mm minimum for short reports', () => {
    expect(thermalPageSizeForContent(500, 80000)).toEqual({
      width: 80000,
      height: 297000,
    });
  });
});
