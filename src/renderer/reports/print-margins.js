// Apply print margins from Settings across reports
// - Reads print_margin_left_mm and print_margin_right_mm via window.api.settings_get()
// - Sets CSS variables --m-left and --m-right on :root so @media print can use them
(function(){
  async function applyPrintMarginsFromSettings(){
    try{
      const api = (window.api) || (window.opener && window.opener.api) || null;
      if(!api || typeof api.settings_get !== 'function') return;
      const r = await api.settings_get();
      const st = (r && r.ok) ? (r.item||{}) : (r||{});
      const ml = Math.max(0, Number(st.print_margin_left_mm||0));
      const mr = Math.max(0, Number(st.print_margin_right_mm||0));
      document.documentElement.style.setProperty('--m-left', ml + 'mm');
      document.documentElement.style.setProperty('--m-right', mr + 'mm');
    }catch(_){ /* ignore */ }
  }
  // Expose for manual re-application before export/print if needed
  try{ window.applyPrintMarginsFromSettings = applyPrintMarginsFromSettings; }catch(_){ }
  // Apply on DOM ready
  try{ document.addEventListener('DOMContentLoaded', applyPrintMarginsFromSettings); }catch(_){ }
})();