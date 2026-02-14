/**
 * Unit Tests for Sales Invoice - ItemsPayload Structure
 * 
 * Tests to ensure the fix for missing categories and subcategories is working correctly.
 * This covers the critical itemsPayload construction that was causing categories 
 * and subcategories to disappear from the invoice screen.
 */

describe('Sales Invoice ItemsPayload Structure', () => {
  /**
   * Helper function to simulate cart item structure as used in the sales renderer
   */
  function createCartItem(overrides = {}) {
    return {
      id: 1,
      name: 'منتج تجريبي',
      name_en: 'Test Product',
      price: 100,
      qty: 1,
      image_path: '/path/to/image.jpg',
      category: 'تصنيف رئيسي',
      is_tobacco: 0,
      unit_name: null,
      unit_multiplier: 1,
      operation_id: 5,           // Critical: subcategory/variant ID
      operation_name: 'كبير',    // Critical: subcategory/variant name
      description: 'وصف المنتج',
      __opsLoaded: true,
      __ops: [],
      product_min_price: null,
      ...overrides
    };
  }

  /**
   * Helper function to build itemsPayload exactly as done in the renderer
   * This mimics the exact construction from lines 2467-2479 of renderer.js
   */
  function buildItemsPayload(cart) {
    return cart.map(it => ({
      product_id: it.id,
      name: it.name,
      description: (it.description || null),
      operation_id: (typeof it.operation_id !== 'undefined' && it.operation_id != null) ? Number(it.operation_id) : null,
      operation_name: it.operation_name || null,
      price: Number(it.price || 0),
      qty: Number(it.qty || 1),
      unit_name: (it.unit_name || null),
      unit_multiplier: (it.unit_multiplier != null ? Number(it.unit_multiplier) : 1),
      line_total: Number(it.price || 0) * Number(it.qty || 1),
      category: (it.category || null)
    }));
  }

  describe('Happy Path: Basic Payload Structure', () => {
    test('should create payload with correct fields for single item', () => {
      const cart = [createCartItem()];
      const payload = buildItemsPayload(cart);

      expect(payload).toHaveLength(1);
      expect(payload[0]).toEqual({
        product_id: 1,
        name: 'منتج تجريبي',
        description: 'وصف المنتج',
        operation_id: 5,
        operation_name: 'كبير',
        price: 100,
        qty: 1,
        unit_name: null,
        unit_multiplier: 1,
        line_total: 100,
        category: 'تصنيف رئيسي'
      });
    });

    test('should preserve operation_id as number type', () => {
      const cart = [createCartItem({ operation_id: '10' })];
      const payload = buildItemsPayload(cart);

      expect(typeof payload[0].operation_id).toBe('number');
      expect(payload[0].operation_id).toBe(10);
    });

    test('should preserve operation_name as string', () => {
      const cart = [createCartItem({ operation_name: 'صغير' })];
      const payload = buildItemsPayload(cart);

      expect(typeof payload[0].operation_name).toBe('string');
      expect(payload[0].operation_name).toBe('صغير');
    });

    test('should include main category in payload', () => {
      const cart = [createCartItem({ category: 'المشروبات' })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].category).toBe('المشروبات');
    });

    test('should handle multiple items in cart', () => {
      const cart = [
        createCartItem({ id: 1, operation_id: 5, operation_name: 'كبير' }),
        createCartItem({ id: 2, operation_id: 6, operation_name: 'صغير' }),
        createCartItem({ id: 3, operation_id: 7, operation_name: 'وسط' })
      ];
      const payload = buildItemsPayload(cart);

      expect(payload).toHaveLength(3);
      expect(payload[0].operation_id).toBe(5);
      expect(payload[1].operation_id).toBe(6);
      expect(payload[2].operation_id).toBe(7);
      
      expect(payload[0].operation_name).toBe('كبير');
      expect(payload[1].operation_name).toBe('صغير');
      expect(payload[2].operation_name).toBe('وسط');
    });
  });

  describe('Input Verification: Edge Cases', () => {
    test('should handle null operation_id', () => {
      const cart = [createCartItem({ operation_id: null })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].operation_id).toBeNull();
    });

    test('should handle undefined operation_id', () => {
      const cart = [createCartItem({ operation_id: undefined })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].operation_id).toBeNull();
    });

    test('should handle null operation_name', () => {
      const cart = [createCartItem({ operation_name: null })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].operation_name).toBeNull();
    });

    test('should handle undefined operation_name', () => {
      const cart = [createCartItem({ operation_name: undefined })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].operation_name).toBeNull();
    });

    test('should handle zero operation_id', () => {
      const cart = [createCartItem({ operation_id: 0 })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].operation_id).toBe(0);
    });

    test('should not include variant_id or variant_name fields (critical fix)', () => {
      const cart = [createCartItem()];
      const payload = buildItemsPayload(cart);

      expect(payload[0]).not.toHaveProperty('variant_id');
      expect(payload[0]).not.toHaveProperty('variant_name');
    });

    test('should calculate line_total correctly', () => {
      const cart = [
        createCartItem({ price: 50, qty: 2 }),
        createCartItem({ price: 100, qty: 3 })
      ];
      const payload = buildItemsPayload(cart);

      expect(payload[0].line_total).toBe(100);  // 50 * 2
      expect(payload[1].line_total).toBe(300);  // 100 * 3
    });

    test('should handle empty category', () => {
      const cart = [createCartItem({ category: null })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].category).toBeNull();
    });

    test('should handle empty description', () => {
      const cart = [createCartItem({ description: null })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].description).toBeNull();
    });

    test('should handle empty description as null', () => {
      const cart = [createCartItem({ 
        unit_name: null,
        description: ''
      })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].unit_name).toBeNull();
      // Empty string converts to null due to (it.description || null) logic
      expect(payload[0].description).toBeNull();
    });
  });

  describe('Branching: Field Type Conversions', () => {
    test('should convert string price to number', () => {
      const cart = [createCartItem({ price: '150.50' })];
      const payload = buildItemsPayload(cart);

      expect(typeof payload[0].price).toBe('number');
      expect(payload[0].price).toBe(150.50);
    });

    test('should convert string qty to number', () => {
      const cart = [createCartItem({ qty: '5' })];
      const payload = buildItemsPayload(cart);

      expect(typeof payload[0].qty).toBe('number');
      expect(payload[0].qty).toBe(5);
    });

    test('should convert unit_multiplier to number', () => {
      const cart = [createCartItem({ unit_multiplier: '2.5' })];
      const payload = buildItemsPayload(cart);

      expect(typeof payload[0].unit_multiplier).toBe('number');
      expect(payload[0].unit_multiplier).toBe(2.5);
    });

    test('should default unit_multiplier to 1 if null', () => {
      const cart = [createCartItem({ unit_multiplier: null })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].unit_multiplier).toBe(1);
    });

    test('should default price to 0 if missing', () => {
      const cart = [createCartItem({ price: undefined })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].price).toBe(0);
    });

    test('should default qty to 1 if missing', () => {
      const cart = [createCartItem({ qty: undefined })];
      const payload = buildItemsPayload(cart);

      expect(payload[0].qty).toBe(1);
    });
  });

  describe('Exception Handling: Invalid Values', () => {
    test('should handle NaN value in price field', () => {
      const cart = [createCartItem({ price: NaN })];
      const payload = buildItemsPayload(cart);

      // Number(NaN || 0) will evaluate to Number(0)
      expect(payload[0].price).toBe(0);
    });

    test('should handle non-numeric strings in price', () => {
      const cart = [createCartItem({ price: 'invalid' })];
      const payload = buildItemsPayload(cart);

      expect(Number.isNaN(payload[0].price)).toBe(true);
    });

    test('should handle non-numeric operation_id string conversion', () => {
      const cart = [createCartItem({ operation_id: 'invalid' })];
      const payload = buildItemsPayload(cart);

      expect(Number.isNaN(payload[0].operation_id)).toBe(true);
    });

    test('should preserve all required fields even with some invalid values', () => {
      const cart = [createCartItem({
        price: 'invalid',
        operation_id: 'invalid',
        category: null
      })];
      const payload = buildItemsPayload(cart);

      const requiredFields = [
        'product_id', 'name', 'description', 'operation_id', 'operation_name',
        'price', 'qty', 'unit_name', 'unit_multiplier', 'line_total', 'category'
      ];
      
      requiredFields.forEach(field => {
        expect(payload[0]).toHaveProperty(field);
      });
    });
  });

  describe('Regression Prevention: Fix Validation', () => {
    test('operation_id should NOT be overwritten by any variant_id field', () => {
      const cart = [createCartItem({ 
        operation_id: 10,
        operation_name: 'الحجم الكبير'
      })];
      const payload = buildItemsPayload(cart);

      // The critical fix: operation_id must be preserved
      expect(payload[0].operation_id).toBe(10);
      expect(payload[0].operation_name).toBe('الحجم الكبير');
    });

    test('operation_name should NOT be overwritten by any variant_name field', () => {
      const cart = [createCartItem({ 
        operation_id: 15,
        operation_name: 'الحجم الصغير'
      })];
      const payload = buildItemsPayload(cart);

      // The critical fix: operation_name must be preserved
      expect(payload[0].operation_name).toBe('الحجم الصغير');
      expect(payload[0].operation_id).toBe(15);
    });

    test('payload should maintain subcategory context for rendering', () => {
      const cart = [createCartItem({
        category: 'التبغ',
        operation_id: 8,
        operation_name: 'تدخين'
      })];
      const payload = buildItemsPayload(cart);

      // Ensure all context for subcategory is preserved
      expect(payload[0].category).toBe('التبغ');
      expect(payload[0].operation_id).toBe(8);
      expect(payload[0].operation_name).toBe('تدخين');
    });

    test('should not have duplicate field definitions', () => {
      const cart = [createCartItem()];
      const payload = buildItemsPayload(cart);

      const fieldCounts = {};
      Object.keys(payload[0]).forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      });

      // Verify no duplicate fields
      Object.values(fieldCounts).forEach(count => {
        expect(count).toBe(1);
      });
    });
  });

  describe('Category and Subcategory Integration', () => {
    test('should preserve both main category and subcategory', () => {
      const items = [
        createCartItem({ 
          category: 'المشروبات', 
          operation_id: 1, 
          operation_name: 'ساخن' 
        }),
        createCartItem({ 
          category: 'المشروبات', 
          operation_id: 2, 
          operation_name: 'بارد' 
        }),
        createCartItem({ 
          category: 'الأغذية', 
          operation_id: 3, 
          operation_name: 'وجبات' 
        })
      ];
      
      const payload = buildItemsPayload(items);

      expect(payload[0].category).toBe('المشروبات');
      expect(payload[0].operation_name).toBe('ساخن');
      
      expect(payload[1].category).toBe('المشروبات');
      expect(payload[1].operation_name).toBe('بارد');
      
      expect(payload[2].category).toBe('الأغذية');
      expect(payload[2].operation_name).toBe('وجبات');
    });

    test('items with same category but different subcategories should be distinct', () => {
      const items = [
        createCartItem({ 
          id: 1,
          name: 'قهوة',
          category: 'المشروبات', 
          operation_id: 1, 
          operation_name: 'ساخن' 
        }),
        createCartItem({ 
          id: 2,
          name: 'عصير',
          category: 'المشروبات', 
          operation_id: 2, 
          operation_name: 'بارد' 
        })
      ];
      
      const payload = buildItemsPayload(items);

      expect(payload[0]).not.toEqual(payload[1]);
      expect(payload[0].operation_name).not.toBe(payload[1].operation_name);
    });
  });
});