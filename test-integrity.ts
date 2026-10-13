import { calculateTotalCost } from './src/server/services/priceCalculation.js';
import { matchCandidateToCatalog, extractCapacity, normalizeText } from './src/server/services/matchingService.js';
import { getDb, dbGet, dbAll } from './src/server/db/database.js';
import { SerpApiProvider } from './src/server/providers/serpapiProvider.js';
import { GeminiGroundingProvider } from './src/server/providers/geminiGroundingProvider.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log('=== RUNNING SMARTSHOP AI INTEGRITY TESTS ===\n');

  // Test 1: Total Cost Arithmetic with complete data
  try {
    const calc = calculateTotalCost({
      product_price: 54999,
      shipping_cost: 35,
      additional_fees: 0,
      discount_amount: 1000,
      currency: 'EGP'
    });
    assert(calc.isComplete === true, 'Calculation should be marked complete');
    assert(calc.totalCost === 54034, `Expected totalCost 54034, got ${calc.totalCost}`);
    assert(calc.currency === 'EGP', 'Currency must be preserved');
    results.push({ name: 'Total Cost: Complete arithmetic calculation', passed: true });
  } catch (err: any) {
    results.push({ name: 'Total Cost: Complete arithmetic calculation', passed: false, error: err.message });
  }

  // Test 2: Unknown shipping remains unknown and incomplete
  try {
    const calc = calculateTotalCost({
      product_price: 54800,
      shipping_cost: null,
      additional_fees: 0,
      discount_amount: 0,
      currency: 'EGP'
    });
    assert(calc.isComplete === false, 'Unknown shipping must NOT produce confirmed complete total');
    assert(calc.totalCost === null, 'totalCost must remain null when incomplete');
    assert(calc.isShippingKnown === false, 'isShippingKnown must be false');
    results.push({ name: 'Total Cost: Unknown shipping preservation', passed: true });
  } catch (err: any) {
    results.push({ name: 'Total Cost: Unknown shipping preservation', passed: false, error: err.message });
  }

  // Test 3: Discount amount is not double-counted or exceeding price
  try {
    const calc = calculateTotalCost({
      product_price: 1000,
      shipping_cost: 50,
      discount_amount: 2000, // Excessive discount capped at product price
      currency: 'EGP'
    });
    assert(calc.discountAmount === 1000, 'Discount must be capped at product price');
    assert(calc.totalCost === 50, `Expected totalCost 50, got ${calc.totalCost}`);
    results.push({ name: 'Total Cost: Discount validation & capping', passed: true });
  } catch (err: any) {
    results.push({ name: 'Total Cost: Discount validation & capping', passed: false, error: err.message });
  }

  // Test 4: Capacity extraction and variant conflict prevention
  try {
    const cap1 = extractCapacity('Apple iPhone 15 Pro 128GB');
    const cap2 = extractCapacity('Apple iPhone 15 Pro 256GB');
    assert(cap1 === '128gb', `Expected 128gb, got ${cap1}`);
    assert(cap2 === '256gb', `Expected 256gb, got ${cap2}`);
    assert(cap1 !== cap2, 'Capacities must be distinct');
    results.push({ name: 'Variants: Capacity extraction', passed: true });
  } catch (err: any) {
    results.push({ name: 'Variants: Capacity extraction', passed: false, error: err.message });
  }

  // Test 5: Database initialization and persistence
  try {
    await getDb();
    const count = dbGet<any>('SELECT COUNT(*) as count FROM products');
    assert(count && count.count > 0, 'Database must have seeded products');
    const storesCount = dbGet<any>('SELECT COUNT(*) as count FROM stores');
    assert(storesCount && storesCount.count >= 6, 'Database must have Egyptian stores');
    results.push({ name: 'Database: SQLite persistence and seeding', passed: true });
  } catch (err: any) {
    results.push({ name: 'Database: SQLite persistence and seeding', passed: false, error: err.message });
  }

  // Test 6: Deterministic Product Matching - Exact match
  try {
    const match = matchCandidateToCatalog('Apple iPhone 15 Pro 128GB Natural Titanium');
    assert(match.matchType === 'exact', `Expected exact match, got ${match.matchType}`);
    assert(match.matchedProduct !== null, 'Matched product must exist');
    results.push({ name: 'Matching: Exact catalog match', passed: true });
  } catch (err: any) {
    results.push({ name: 'Matching: Exact catalog match', passed: false, error: err.message });
  }

  // Test 7: Conflicting variant is classified as alternative, NEVER merged
  try {
    const matchAlt = matchCandidateToCatalog('Apple iPhone 15 Pro 256GB Natural Titanium');
    assert(matchAlt.matchType === 'alternative', `Expected alternative for conflicting capacity, got ${matchAlt.matchType}`);
    results.push({ name: 'Matching: Conflicting variant classified as alternative', passed: true });
  } catch (err: any) {
    results.push({ name: 'Matching: Conflicting variant classified as alternative', passed: false, error: err.message });
  }

  // Test 8: Unmatched query returns unmatched without hallucination
  try {
    const matchUnmatched = matchCandidateToCatalog('Guitar Acoustic Yamaha F310');
    assert(matchUnmatched.matchType === 'unmatched', `Expected unmatched, got ${matchUnmatched.matchType}`);
    results.push({ name: 'Matching: Unmatched item preservation', passed: true });
  } catch (err: any) {
    results.push({ name: 'Matching: Unmatched item preservation', passed: false, error: err.message });
  }

  // Test 9: SerpApi Provider handles missing key as not_configured
  try {
    const serp = new SerpApiProvider();
    const health = await serp.getHealth();
    if (!process.env.SERPAPI_API_KEY || process.env.SERPAPI_API_KEY === 'your_serpapi_key_here') {
      assert(health.status === 'not_configured', `Expected not_configured, got ${health.status}`);
      results.push({ name: 'Provider A (SerpApi): Safely reports not_configured when key absent', passed: true });
    } else {
      results.push({ name: 'Provider A (SerpApi): Key configured', passed: true });
    }
  } catch (err: any) {
    results.push({ name: 'Provider A (SerpApi): Status check', passed: false, error: err.message });
  }

  // Test 10: Gemini Provider status check
  try {
    const gemini = new GeminiGroundingProvider();
    const health = await gemini.getHealth();
    assert(health.provider === 'gemini_grounding', 'Provider name must be gemini_grounding');
    results.push({ name: 'Provider B (Gemini): Health check instantiated', passed: true });
  } catch (err: any) {
    results.push({ name: 'Provider B (Gemini): Health check', passed: false, error: err.message });
  }

  // Report Summary
  console.log('\n--- TEST RESULTS SUMMARY ---');
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const r of results) {
    if (r.skipped) {
      skippedCount++;
      console.log(`[SKIPPED] ${r.name} - ${r.skipReason}`);
    } else if (r.passed) {
      passedCount++;
      console.log(`[PASSED]  ${r.name}`);
    } else {
      failedCount++;
      console.log(`[FAILED]  ${r.name} - ${r.error}`);
    }
  }

  console.log(`\nTOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount} | SKIPPED: ${skippedCount}\n`);
}

runTests().catch(console.error);
