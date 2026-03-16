

## Plan: Filter stock page by `is_stock_tracked`

### Problem
Currently, `/gestor/estoque` shows ALL active products for the client, including those with `is_stock_tracked = false`. Users can toggle `allow_negative`, adjust stock, and configure thresholds for products that don't control stock — which is inconsistent.

### Solution

**1. Fetch `is_stock_tracked` from products query**

Add `is_stock_tracked` to the products select in `fetchData()` and to the `ProductInfo` / `StockRow` types.

**2. Filter products list to only `is_stock_tracked = true`**

Add `.eq("is_stock_tracked", true)` to the products query so only stock-tracked products appear in the main table.

**3. Filter the adjust modal product dropdown**

The product dropdown in the adjust modal should also only show `is_stock_tracked = true` products (already handled by filtering `products` state).

**4. Disable controls for non-tracked products (safety)**

Since we filter at query level, non-tracked products won't appear. The `allow_negative` switch, `is_enabled` switch, threshold config, and adjust button will only be available for tracked products.

### Files changed
- `src/pages/gestor/GestorEstoque.tsx` — add `is_stock_tracked` to type, add filter to query, ensure dropdown consistency

### No DB migration needed.

