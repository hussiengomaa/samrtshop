import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'smartshop.sqlite');

let db: Database | null = null;
let isSaving = false;

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('[DB] Loaded existing SQLite database from disk.');
    } catch (err) {
      console.error('[DB] Failed to read database file, creating fresh DB:', err);
      db = new SQL.Database();
    }
  } else {
    console.log('[DB] Initializing new SQLite database.');
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  // Run migrations
  await runMigrations(db);

  // Persist to disk
  saveDbToDisk();

  return db;
}

export function saveDbToDisk(): void {
  if (!db || isSaving) return;
  try {
    isSaving = true;
    const data = db.export();
    const buffer = Buffer.from(data);
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, buffer);
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Error writing database to disk:', err);
  } finally {
    isSaving = false;
  }
}

// Helper to run query returning array of objects
export function dbAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

// Helper to run query returning first object or null
export function dbGet<T = any>(sql: string, params: any[] = []): T | null {
  const all = dbAll<T>(sql, params);
  return all.length > 0 ? all[0] : null;
}

// Helper to run insert/update/delete
export function dbRun(sql: string, params: any[] = []): { changes: number } {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  const changes = db.getRowsModified();
  saveDbToDisk();
  return { changes };
}

async function runMigrations(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersionsStmt = database.prepare('SELECT version FROM schema_migrations');
  const appliedVersions = new Set<number>();
  while (appliedVersionsStmt.step()) {
    const row = appliedVersionsStmt.getAsObject();
    appliedVersions.add(Number(row.version));
  }
  appliedVersionsStmt.free();

  // Migration 1: Schema creation
  if (!appliedVersions.has(1)) {
    console.log('[DB] Applying Migration 001: Initial schema');
    database.run(`
      -- Categories
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        parent_id TEXT,
        icon TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Products
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        category_id TEXT,
        specifications TEXT NOT NULL DEFAULT '{}',
        image_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_products_normalized ON products(normalized_name);
      CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

      -- Stores
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        website_url TEXT NOT NULL,
        logo_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Product Offers
      CREATE TABLE IF NOT EXISTS product_offers (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        store_id TEXT,
        source_url TEXT NOT NULL,
        product_price REAL,
        shipping_cost REAL,
        discount_amount REAL DEFAULT 0,
        additional_fees REAL DEFAULT 0,
        currency TEXT DEFAULT 'EGP',
        availability TEXT NOT NULL DEFAULT 'in_stock',
        source_type TEXT NOT NULL DEFAULT 'manual',
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        last_checked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_offers_product ON product_offers(product_id);
      CREATE INDEX IF NOT EXISTS idx_offers_store ON product_offers(store_id);

      -- External Search Observations
      CREATE TABLE IF NOT EXISTS external_search_observations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        query TEXT NOT NULL,
        title TEXT NOT NULL,
        source_url TEXT NOT NULL,
        store_name TEXT,
        price REAL,
        currency TEXT,
        shipping_cost REAL,
        availability TEXT,
        raw_source_reference TEXT,
        retrieved_at TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        match_confidence REAL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_obs_provider_query ON external_search_observations(provider, query);

      -- Price History
      CREATE TABLE IF NOT EXISTS price_history (
        id TEXT PRIMARY KEY,
        offer_id TEXT NOT NULL,
        recorded_price REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EGP',
        recorded_at TEXT NOT NULL,
        FOREIGN KEY (offer_id) REFERENCES product_offers(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_price_history_offer ON price_history(offer_id);

      -- User Profiles
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Favorites
      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      -- Search Logs
      CREATE TABLE IF NOT EXISTS search_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        query TEXT NOT NULL,
        normalized_query TEXT NOT NULL,
        search_source_summary TEXT NOT NULL DEFAULT 'hybrid',
        result_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'success',
        duration_ms INTEGER,
        cache_hit INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at);

      -- Saved Searches
      CREATE TABLE IF NOT EXISTS saved_searches (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        normalized_query TEXT NOT NULL,
        filters TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
      );

      -- Price Alerts
      CREATE TABLE IF NOT EXISTS price_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        target_price REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EGP',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      -- Provider Events and Health
      CREATE TABLE IF NOT EXISTS provider_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        error_category TEXT,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        result_count INTEGER NOT NULL DEFAULT 0,
        cache_hit INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_provider_events_provider ON provider_events(provider);

      -- Matching Reviews
      CREATE TABLE IF NOT EXISTS matching_reviews (
        id TEXT PRIMARY KEY,
        observation_id TEXT,
        candidate_title TEXT NOT NULL,
        candidate_price REAL,
        candidate_currency TEXT,
        candidate_store TEXT,
        candidate_url TEXT NOT NULL,
        matched_product_id TEXT,
        match_type TEXT NOT NULL DEFAULT 'probable',
        match_confidence REAL NOT NULL DEFAULT 0.5,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (matched_product_id) REFERENCES products(id) ON DELETE SET NULL
      );
    `);

    database.run(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [1, '001_initial_schema', new Date().toISOString()]
    );
  }

  // Migration 2: Initial Seed Data for Egyptian Market
  if (!appliedVersions.has(2)) {
    console.log('[DB] Applying Migration 002: Seed Egyptian retail catalog');
    seedEgyptianCatalog(database);
    database.run(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [2, '002_seed_egyptian_catalog', new Date().toISOString()]
    );
  }
}

