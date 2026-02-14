// Web Worker for heavy calculations to avoid blocking the main thread
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  try {
    switch(type) {
      case 'computeTotals':
        const result = computeTotalsInWorker(data);
        self.postMessage({ type: 'computeTotalsResult', result });
        break;
      
      case 'computeQtyOfferDiscounts':
        const qtyResult = computeQtyOfferDiscountsInWorker(data);
        self.postMessage({ type: 'computeQtyOfferDiscountsResult', result: qtyResult });
        break;
      
      default:
        self.postMessage({ type: 'error', error: 'Unknown task type' });
    }
  } catch(error) {
    self.postMessage({ type: 'error', error: error.message || String(error) });
  }
};

function computeTotalsInWorker(data) {
  const { cart, settings, extraValue, discountType, discountValue, coupon, globalOffer, qtyRulesCache } = data;
  
  let sub = 0;
  let vat = 0;
  let grand = 0;
  const vatPct = (Number(settings.vat_percent) || 0) / 100;

  // إجمالي قبل الضريبة من عناصر السلة
  cart.forEach(item => {
    const price = Number(item.price || 0);
    const qty = Number(item.qty || 1);
    if(settings.prices_include_vat){
      const base = price / (1 + vatPct);
      sub += base * qty;
    } else {
      sub += price * qty;
    }
  });

  // الإضافى قبل الضريبة
  const extra = Math.max(0, Number(extraValue || 0));
  const itemsSub = sub;
  sub += extra;

  // حساب خصم عروض الكمية
  let qtyOffersDiscount = 0;
  if(Array.isArray(cart) && cart.length && qtyRulesCache){
    const groups = new Map();
    cart.forEach(it => {
      const pid = Number(it.id || it.product_id || 0);
      if(!pid) return;
      const opid = (it.operation_id != null && it.operation_id !== '') ? Number(it.operation_id) : null;
      const key = pid + '|' + (opid == null ? 'null' : String(opid));
      if(!groups.has(key)) groups.set(key, { pid, opid, items: [], rule: null });
      groups.get(key).items.push({ price: Number(it.price || 0), qty: Number(it.qty || 0) });
    });

    groups.forEach((g, _key) => {
      const ruleKey = g.pid + '|' + (g.opid == null ? 'null' : String(g.opid));
      const rule = qtyRulesCache[ruleKey] || null;
      if(!rule) return;
      
      const buyQty = Math.max(1, Number(rule.buy_qty || 0));
      const nth = Math.max(1, Number(rule.nth || 1));
      const perGroup = Number(rule.per_group || 0) ? 1 : 0;
      
      const units = [];
      g.items.forEach(x => {
        const q = Math.floor(Number(x.qty || 0));
        for(let i = 0; i < q; i++){
          units.push(Number(x.price || 0));
        }
      });
      
      if(units.length === 0) return;
      
      const discountMode = (rule.product_mode && rule.product_value && Number(rule.product_value) > 0) 
        ? rule.product_mode 
        : rule.mode;
      const discountValue = (rule.product_mode && rule.product_value && Number(rule.product_value) > 0) 
        ? Number(rule.product_value) 
        : Number(rule.value || 0);
      
      if(!discountValue || discountValue <= 0) return;
      
      let discounts = 0;
      if(perGroup){
        for(let i = 0; i + buyQty - 1 < units.length; i += buyQty){
          const idx = i + (nth - 1);
          if(idx < units.length){
            const price = units[idx];
            if(String(discountMode) === 'percent') discounts += price * (discountValue / 100);
            else discounts += Math.min(price, discountValue);
          }
        }
      } else {
        let remaining = units.length;
        let start = 0;
        while(remaining >= buyQty){
          const idx = start + (nth - 1);
          if(idx < units.length){
            const price = units[idx];
            if(String(discountMode) === 'percent') discounts += price * (discountValue / 100);
            else discounts += Math.min(price, discountValue);
          }
          start += buyQty;
          remaining -= buyQty;
        }
      }
      qtyOffersDiscount += discounts;
    });
  }

  // حساب الخصم
  const manualPct = (discountType === 'percent') ? Math.min(100, Math.max(0, Number(discountValue || 0))) : 0;
  const couponPct = (coupon && String(coupon.mode) === 'percent') ? Math.max(0, Number(coupon.value || 0)) : 0;
  const offerPct = (globalOffer && String(globalOffer.mode) === 'percent') ? Math.max(0, Number(globalOffer.value || 0)) : 0;
  const combinedPct = Math.min(100, manualPct + couponPct + offerPct);
  const percentDiscountAmount = sub * (combinedPct / 100);

  const manualAmt = (discountType === 'amount') ? Math.max(0, Math.min(sub, Number(discountValue || 0))) : 0;
  const couponAmt = (coupon && String(coupon.mode) !== 'percent') ? Math.max(0, Math.min(sub, Number(coupon.value || 0))) : 0;
  const offerAmt = (globalOffer && String(globalOffer.mode) !== 'percent') ? Math.max(0, Math.min(sub, Number(globalOffer.value || 0))) : 0;

  const totalDiscount = Math.min(sub, Number((qtyOffersDiscount + percentDiscountAmount + manualAmt + couponAmt + offerAmt).toFixed(2)));
  const itemsSubAfterDiscount = Math.max(0, itemsSub - (totalDiscount * (itemsSub > 0 ? (itemsSub / sub) : 0)));
  let subAfterDiscount = Math.max(0, sub - totalDiscount);

  // رسوم التبغ
  let tobaccoFee = 0;
  let tobaccoSub = 0;
  cart.forEach(item => {
    if(item && (item.is_tobacco === 1 || item.is_tobacco === true)){
      const price = Number(item.price || 0);
      const qty = Number(item.qty || 1);
      if(settings.prices_include_vat){
        const base = price / (1 + vatPct);
        tobaccoSub += base * qty;
      } else {
        tobaccoSub += price * qty;
      }
    }
  });
  
  const hasTobacco = tobaccoSub > 0.000001;
  if(hasTobacco){
    const discountOnTobacco = sub > 0 ? totalDiscount * (tobaccoSub / sub) : 0;
    const discountedTobaccoBase = Math.max(0, tobaccoSub - discountOnTobacco);
    const feeByPercent = discountedTobaccoBase * (Number(settings.tobacco_fee_percent || 100) / 100);
    if(itemsSubAfterDiscount < 25){
      tobaccoFee = Number(settings.tobacco_min_fee_amount || 25);
    } else {
      tobaccoFee = feeByPercent;
    }
    subAfterDiscount += tobaccoFee;
  }

  // الضريبة
  if(settings.prices_include_vat){
    vat = subAfterDiscount * vatPct;
    grand = subAfterDiscount + vat;
  } else {
    vat = subAfterDiscount * vatPct;
    grand = subAfterDiscount + vat;
  }

  return {
    sub_total: Number(sub.toFixed(2)),
    extra_value: Number(extra.toFixed(2)),
    discount_amount: Number(totalDiscount.toFixed(2)),
    sub_after_discount: Number(subAfterDiscount.toFixed(2)),
    vat_total: Number(vat.toFixed(2)),
    grand_total: Number(grand.toFixed(2)),
    tobacco_fee: Number((tobaccoFee || 0).toFixed(2)),
    items_sub_after_discount: Number(itemsSubAfterDiscount.toFixed(2))
  };
}

