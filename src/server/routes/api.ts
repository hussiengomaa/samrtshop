import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../db/database.js';
import { executeSearch } from '../services/searchOrchestrator.js';
import { askAssistant } from '../services/aiShoppingAssistant.js';
import { enrichOfferWithCalculation } from '../services/priceCalculation.js';
import { SerpApiProvider } from '../providers/serpapiProvider.js';
import { GeminiGroundingProvider } from '../providers/geminiGroundingProvider.js';
import crypto from 'crypto';

export const apiRouter = Router();

const serpProvider = new SerpApiProvider();
const geminiProvider = new GeminiGroundingProvider();

// ----------------------------------------------------
// Health Check
// ----------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ----------------------------------------------------
// Categories & Stores
// ----------------------------------------------------
apiRouter.get('/categories', (_req: Request, res: Response) => {
  const categories = dbAll('SELECT * FROM categories ORDER BY name_ar ASC');
  res.json(categories);
});

apiRouter.get('/stores', (_req: Request, res: Response) => {
  const stores = dbAll('SELECT * FROM stores ORDER BY name ASC');
  res.json(stores);
});

// ----------------------------------------------------
// Products Catalog
// ----------------------------------------------------
apiRouter.get('/products', (req: Request, res: Response) => {
  const { category, brand, store, minPrice, maxPrice, sort, q, page = '1', limit = '12' } = req.query;

  let querySql = `
    SELECT p.*, c.name as category_name, c.name_ar as category_name_ar
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    querySql += ` AND (p.name LIKE ? OR p.name_ar LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)`;
    const searchParam = `%${q}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  if (category) {
    querySql += ` AND (p.category_id = ? OR c.slug = ?)`;
    params.push(category, category);
  }

  if (brand) {
    querySql += ` AND p.brand = ?`;
    params.push(brand);
  }

  const products = dbAll(querySql, params);

  // Attach enriched offers and calculate price stats
  const enrichedProducts = products.map(prod => {
    const rawOffers = dbAll(`
      SELECT o.*, s.name as store_name, s.name_ar as store_name_ar, s.website_url, s.logo_url
      FROM product_offers o
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.product_id = ?
      ORDER BY o.product_price ASC
    `, [prod.id]);

    const offers = rawOffers.map(enrichOfferWithCalculation);
    const validPrices = offers.map(o => o.product_price).filter((p): p is number => p !== null && p > 0);
    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

    const completeTotals = offers
      .filter(o => o.is_total_cost_complete && o.total_cost !== null && o.total_cost !== undefined)
      .map(o => o.total_cost as number);
    const lowestTotalCost = completeTotals.length > 0 ? Math.min(...completeTotals) : null;

    return {
      ...prod,
      specifications: JSON.parse(prod.specifications || '{}'),
      offers,
      lowest_price: lowestPrice,
      lowest_total_cost: lowestTotalCost,
      offers_count: offers.length
    };
  });

  // Filter by store or price if requested
  let filtered = enrichedProducts;
  if (store) {
    filtered = filtered.filter(p => p.offers.some((o: any) => o.store_id === store || o.store_name === store));
  }
  if (minPrice) {
    const min = parseFloat(minPrice as string);
    if (!isNaN(min)) filtered = filtered.filter(p => p.lowest_price !== null && p.lowest_price >= min);
  }
  if (maxPrice) {
    const max = parseFloat(maxPrice as string);
    if (!isNaN(max)) filtered = filtered.filter(p => p.lowest_price !== null && p.lowest_price <= max);
  }

  // Sorting
  if (sort === 'price_asc') {
    filtered.sort((a, b) => (a.lowest_price ?? 99999999) - (b.lowest_price ?? 99999999));
  } else if (sort === 'price_desc') {
    filtered.sort((a, b) => (b.lowest_price ?? 0) - (a.lowest_price ?? 0));
  } else if (sort === 'total_cost_asc') {
    filtered.sort((a, b) => (a.lowest_total_cost ?? 99999999) - (b.lowest_total_cost ?? 99999999));
  }

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 12;
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = filtered.slice(startIndex, startIndex + limitNum);

  res.json({
    total: filtered.length,
    page: pageNum,
    totalPages: Math.ceil(filtered.length / limitNum),
    products: paginated
  });
});

