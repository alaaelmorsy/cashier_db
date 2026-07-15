(function exposeCardVisibility(root) {
  const permissionByCard = Object.freeze({
    cardUsers: 'users',
    cardPermissions: 'permissions',
    cardCustomers: 'customers',
    cardAppointments: 'appointments',
    cardNewInvoice: 'sales',
    cardInvoices: 'invoices',
    cardCreditNotes: 'credit_notes',
    cardQuotations: 'quotations',
    cardPayments: 'payments',
    cardVouchers: 'vouchers',
    cardShifts: 'shifts',
    cardProducts: 'products',
    cardTypes: 'types',
    cardSettings: 'settings',
    cardOperations: 'operations',
    cardKitchen: 'kitchen',
    cardPurchases: 'purchases',
    cardPurchaseInvoices: 'purchase_invoices',
    cardSuppliers: 'suppliers',
    cardEmployees: 'employees',
    cardCustomerPricing: 'customer_pricing',
    cardOffers: 'offers',
    cardDrivers: 'drivers',
    cardReports: 'reports',
    cardWhatsApp: 'whatsapp',
    cardZatca: 'zatca'
  });

  function settingAllowsCard(cardId, settings) {
    if (cardId === 'cardAppointments') return settings.show_appointments !== false && settings.show_appointments !== 0;
    if (cardId === 'cardShifts') return settings.show_shifts !== false && settings.show_shifts !== 0;
    return true;
  }

  function visibleCardIds(permissionKeys, settings = {}) {
    const grantedPermissions = new Set(permissionKeys);
    const visibleCards = Object.entries(permissionByCard)
      .filter(([cardId, permissionKey]) => grantedPermissions.has(permissionKey) && settingAllowsCard(cardId, settings))
      .map(([cardId]) => cardId);
    return new Set(visibleCards);
  }

  const cardVisibility = {
    cardIds: Object.keys(permissionByCard),
    visibleCardIds
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = cardVisibility;
  if (root) root.MainCardVisibility = cardVisibility;
})(typeof window !== 'undefined' ? window : null);