function seedEgyptianCatalog(database: Database) {
  const now = new Date().toISOString();
  const pastDays = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

  // Admin user
  const adminId = 'usr_admin_001';
  database.run(`
    INSERT INTO user_profiles (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    adminId,
    'مدير النظام / Administrator',
    'admin@smartshop.ai',
    // SHA256 of 'AdminPass2026!'
    crypto.createHash('sha256').update('AdminPass2026!').digest('hex'),
    'admin',
    now,
    now
  ]);

  // Categories
  const categories = [
    { id: 'cat_phones', name: 'Smartphones & Tablets', name_ar: 'الموبايلات والأجهزة اللوحية', slug: 'smartphones', icon: 'Smartphone' },
    { id: 'cat_laptops', name: 'Laptops & Computers', name_ar: 'اللابتوبات والكمبيوتر', slug: 'laptops', icon: 'Laptop' },
    { id: 'cat_home_appliances', name: 'Home Appliances', name_ar: 'الأجهزة المنزلية والغسالات', slug: 'home-appliances', icon: 'Home' },
    { id: 'cat_tvs', name: 'TVs & Screens', name_ar: 'التلفزيونات والشاشات', slug: 'tvs', icon: 'Tv' },
    { id: 'cat_wearables', name: 'Smart Watches & Audio', name_ar: 'الساعات الذكية والسماعات', slug: 'wearables', icon: 'Watch' },
    { id: 'cat_kitchen', name: 'Kitchen & Cooking', name_ar: 'أجهزة المطبخ والقهوة', slug: 'kitchen', icon: 'Utensils' }
  ];

  for (const c of categories) {
    database.run(
      'INSERT INTO categories (id, name, name_ar, slug, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [c.id, c.name, c.name_ar, c.slug, c.icon, now, now]
    );
  }

  // Egyptian Stores
  const stores = [
    { id: 'store_amazon_eg', name: 'Amazon Egypt', name_ar: 'أمازون مصر', website_url: 'https://www.amazon.eg', logo_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=128&auto=format&fit=crop&q=80' },
    { id: 'store_noon_eg', name: 'Noon Egypt', name_ar: 'نون مصر', website_url: 'https://www.noon.com/egypt-en/', logo_url: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=128&auto=format&fit=crop&q=80' },
    { id: 'store_jumia_eg', name: 'Jumia Egypt', name_ar: 'جوميا مصر', website_url: 'https://www.jumia.com.eg', logo_url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=128&auto=format&fit=crop&q=80' },
    { id: 'store_btech', name: 'B.TECH Egypt', name_ar: 'بي تك مصر', website_url: 'https://btech.com/ar', logo_url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=128&auto=format&fit=crop&q=80' },
    { id: 'store_2b', name: '2B Computer', name_ar: '2B كمبيوتر', website_url: 'https://2b.com.eg', logo_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=128&auto=format&fit=crop&q=80' },
    { id: 'store_raya', name: 'Raya Shop', name_ar: 'راية شوب', website_url: 'https://rayashop.com', logo_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=128&auto=format&fit=crop&q=80' }
  ];

  for (const s of stores) {
    database.run(
      'INSERT INTO stores (id, name, name_ar, website_url, logo_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [s.id, s.name, s.name_ar, s.website_url, s.logo_url, 'active', now, now]
    );
  }

  // Real Popular Products in Egypt
  const products = [
    {
      id: 'prod_iphone15pro_128',
      name: 'Apple iPhone 15 Pro 128GB Natural Titanium',
      name_ar: 'آبل آيفون 15 برو 128 جيجابايت تيتانيوم طبيعي',
      normalized_name: 'apple iphone 15 pro 128gb natural titanium',
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      category_id: 'cat_phones',
      image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80',
      specs: {
        capacity: '128GB',
        ram: '8GB',
        processor: 'Apple A17 Pro (3nm)',
        screen: '6.1 inch Super Retina XDR OLED 120Hz',
        mainCamera: '48MP + 12MP + 12MP',
        battery: '3274 mAh',
        color: 'Natural Titanium'
      },
      offers: [
        { id: 'off_ip15_amz', store_id: 'store_amazon_eg', price: 54999, shipping: 35, discount: 1000, fees: 0, url: 'https://www.amazon.eg/dp/B0CHX1W14C', verified: 'verified', history: [56500, 55800, 54999] },
        { id: 'off_ip15_noon', store_id: 'store_noon_eg', price: 55490, shipping: 40, discount: 500, fees: 0, url: 'https://www.noon.com/egypt-en/p-129481', verified: 'verified', history: [56000, 55490] },
        { id: 'off_ip15_btech', store_id: 'store_btech', price: 56900, shipping: 0, discount: 0, fees: 0, url: 'https://btech.com/ar/apple-iphone-15-pro-128gb', verified: 'verified', history: [57500, 56900] },
        { id: 'off_ip15_jumia', store_id: 'store_jumia_eg', price: 54800, shipping: null, discount: 0, fees: 50, url: 'https://www.jumia.com.eg/catalog/?q=iphone+15+pro', verified: 'unverified', history: [54800] }
      ]
    },
    {
      id: 'prod_samsung_s24u_256',
      name: 'Samsung Galaxy S24 Ultra 5G 256GB Titanium Gray',
      name_ar: 'سامسونج جالاكسي اس 24 الترا 256 جيجابايت رمادي تيتانيوم',
      normalized_name: 'samsung galaxy s24 ultra 5g 256gb titanium gray',
      brand: 'Samsung',
      model: 'Galaxy S24 Ultra',
      category_id: 'cat_phones',
      image_url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&auto=format&fit=crop&q=80',
      specs: {
        capacity: '256GB',
        ram: '12GB',
        processor: 'Snapdragon 8 Gen 3 for Galaxy',
        screen: '6.8 inch Dynamic LTPO AMOLED 2X 120Hz',
        mainCamera: '200MP + 50MP + 12MP + 10MP',
        battery: '5000 mAh 45W Fast Charging',
        color: 'Titanium Gray',
        features: 'S-Pen Integrated, Galaxy AI'
      },
      offers: [
        { id: 'off_s24_amz', store_id: 'store_amazon_eg', price: 51200, shipping: 30, discount: 1200, fees: 0, url: 'https://www.amazon.eg/dp/B0CS5PXZ1C', verified: 'verified', history: [53000, 52000, 51200] },
        { id: 'off_s24_noon', store_id: 'store_noon_eg', price: 50999, shipping: 45, discount: 0, fees: 0, url: 'https://www.noon.com/egypt-en/p-203814', verified: 'verified', history: [52500, 50999] },
        { id: 'off_s24_raya', store_id: 'store_raya', price: 52400, shipping: 0, discount: 500, fees: 0, url: 'https://rayashop.com/samsung-s24-ultra', verified: 'verified', history: [53500, 52400] }
      ]
    },
    {
      id: 'prod_macbook_air_m2',
      name: 'Apple MacBook Air 13.6" M2 Chip 8GB RAM 256GB SSD Midnight',
      name_ar: 'آبل ماك بوك اير 13.6 بوصة معالج M2 رام 8 جيجا 256 اس اس دي',
      normalized_name: 'apple macbook air 13.6 m2 chip 8gb ram 256gb ssd midnight',
      brand: 'Apple',
      model: 'MacBook Air M2',
      category_id: 'cat_laptops',
      image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
      specs: {
        processor: 'Apple M2 8-core CPU / 8-core GPU',
        ram: '8GB Unified Memory',
        storage: '256GB SSD',
        display: '13.6 inch Liquid Retina True Tone',
        battery: 'Up to 18 hours',
        weight: '1.24 kg'
      },
      offers: [
        { id: 'off_mac_2b', store_id: 'store_2b', price: 47999, shipping: 50, discount: 1500, fees: 0, url: 'https://2b.com.eg/apple-macbook-air-m2', verified: 'verified', history: [49999, 48500, 47999] },
        { id: 'off_mac_amz', store_id: 'store_amazon_eg', price: 48500, shipping: 35, discount: 0, fees: 0, url: 'https://www.amazon.eg/dp/B0B3C9B6A1', verified: 'verified', history: [49000, 48500] },
        { id: 'off_mac_btech', store_id: 'store_btech', price: 49400, shipping: 0, discount: 0, fees: 0, url: 'https://btech.com/ar/macbook-air-m2', verified: 'verified', history: [50000, 49400] }
      ]
    },
    {
      id: 'prod_lg_tv_55_4k',
      name: 'LG 55 Inch 4K UHD Smart TV with WebOS & HDR10 Pro 55UR78006LK',
      name_ar: 'تلفزيون ال جي 55 بوصة سمارت 4K الترا اتش دي بنظام WebOS',
      normalized_name: 'lg 55 inch 4k uhd smart tv webos hdr10 55ur78006lk',
      brand: 'LG',
      model: '55UR78006LK',
      category_id: 'cat_tvs',
      image_url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
      specs: {
        screenSize: '55 inch',
        resolution: '4K Ultra HD (3840 x 2160)',
        os: 'webOS 23 Smart TV',
        refreshRate: '60Hz Native',
        audio: '20W AI Sound Pro',
        hdr: 'HDR10 Pro & HLG'
      },
      offers: [
        { id: 'off_lgtv_amz', store_id: 'store_amazon_eg', price: 21999, shipping: 60, discount: 1000, fees: 0, url: 'https://www.amazon.eg/dp/B0C89283K1', verified: 'verified', history: [23500, 22500, 21999] },
        { id: 'off_lgtv_btech', store_id: 'store_btech', price: 22499, shipping: 0, discount: 500, fees: 0, url: 'https://btech.com/ar/lg-55-smart-4k', verified: 'verified', history: [23000, 22499] },
        { id: 'off_lgtv_noon', store_id: 'store_noon_eg', price: 21850, shipping: 85, discount: 0, fees: 0, url: 'https://www.noon.com/egypt-en/p-847291', verified: 'verified', history: [22200, 21850] }
      ]
    },
    {
      id: 'prod_toshiba_washer_8kg',
      name: 'Toshiba Automatic Washing Machine 8KG Top Loading Inverter Silver',
      name_ar: 'غسالة توشيبا فوق أوتوماتيك 8 كيلو سيلفر موفرة للكهرباء انفرتر',
      normalized_name: 'toshiba automatic washing machine 8kg top loading inverter silver',
      brand: 'Toshiba',
      model: 'AW-DUK900',
      category_id: 'cat_home_appliances',
      image_url: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&auto=format&fit=crop&q=80',
      specs: {
        capacity: '8 KG',
        loadingType: 'Top Loading (تحميل علوي)',
        motor: 'Direct Drive Inverter (موفر فائق للطاقة)',
        programs: '8 Programs including Quick Wash',
        energyEfficiency: 'Class A (أعلى كفاءة استهلاك)'
      },
      offers: [
        { id: 'off_tosh_raya', store_id: 'store_raya', price: 13990, shipping: 80, discount: 500, fees: 0, url: 'https://rayashop.com/toshiba-washer-8kg', verified: 'verified', history: [14500, 13990] },
        { id: 'off_tosh_btech', store_id: 'store_btech', price: 14200, shipping: 0, discount: 0, fees: 0, url: 'https://btech.com/ar/toshiba-8kg-washer', verified: 'verified', history: [14400, 14200] },
        { id: 'off_tosh_amz', store_id: 'store_amazon_eg', price: 13850, shipping: 100, discount: 0, fees: 0, url: 'https://www.amazon.eg/dp/B07X9918K2', verified: 'verified', history: [14100, 13850] }
      ]
    },
    {
      id: 'prod_lenovo_ideapad_i5',
      name: 'Lenovo IdeaPad Slim 3 15.6" FHD Intel Core i5-12450H 16GB RAM 512GB SSD',
      name_ar: 'لابتوب لينوفو ايدياباد سليم 3 كور i5 رام 16 جيجا هارد 512 اس اس دي للدراسة والبرمجة',
      normalized_name: 'lenovo ideapad slim 3 15.6 fhd intel core i5 16gb ram 512gb ssd',
      brand: 'Lenovo',
      model: 'IdeaPad Slim 3',
      category_id: 'cat_laptops',
      image_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80',
      specs: {
        processor: 'Intel Core i5-12450H (8 Cores, up to 4.4GHz)',
        ram: '16GB DDR5',
        storage: '512GB NVMe M.2 SSD',
        display: '15.6 inch FHD IPS Anti-Glare 300 nits',
        graphics: 'Intel UHD Graphics',
        suitability: 'ممتاز للدراسة، البرمجة، والعمل المكتبي الشاق'
      },
      offers: [
        { id: 'off_len_2b', store_id: 'store_2b', price: 23999, shipping: 45, discount: 800, fees: 0, url: 'https://2b.com.eg/lenovo-ideapad-slim-3-i5', verified: 'verified', history: [25500, 24500, 23999] },
        { id: 'off_len_amz', store_id: 'store_amazon_eg', price: 24300, shipping: 30, discount: 500, fees: 0, url: 'https://www.amazon.eg/dp/B0CL8182KJ', verified: 'verified', history: [25000, 24300] },
        { id: 'off_len_noon', store_id: 'store_noon_eg', price: 24150, shipping: 40, discount: 0, fees: 0, url: 'https://www.noon.com/egypt-en/p-983102', verified: 'verified', history: [24800, 24150] }
      ]
    },
    {
      id: 'prod_xiaomi_redmi_note13',
      name: 'Xiaomi Redmi Note 13 8GB RAM 256GB Midnight Black',
      name_ar: 'شاومي ريدمي نوت 13 مساحة 256 جيجا رام 8 جيجا أسود',
      normalized_name: 'xiaomi redmi note 13 8gb ram 256gb midnight black',
      brand: 'Xiaomi',
      model: 'Redmi Note 13',
      category_id: 'cat_phones',
      image_url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80',
      specs: {
        capacity: '256GB',
        ram: '8GB',
        processor: 'Snapdragon 685 (6nm)',
        screen: '6.67 inch AMOLED 120Hz 1800 nits peak',
        mainCamera: '108MP 3x in-sensor zoom',
        battery: '5000 mAh 33W Fast Charging'
      },
      offers: [
        { id: 'off_rn13_amz', store_id: 'store_amazon_eg', price: 9299, shipping: 25, discount: 300, fees: 0, url: 'https://www.amazon.eg/dp/B0CQ76X1N2', verified: 'verified', history: [9800, 9499, 9299] },
        { id: 'off_rn13_noon', store_id: 'store_noon_eg', price: 9199, shipping: 35, discount: 0, fees: 0, url: 'https://www.noon.com/egypt-en/p-873918', verified: 'verified', history: [9600, 9199] },
        { id: 'off_rn13_raya', store_id: 'store_raya', price: 9400, shipping: 0, discount: 0, fees: 0, url: 'https://rayashop.com/xiaomi-redmi-note-13-256', verified: 'verified', history: [9700, 9400] }
      ]
    }
  ];

  for (const p of products) {
    database.run(`
      INSERT INTO products (id, name, name_ar, normalized_name, brand, model, category_id, specifications, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      p.id,
      p.name,
      p.name_ar,
      p.normalized_name,
      p.brand,
      p.model,
      p.category_id,
      JSON.stringify(p.specs),
      p.image_url,
      now,
      now
    ]);

    for (const off of p.offers) {
      database.run(`
        INSERT INTO product_offers (
          id, product_id, store_id, source_url, product_price, shipping_cost, discount_amount, additional_fees, currency, availability, source_type, verification_status, last_checked_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        off.id,
        p.id,
        off.store_id,
        off.url,
        off.price,
        off.shipping,
        off.discount,
        off.fees,
        'EGP',
        'in_stock',
        'manual',
        off.verified,
        now,
        now,
        now
      ]);

      // Seed real recorded price history
      if (off.history && off.history.length > 0) {
        off.history.forEach((histPrice, idx) => {
          const histId = `ph_${off.id}_${idx}`;
          const dateRecorded = pastDays((off.history.length - 1 - idx) * 7);
          database.run(`
            INSERT INTO price_history (id, offer_id, recorded_price, currency, recorded_at)
            VALUES (?, ?, ?, ?, ?)
          `, [histId, off.id, histPrice, 'EGP', dateRecorded]);
        });
      }
    }
  }

  // Initial recorded provider event
  database.run(`
    INSERT INTO provider_events (id, provider, event_type, status, error_category, latency_ms, result_count, cache_hit, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'pe_init_001',
    'gemini_grounding',
    'health_check',
    'ok',
    null,
    280,
    1,
    0,
    now
  ]);

  // Initial search logs for real metrics
  database.run(`
    INSERT INTO search_logs (id, user_id, query, normalized_query, search_source_summary, result_count, status, duration_ms, cache_hit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'sl_init_001',
    null,
    'ايفون 15 برو',
    'ايفون 15 برو',
    'hybrid',
    4,
    'success',
    125,
    0,
    pastDays(1)
  ]);

  database.run(`
    INSERT INTO search_logs (id, user_id, query, normalized_query, search_source_summary, result_count, status, duration_ms, cache_hit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'sl_init_002',
    null,
    'لابتوب دراسة وبرمجة',
    'لابتوب دراسة وبرمجة',
    'internal',
    2,
    'success',
    85,
    0,
    pastDays(2)
  ]);
}
