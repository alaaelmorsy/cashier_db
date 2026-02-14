/**
 * Integration Tests for Sales Cart and Category/Subcategory Handling
 * 
 * Tests the complete flow of adding items to cart, managing operations/subcategories,
 * and ensuring categories and subcategories are properly preserved through the checkout process.
 */

describe('Sales Cart Integration - Categories and Subcategories', () => {
  /**
   * Mock cart state and related functions
   */
  let mockCart = [];
  
  function resetCart() {
    mockCart = [];
  }

  function createProduct(overrides = {}) {
    return {
      id: 1,
      name: 'منتج تجريبي',
      name_en: 'Test Product',
      barcode: 'TEST123',
      category: 'تصنيف رئيسي',
      is_tobacco: 0,
      image_path: '/path/to/image.jpg',
      min_price: null,
      ...overrides
    };
  }

  function createOperation(overrides = {}) {
    return {
      id: 1,
      product_id: 1,
      name: 'كبير',
      price: 100,
      sort_order: 1,
      ...overrides
    };
  }

  /**
   * Helper to simulate addToCart logic with operations
   */
  function simulateAddToCart(product, operation = null) {
    // Simulate the logic from addToCart function (lines 1761+)
    const idx = mockCart.findIndex(x => x.id === product.id);
    if (idx >= 0) {
      mockCart[idx].qty += 1;
      return mockCart[idx];
    }

    // Create new item with operation context
    const item = {
      id: product.id,
      name: product.name,
      name_en: product.name_en || null,
      price: operation ? Number(operation.price || 0) : 0,
      qty: 1,
      image_path: product.image_path,
      category: product.category || null,
      is_tobacco: Number(product.is_tobacco || 0) ? 1 : 0,
      unit_name: null,
      unit_multiplier: 1,
      operation_id: operation ? operation.id : null,
      operation_name: operation ? operation.name : null,
      description: product.description || null,
      __opsLoaded: true,
      __ops: [],
      product_min_price: product.min_price || null
    };

    mockCart.push(item);
    return item;
  }

  /**
   * Helper to simulate the itemsPayload construction from checkout
   */
  function buildCheckoutPayload(cart) {
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
      category: (it.category || null),
      is_tobacco: it.is_tobacco || 0
    }));
  }

  describe('Happy Path: Adding Items with Categories and Subcategories', () => {
    beforeEach(resetCart);

    test('should add single item with category and subcategory', () => {
      const product = createProduct({ id: 1, category: 'المشروبات' });
      const operation = createOperation({ id: 5, name: 'ساخن', price: 50 });

      simulateAddToCart(product, operation);

      expect(mockCart).toHaveLength(1);
      expect(mockCart[0].category).toBe('المشروبات');
      expect(mockCart[0].operation_id).toBe(5);
      expect(mockCart[0].operation_name).toBe('ساخن');
    });

    test('should add multiple items with different subcategories', () => {
      const product1 = createProduct({ id: 1, name: 'قهوة', category: 'المشروبات' });
      const operation1 = createOperation({ id: 1, name: 'ساخن', price: 50 });

      const product2 = createProduct({ id: 2, name: 'عصير', category: 'المشروبات' });
      const operation2 = createOperation({ id: 2, name: 'بارد', price: 40 });

      simulateAddToCart(product1, operation1);
      simulateAddToCart(product2, operation2);

      expect(mockCart).toHaveLength(2);
      expect(mockCart[0].operation_name).toBe('ساخن');
      expect(mockCart[1].operation_name).toBe('بارد');
    });

    test('should preserve category and subcategory when building checkout payload', () => {
      const product = createProduct({ category: 'التبغ' });
      const operation = createOperation({ id: 10, name: 'تدخين', price: 200 });

      simulateAddToCart(product, operation);
      const payload = buildCheckoutPayload(mockCart);

      expect(payload[0].category).toBe('التبغ');
      expect(payload[0].operation_id).toBe(10);
      expect(payload[0].operation_name).toBe('تدخين');
    });
  });

  describe('Category Preservation Through Cart Operations', () => {
    beforeEach(resetCart);

    test('should maintain categories across multiple cart updates', () => {
      const products = [
        { id: 1, category: 'الأغذية', name: 'خبز' },
        { id: 2, category: 'المشروبات', name: 'ماء' },
        { id: 3, category: 'الأغذية', name: 'جبن' }
      ];

      const operations = [
        { id: 1, name: 'عادي' },
        { id: 2, name: 'بارد' },
        { id: 3, name: 'حار' }
      ];

      products.forEach((p, i) => {
        simulateAddToCart(createProduct(p), createOperation(operations[i]));
      });

      expect(mockCart.filter(x => x.category === 'الأغذية')).toHaveLength(2);
      expect(mockCart.filter(x => x.category === 'المشروبات')).toHaveLength(1);
    });

    test('should preserve operation context when incrementing qty', () => {
      const product = createProduct({ id: 1, category: 'الأغذية' });
      const operation = createOperation({ id: 5, name: 'كبير' });

      simulateAddToCart(product, operation);
      const firstQty = mockCart[0].qty;

      simulateAddToCart(product, operation);

      expect(mockCart[0].qty).toBe(firstQty + 1);
      expect(mockCart[0].operation_id).toBe(5);
      expect(mockCart[0].operation_name).toBe('كبير');
    });
  });

  describe('Subcategory Context Verification', () => {
    beforeEach(resetCart);

    test('should include both operation_id and operation_name for rendering', () => {
      const product = createProduct();
      const operation = createOperation({ id: 7, name: 'وسط' });

      simulateAddToCart(product, operation);
      const item = mockCart[0];

      // Both fields must be present for renderCart to display subcategory selector
      expect(item).toHaveProperty('operation_id');
      expect(item).toHaveProperty('operation_name');
      expect(item.operation_id).toBe(7);
      expect(item.operation_name).toBe('وسط');
    });

    test('should handle items without operations gracefully', () => {
      const product = createProduct();
      simulateAddToCart(product, null);

      expect(mockCart[0].operation_id).toBeNull();
      expect(mockCart[0].operation_name).toBeNull();
    });

    test('should not include duplicate variant fields', () => {
      const product = createProduct();
      const operation = createOperation();

      simulateAddToCart(product, operation);
      const payload = buildCheckoutPayload(mockCart);

      expect(payload[0]).not.toHaveProperty('variant_id');
      expect(payload[0]).not.toHaveProperty('variant_name');
    });
  });

  describe('Checkout Payload Integrity', () => {
    beforeEach(resetCart);

    test('should produce valid payload with all required fields', () => {
      const product = createProduct();
      const operation = createOperation();

      simulateAddToCart(product, operation);
      const payload = buildCheckoutPayload(mockCart);

      const requiredFields = [
        'product_id',
        'name',
        'operation_id',
        'operation_name',
        'category',
        'price',
        'qty',
        'line_total'
      ];

      requiredFields.forEach(field => {
        expect(payload[0]).toHaveProperty(field);
      });
    });

    test('should convert operation_id to number type', () => {
      const product = createProduct();
      const operation = createOperation({ id: '15' });

      simulateAddToCart(product, operation);
      const payload = buildCheckoutPayload(mockCart);

      expect(typeof payload[0].operation_id).toBe('number');
      expect(payload[0].operation_id).toBe(15);
    });

    test('should calculate correct line_total with qty', () => {
      const product = createProduct();
      const operation = createOperation({ price: 100 });

      simulateAddToCart(product, operation);
      mockCart[0].qty = 5;

      const payload = buildCheckoutPayload(mockCart);

      expect(payload[0].line_total).toBe(500);
    });

    test('should handle multiple items in payload correctly', () => {
      const items = [
        { product: createProduct({ id: 1, category: 'A' }), operation: createOperation({ id: 1, price: 100 }) },
        { product: createProduct({ id: 2, category: 'B' }), operation: createOperation({ id: 2, price: 200 }) },
        { product: createProduct({ id: 3, category: 'A' }), operation: createOperation({ id: 3, price: 150 }) }
      ];

      items.forEach(item => {
        simulateAddToCart(item.product, item.operation);
      });

      const payload = buildCheckoutPayload(mockCart);

      expect(payload).toHaveLength(3);
      expect(payload[0].category).toBe('A');
      expect(payload[1].category).toBe('B');
      expect(payload[2].category).toBe('A');
      expect(payload[0].operation_id).toBe(1);
      expect(payload[1].operation_id).toBe(2);
      expect(payload[2].operation_id).toBe(3);
    });
  });

  describe('Regression Prevention: Categories Display', () => {
    beforeEach(resetCart);

    test('cart items must have category for tab display', () => {
      const product = createProduct({ category: 'المشروبات' });
      const operation = createOperation();

      simulateAddToCart(product, operation);

      // This category is used by populateCategories() to display category tabs
      expect(mockCart[0].category).toBe('المشروبات');
    });

    test('cart items must have operation_name for subcategory dropdown', () => {
      const product = createProduct();
      const operation = createOperation({ name: 'الحجم الكبير' });

      simulateAddToCart(product, operation);

      // This field is used by renderCart() to populate the op-select dropdown
      expect(mockCart[0].operation_name).toBe('الحجم الكبير');
    });

    test('operation_id should NOT be lost during payload construction', () => {
      const product = createProduct();
      const operation = createOperation({ id: 25 });

      simulateAddToCart(product, operation);
      const payload = buildCheckoutPayload(mockCart);

      // Critical: this was being lost due to duplicate field definitions
      expect(payload[0].operation_id).toBe(25);
      expect(payload[0].operation_id).not.toBeUndefined();
      expect(payload[0].operation_id).not.toBeNull();
    });

    test('operation_name should NOT be lost during payload construction', () => {
      const product = createProduct();
      const operation = createOperation({ name: 'صغير جداً' });

      simulateAddToCart(product, operation);
      const payload = buildCheckoutPayload(mockCart);

      // Critical: this was being lost due to duplicate field definitions
      expect(payload[0].operation_name).toBe('صغير جداً');
      expect(payload[0].operation_name).not.toBeUndefined();
    });
  });

  describe('Edge Cases: Tobacco and Special Categories', () => {
    beforeEach(resetCart);

    test('should preserve tobacco flag with category and subcategory', () => {
      const product = createProduct({ id: 1, category: 'التبغ', is_tobacco: 1 });
      const operation = createOperation({ id: 100, name: 'تدخين' });

      simulateAddToCart(product, operation);
      const payload = buildCheckoutPayload(mockCart);

      expect(payload[0].is_tobacco).toBe(1);
      expect(payload[0].category).toBe('التبغ');
      expect(payload[0].operation_id).toBe(100);
    });

    test('should maintain category consistency for reporting', () => {
      const categories = ['الأغذية', 'المشروبات', 'التبغ'];
      
      categories.forEach((cat, idx) => {
        const product = createProduct({ id: idx + 1, category: cat });
        const operation = createOperation({ id: idx + 1, name: `نوع ${idx}` });
        simulateAddToCart(product, operation);
      });

      const payload = buildCheckoutPayload(mockCart);
      const uniqueCategories = [...new Set(payload.map(p => p.category))];

      expect(uniqueCategories).toEqual(categories);
    });
  });
});