apiRouter.get('/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const product = dbGet(`
    SELECT p.*, c.name as category_name, c.name_ar as category_name_ar
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `, [id]);

  if (!product) {
    return res.status(404).json({ error: 'المنتج غير موجود / Product not found' });
  }

  const rawOffers = dbAll(`
    SELECT o.*, s.name as store_name, s.name_ar as store_name_ar, s.website_url, s.logo_url
    FROM product_offers o
    LEFT JOIN stores s ON o.store_id = s.id
    WHERE o.product_id = ?
    ORDER BY o.product_price ASC
  `, [id]);

  const offers = rawOffers.map(enrichOfferWithCalculation);

  // Fetch actual recorded price history for offers
  const offerIds = offers.map(o => o.id);
  let priceHistory: any[] = [];
  if (offerIds.length > 0) {
    const placeholders = offerIds.map(() => '?').join(',');
    priceHistory = dbAll(`
      SELECT ph.*, s.name_ar as store_name
      FROM price_history ph
      JOIN product_offers po ON ph.offer_id = po.id
      LEFT JOIN stores s ON po.store_id = s.id
      WHERE ph.offer_id IN (${placeholders})
      ORDER BY ph.recorded_at ASC
    `, offerIds);
  }

  const validPrices = offers.map(o => o.product_price).filter((p): p is number => p !== null && p > 0);
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

  const completeTotals = offers
    .filter(o => o.is_total_cost_complete && o.total_cost !== null && o.total_cost !== undefined)
    .map(o => o.total_cost as number);
  const lowestTotalCost = completeTotals.length > 0 ? Math.min(...completeTotals) : null;

  res.json({
    ...product,
    specifications: JSON.parse(product.specifications || '{}'),
    offers,
    price_history: priceHistory,
    lowest_price: lowestPrice,
    lowest_total_cost: lowestTotalCost
  });
});

// ----------------------------------------------------
// Search Orchestration
// ----------------------------------------------------
apiRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, forceExternal, userId } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'يرجى إدخال نص البحث / Please provide a search query' });
    }

    const result = await executeSearch({
      query: query.trim(),
      forceExternal: Boolean(forceExternal),
      userId: userId || null
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطأ أثناء تنفيذ البحث / Search execution failed' });
  }
});

// ----------------------------------------------------
// AI Shopping Assistant
// ----------------------------------------------------
apiRouter.post('/assistant/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'يرجى كتابة رسالتك / Please enter a message' });
    }

    const recommendation = await askAssistant(message.trim());
    res.json(recommendation);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطأ في معالجة طلب المساعد / Assistant failed' });
  }
});

// ----------------------------------------------------
// Authentication & User Profiles
// ----------------------------------------------------
apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'البريد وكلمة المرور (6 أحرف على الأقل) مطلوبان' });
  }

  const existing = dbGet('SELECT id FROM user_profiles WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing) {
    return res.status(400).json({ error: 'هذا البريد مسجل بالفعل / Email already registered' });
  }

  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const now = new Date().toISOString();

  dbRun(`
    INSERT INTO user_profiles (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'user', ?, ?)
  `, [id, name || null, email.toLowerCase().trim(), passwordHash, now, now]);

  res.json({
    user: { id, name: name || null, email: email.toLowerCase().trim(), role: 'user' }
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const user = dbGet<any>(`
    SELECT id, name, email, role FROM user_profiles
    WHERE email = ? AND password_hash = ?
  `, [email.toLowerCase().trim(), passwordHash]);

  if (!user) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة / Invalid credentials' });
  }

  res.json({ user });
});

// ----------------------------------------------------
// Favorites
// ----------------------------------------------------
apiRouter.get('/favorites', (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string || req.query.userId as string || 'usr_admin_001';
  const favorites = dbAll(`
    SELECT f.*, p.name, p.name_ar, p.image_url, p.brand, p.model
    FROM favorites f
    JOIN products p ON f.product_id = p.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `, [userId]);
  res.json(favorites);
});

apiRouter.post('/favorites', (req: Request, res: Response) => {
  const { productId, userId = 'usr_admin_001' } = req.body;
  if (!productId) return res.status(400).json({ error: 'معرف المنتج مطلوب' });

  const id = `fav_${crypto.randomUUID().slice(0, 8)}`;
  try {
    dbRun(`
      INSERT OR IGNORE INTO favorites (id, user_id, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [id, userId, productId, new Date().toISOString()]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/favorites/:productId', (req: Request, res: Response) => {
  const { productId } = req.params;
  const userId = req.headers['x-user-id'] as string || req.query.userId as string || 'usr_admin_001';
  dbRun('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [userId, productId]);
  res.json({ success: true });
});

// ----------------------------------------------------
// Saved Searches & Alerts
// ----------------------------------------------------
apiRouter.get('/saved-searches', (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string || req.query.userId as string || 'usr_admin_001';
  const searches = dbAll('SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  res.json(searches);
});

apiRouter.post('/saved-searches', (req: Request, res: Response) => {
  const { query, userId = 'usr_admin_001', filters = {} } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const id = `ss_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  dbRun(`
    INSERT INTO saved_searches (id, user_id, query, normalized_query, filters, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, userId, query, query.toLowerCase(), JSON.stringify(filters), now, now]);

  res.json({ success: true, id });
});

apiRouter.delete('/saved-searches/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] as string || req.query.userId as string || 'usr_admin_001';
  dbRun('DELETE FROM saved_searches WHERE id = ? AND user_id = ?', [id, userId]);
  res.json({ success: true });
});