function computeQtyOfferDiscountsInWorker(data) {
  const { cart, qtyRulesCache } = data;
  let qtyOffersDiscount = 0;
  
  if(!Array.isArray(cart) || !cart.length || !qtyRulesCache) return 0;
  
  const groups = new Map();
  cart.forEach(it => {
    const pid = Number(it.id || it.product_id || 0);
    if(!pid) return;
    const opid = (it.operation_id != null && it.operation_id !== '') ? Number(it.operation_id) : null;
    const key = pid + '|' + (opid == null ? 'null' : String(opid));
    if(!groups.has(key)) groups.set(key, { pid, opid, items: [] });
    groups.get(key).items.push({ price: Number(it.price || 0), qty: Number(it.qty || 0) });
  });

  groups.forEach((g, _key) => {
    const ruleKey = g.pid + '|' + (g.opid == null ? 'null' : String(g.opid));
    const rule = qtyRulesCache[ruleKey] || null;
    if(!rule) return;
    
    const buyQty = Math.max(1, Number(rule.buy_qty || 0));
    const nth = Math.max(1, Number(rule.nth || 1));
    const perGroup = Number(rule.per_group || 0) ? 1 : 0;
    
    const units = [];
    g.items.forEach(x => {
      const q = Math.floor(Number(x.qty || 0));
      for(let i = 0; i < q; i++){
        units.push(Number(x.price || 0));
      }
    });
    
    if(units.length === 0) return;
    
    const discountMode = (rule.product_mode && rule.product_value && Number(rule.product_value) > 0) 
      ? rule.product_mode 
      : rule.mode;
    const discountValue = (rule.product_mode && rule.product_value && Number(rule.product_value) > 0) 
      ? Number(rule.product_value) 
      : Number(rule.value || 0);
    
    if(!discountValue || discountValue <= 0) return;
    
    let discounts = 0;
    if(perGroup){
      for(let i = 0; i + buyQty - 1 < units.length; i += buyQty){
        const idx = i + (nth - 1);
        if(idx < units.length){
          const price = units[idx];
          if(String(discountMode) === 'percent') discounts += price * (discountValue / 100);
          else discounts += Math.min(price, discountValue);
        }
      }
    } else {
      let remaining = units.length;
      let start = 0;
      while(remaining >= buyQty){
        const idx = start + (nth - 1);
        if(idx < units.length){
          const price = units[idx];
          if(String(discountMode) === 'percent') discounts += price * (discountValue / 100);
          else discounts += Math.min(price, discountValue);
        }
        start += buyQty;
        remaining -= buyQty;
      }
    }
    qtyOffersDiscount += discounts;
  });
  
  return qtyOffersDiscount;
}
