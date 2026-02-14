# Unit Tests - Sales Categories and Subcategories Fix

## Quick Start

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Specific Test File
```bash
npm test -- __tests__/sales-payload-structure.test.js
npm test -- __tests__/sales-cart-integration.test.js
npm test -- __tests__/sales-categories-ui.test.js
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should preserve operation_id"
```

## Test Files

### 1. `sales-payload-structure.test.js` (31 tests)
**Purpose:** Verify the itemsPayload structure is correct and properly formed

**What it Tests:**
- ✅ Payload includes all required fields
- ✅ operation_id is converted to Number type
- ✅ operation_name is preserved as String
- ✅ No duplicate field definitions
- ✅ Category field is included
- ✅ Edge cases: null, undefined, zero values
- ✅ Type conversions work correctly
- ✅ Invalid values handled gracefully

**Key Test Scenarios:**
- `should create payload with correct fields for single item`
- `should preserve operation_id as number type`
- `should not include variant_id or variant_name fields (critical fix)`
- `should calculate line_total correctly`
- `operation_id should NOT be overwritten by any variant_id field`
- `operation_name should NOT be overwritten by any variant_name field`
- `payload should maintain subcategory context for rendering`

**Run Only This File:**
```bash
npm test -- sales-payload-structure
```

### 2. `sales-cart-integration.test.js` (18 tests)
**Purpose:** Verify complete cart flow from adding items to checkout

**What it Tests:**
- ✅ Adding items with categories and subcategories
- ✅ Multiple items in cart maintain distinct subcategories
- ✅ Category preservation through cart operations
- ✅ Subcategory context available for rendering
- ✅ Checkout payload integrity
- ✅ Tobacco items and special categories
- ✅ Duplicate field prevention

**Key Test Scenarios:**
- `should add single item with category and subcategory`
- `should add multiple items with different subcategories`
- `should preserve category and subcategory when building checkout payload`
- `should maintain categories across multiple cart updates`
- `should preserve operation context when incrementing qty`
- `should not include duplicate variant fields`
- `should handle items without operations gracefully`

**Run Only This File:**
```bash
npm test -- sales-cart-integration
```

### 3. `sales-categories-ui.test.js` (28 tests)
**Purpose:** Verify UI functions for categories and subcategories display

**What it Tests:**
- ✅ Category tab generation from main types
- ✅ Product filtering by category
- ✅ Operations sorting by sort_order
- ✅ Cart rendering with subcategory selectors
- ✅ Category/subcategory hierarchy
- ✅ Tab display logic (show/hide)
- ✅ Dropdown population
- ✅ Special cases: RTL text, spaces, tobacco items

**Key Test Scenarios:**
- `should generate tabs from active main types`
- `should load products filtered by category`
- `should match each product with its operations/subcategories`
- `should sort operations by sort_order`
- `should provide operation_id for dropdown selector`
- `should provide operation_name for dropdown display`
- `should display subcategory dropdown when operations exist`
- `should populate dropdown options from operations`
- `should select first operation by default`

**Run Only This File:**
```bash
npm test -- sales-categories-ui
```

## Test Results

All tests should show:
```
PASS  __tests__/sales-payload-structure.test.js
PASS  __tests__/sales-cart-integration.test.js
PASS  __tests__/sales-categories-ui.test.js

Test Suites: 3 passed, 3 total
Tests:       77 passed, 77 total
```

## Understanding Test Output

### Test Hierarchy
```
Suite (describe block)
├── Test Group (describe block)
│   ├── Test Case (test/it block)
│   │   └── ✓ or ✗ Result
│   └── Test Case
│       └── Result
└── Test Group
    └── Test Cases
```

### Example Output
```
✓ should create payload with correct fields for single item (14 ms)
✓ should preserve operation_id as number type (1 ms)
✓ should preserve operation_name as string (1 ms)
✗ should handle NaN value in price field (3 ms)
```

## Troubleshooting

### Tests Not Running
**Problem:** "jest: command not found"
**Solution:** Run `npm install` first to install dependencies

### Specific Test Failing
**Action:**
1. Check the error message
2. Review the test file
3. Understand what the test expects
4. Check the actual implementation in renderer.js

### Tests Timing Out
**Problem:** Some tests taking too long
**Solution:** Add timeout: `jest.setTimeout(10000);` in test file

### Module Not Found
**Problem:** "Cannot find module"
**Solution:** Ensure proper file paths in imports

## Adding New Tests

### Test Template
```javascript
describe('Feature Name', () => {
  describe('Happy Path: Description', () => {
    test('should do something', () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expectedValue);
    });
  });

  describe('Input Verification: Description', () => {
    test('should handle edge case', () => {
      // Test edge case
    });
  });

  describe('Exception Handling: Description', () => {
    test('should handle error gracefully', () => {
      // Test error handling
    });
  });
});
```

### Test Categories
1. **Happy Path** - Normal, expected behavior
2. **Input Verification** - Edge cases, boundary values
3. **Branching** - Different code paths, conditions
4. **Exception Handling** - Errors, invalid values
5. **Regression Prevention** - Ensure bugs don't return

## Jest Documentation

### Common Assertions
```javascript
expect(value).toBe(expectedValue);              // Strict equality
expect(value).toEqual(expectedValue);           // Deep equality
expect(value).toBeNull();                       // Null check
expect(value).toBeUndefined();                  // Undefined check
expect(value).toBeTruthy();                     // Truthy check
expect(value).toBeFalsy();                      // Falsy check
expect(array).toHaveLength(length);             // Array length
expect(object).toHaveProperty('property');      // Object property
expect(value).toBeNaN();                        // NaN check
expect(() => fn()).toThrow();                   // Exception check
```

### Async Tests
```javascript
test('async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expectedValue);
});
```

### Mocking
```javascript
jest.mock('../module');  // Mock a module
jest.fn();               // Create mock function
jest.spyOn();            // Spy on function
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

### Pre-commit Hook
```bash
#!/bin/sh
npm test --passWithNoTests
```

## Performance Notes

- All 77 tests complete in ~2-3 seconds
- No external dependencies required
- Pure unit tests (no I/O)
- Can run in CI/CD pipeline

## Support Files

### Additional Documentation
- `CATEGORIES_FIX_SUMMARY.md` - Detailed fix explanation
- `../src/renderer/sales/renderer.js` - Implementation
- `../package.json` - Jest configuration

### References
- Jest Docs: https://jestjs.io/docs/getting-started
- Jest API: https://jestjs.io/docs/api
- Testing Best Practices: https://jestjs.io/docs/setup-and-teardown