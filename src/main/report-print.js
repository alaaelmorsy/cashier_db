const MICRONS_PER_CSS_PIXEL = 25400 / 96;
const MIN_THERMAL_PAGE_HEIGHT_MICRONS = 297000;
const PRINT_BOTTOM_ALLOWANCE_MICRONS = 8000;

function thermalPageSizeForContent(contentHeightPx, widthMicrons) {
  const contentHeightMicrons = Number(contentHeightPx) * MICRONS_PER_CSS_PIXEL;
  const height = Math.max(
    MIN_THERMAL_PAGE_HEIGHT_MICRONS,
    Math.ceil(contentHeightMicrons + PRINT_BOTTOM_ALLOWANCE_MICRONS)
  );

  return { width: Number(widthMicrons), height };
}

module.exports = { thermalPageSizeForContent };