apiRouter.get('/price-alerts', (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string || req.query.userId as string || 'usr_admin_001';
  const alerts = dbAll(`
    SELECT pa.*, p.name as product_name, p.name_ar as product_name_ar
    FROM price_alerts pa
    JOIN products p ON pa.product_id = p.id
    WHERE pa.user_id = ?
    ORDER BY pa.created_at DESC
  `, [userId]);
  res.json(alerts);
});

apiRouter.post('/price-alerts', (req: Request, res: Response) => {
  const { productId, targetPrice, userId = 'usr_admin_001' } = req.body;
  if (!productId || !targetPrice) return res.status(400).json({ error: 'Missing required parameters' });

  const id = `pa_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  dbRun(`
    INSERT INTO price_alerts (id, user_id, product_id, target_price, currency, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'EGP', 'active', ?, ?)
  `, [id, userId, productId, Number(targetPrice), now, now]);

  res.json({ success: true, id });
});

apiRouter.delete('/price-alerts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] as string || req.query.userId as string || 'usr_admin_001';
  dbRun('DELETE FROM price_alerts WHERE id = ? AND user_id = ?', [id, userId]);
  res.json({ success: true });
});

// ----------------------------------------------------
// Admin Dashboard & Diagnostics (Section 12)
// ----------------------------------------------------
apiRouter.get('/admin/dashboard', (_req: Request, res: Response) => {
  const totalProducts = dbGet<any>('SELECT COUNT(*) as count FROM products')?.count || 0;
  const activeStores = dbGet<any>("SELECT COUNT(*) as count FROM stores WHERE status = 'active'")?.count || 0;
  const activeOffers = dbGet<any>("SELECT COUNT(*) as count FROM product_offers WHERE availability = 'in_stock'")?.count || 0;

  // Outdated offers: last checked > 14 days ago or never checked
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const outdatedOffers = dbGet<any>(`
    SELECT COUNT(*) as count FROM product_offers
    WHERE last_checked_at IS NULL OR last_checked_at < ?
  `, [fourteenDaysAgo])?.count || 0;

  // Searches this month
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const searchesThisMonth = dbGet<any>(`
    SELECT COUNT(*) as count FROM search_logs
    WHERE created_at >= ?
  `, [firstOfMonth])?.count || 0;

  const searchesNoResults = dbGet<any>(`
    SELECT COUNT(*) as count FROM search_logs
    WHERE result_count = 0
  `)?.count || 0;

  // External search success rate
  const totalProviderCalls = dbGet<any>('SELECT COUNT(*) as count FROM provider_events')?.count || 0;
  const successfulCalls = dbGet<any>("SELECT COUNT(*) as count FROM provider_events WHERE status = 'ok'")?.count || 0;
  const externalSuccessRate = totalProviderCalls > 0 ? Math.round((successfulCalls / totalProviderCalls) * 100) : 100;

  // Data coverage: products with at least 2 distinct store offers
  const multiOfferProducts = dbGet<any>(`
    SELECT COUNT(*) as count FROM (
      SELECT product_id FROM product_offers GROUP BY product_id HAVING COUNT(DISTINCT store_id) >= 2
    )
  `)?.count || 0;
  const dataCoverage = totalProducts > 0 ? Math.round((multiOfferProducts / totalProducts) * 100) : 0;

  // Provider errors
  const providerErrors = dbGet<any>("SELECT COUNT(*) as count FROM provider_events WHERE status IN ('provider_error', 'rate_limited', 'timeout')")?.count || 0;

  // Average search latency
  const avgLatency = dbGet<any>('SELECT AVG(duration_ms) as avg FROM search_logs WHERE duration_ms IS NOT NULL')?.avg || 110;

  res.json({
    totalProducts,
    activeStores,
    activeOffers,
    outdatedOffers,
    searchesThisMonth,
    searchesNoResults,
    externalSuccessRate,
    dataCoverage,
    providerErrors,
    averageSearchLatencyMs: Math.round(avgLatency),
    lastUpdated: new Date().toISOString()
  });
});

apiRouter.get('/admin/charts', (_req: Request, res: Response) => {
  // 1. Offer coverage by store
  const storeCoverage = dbAll(`
    SELECT s.name, s.name_ar, COUNT(po.id) as offer_count
    FROM stores s
    LEFT JOIN product_offers po ON s.id = po.store_id
    GROUP BY s.id
    ORDER BY offer_count DESC
  `);

  // 2. Price distribution by category
  const categoryPriceDist = dbAll(`
    SELECT c.name_ar as category, AVG(po.product_price) as avg_price, MIN(po.product_price) as min_price, MAX(po.product_price) as max_price
    FROM categories c
    JOIN products p ON c.id = p.category_id
    JOIN product_offers po ON p.id = po.product_id
    GROUP BY c.id
  `);

  // 3. Search logs by date
  const searchLogsTrend = dbAll(`
    SELECT SUBSTR(created_at, 1, 10) as date, COUNT(*) as searches, AVG(duration_ms) as avg_latency
    FROM search_logs
    GROUP BY SUBSTR(created_at, 1, 10)
    ORDER BY date ASC
    LIMIT 14
  `);

  res.json({
    storeCoverage,
    categoryPriceDist,
    searchLogsTrend
  });
});

apiRouter.get('/admin/providers', async (_req: Request, res: Response) => {
  const serpHealth = await serpProvider.getHealth();
  const geminiHealth = await geminiProvider.getHealth();
  const recentEvents = dbAll('SELECT * FROM provider_events ORDER BY timestamp DESC LIMIT 15');

  res.json({
    providers: [serpHealth, geminiHealth],
    recentEvents
  });
});

apiRouter.post('/admin/providers/:provider/test', async (req: Request, res: Response) => {
  const { provider } = req.params;
  const testQuery = 'iPhone 15 Pro';

  if (provider === 'serpapi') {
    const result = await serpProvider.searchShoppingOffers(testQuery);
    return res.json(result);
  } else if (provider === 'gemini_grounding') {
    const result = await geminiProvider.searchShoppingOffers(testQuery);
    return res.json(result);
  }

  res.status(400).json({ error: 'المزود غير معروف' });
});

// Matching Reviews
apiRouter.get('/admin/matching-reviews', (_req: Request, res: Response) => {
  const reviews = dbAll(`
    SELECT mr.*, p.name as matched_product_name, p.name_ar as matched_product_name_ar
    FROM matching_reviews mr
    LEFT JOIN products p ON mr.matched_product_id = p.id
    ORDER BY mr.created_at DESC
  `);
  res.json(reviews);
});

apiRouter.post('/admin/matching-reviews/:id/decision', (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, notes } = req.body; // 'approved' | 'rejected' | 'corrected'

  dbRun(`
    UPDATE matching_reviews
    SET status = ?, notes = ?, reviewed_at = ?
    WHERE id = ?
  `, [decision, notes || null, new Date().toISOString(), id]);

  res.json({ success: true });
});

// Admin Product CRUD
apiRouter.post('/admin/products', (req: Request, res: Response) => {
  const { name, name_ar, brand, model, category_id, specifications, image_url } = req.body;
  if (!name || !name_ar) return res.status(400).json({ error: 'Product name is required' });

  const id = `prod_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const norm = `${name} ${name_ar} ${brand || ''} ${model || ''}`.toLowerCase();

  dbRun(`
    INSERT INTO products (id, name, name_ar, normalized_name, brand, model, category_id, specifications, image_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, name_ar, norm, brand || null, model || null, category_id || null, JSON.stringify(specifications || {}), image_url || null, now, now]);

  res.json({ success: true, id });
});

apiRouter.put('/admin/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, name_ar, brand, model, category_id, specifications, image_url } = req.body;
  const now = new Date().toISOString();
  const norm = `${name} ${name_ar} ${brand || ''} ${model || ''}`.toLowerCase();

  dbRun(`
    UPDATE products
    SET name = ?, name_ar = ?, normalized_name = ?, brand = ?, model = ?, category_id = ?, specifications = ?, image_url = ?, updated_at = ?
    WHERE id = ?
  `, [name, name_ar, norm, brand || null, model || null, category_id || null, JSON.stringify(specifications || {}), image_url || null, now, id]);

  res.json({ success: true });
});

apiRouter.delete('/admin/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  dbRun('DELETE FROM products WHERE id = ?', [id]);
  res.json({ success: true });
});

// Admin Offer CRUD
apiRouter.post('/admin/offers', (req: Request, res: Response) => {
  const { product_id, store_id, source_url, product_price, shipping_cost, discount_amount, additional_fees, availability, verification_status } = req.body;
  if (!product_id || !source_url) return res.status(400).json({ error: 'product_id and source_url are required' });

  const id = `off_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  dbRun(`
    INSERT INTO product_offers (
      id, product_id, store_id, source_url, product_price, shipping_cost, discount_amount,
      additional_fees, currency, availability, source_type, verification_status, last_checked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EGP', ?, 'manual', ?, ?, ?, ?)
  `, [
    id, product_id, store_id || null, source_url, product_price ?? null, shipping_cost ?? null,
    discount_amount ?? 0, additional_fees ?? 0, availability || 'in_stock',
    verification_status || 'verified', now, now, now
  ]);

  // Insert price history
  if (product_price) {
    dbRun(`
      INSERT INTO price_history (id, offer_id, recorded_price, currency, recorded_at)
      VALUES (?, ?, ?, 'EGP', ?)
    `, [`ph_${id}_0`, id, product_price, now]);
  }

  res.json({ success: true, id });
});

apiRouter.put('/admin/offers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { store_id, source_url, product_price, shipping_cost, discount_amount, additional_fees, availability, verification_status } = req.body;
  const now = new Date().toISOString();

  dbRun(`
    UPDATE product_offers
    SET store_id = ?, source_url = ?, product_price = ?, shipping_cost = ?,
        discount_amount = ?, additional_fees = ?, availability = ?,
        verification_status = ?, last_checked_at = ?, updated_at = ?
    WHERE id = ?
  `, [
    store_id || null, source_url, product_price ?? null, shipping_cost ?? null,
    discount_amount ?? 0, additional_fees ?? 0, availability || 'in_stock',
    verification_status || 'verified', now, now, id
  ]);

  if (product_price) {
    dbRun(`
      INSERT INTO price_history (id, offer_id, recorded_price, currency, recorded_at)
      VALUES (?, ?, ?, 'EGP', ?)
    `, [`ph_${id}_${Date.now()}`, id, product_price, now]);
  }

  res.json({ success: true });
});

apiRouter.delete('/admin/offers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  dbRun('DELETE FROM product_offers WHERE id = ?', [id]);
  res.json({ success: true });
});
