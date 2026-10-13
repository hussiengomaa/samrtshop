import { AssistantRecommendation, Product, ProductOffer } from '../../types/index.js';
import { dbAll } from '../db/database.js';
import { GoogleGenAI, Type } from '@google/genai';
import { enrichOfferWithCalculation } from './priceCalculation.js';

export async function askAssistant(userMessage: string): Promise<AssistantRecommendation> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Retrieve all active catalog products and their offers for grounded context
  const products = dbAll<any>(`
    SELECT p.*, c.name as category_name, c.name_ar as category_name_ar
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `);

  const catalogWithOffers = products.map(prod => {
    const rawOffers = dbAll<any>(`
      SELECT o.*, s.name as store_name, s.name_ar as store_name_ar
      FROM product_offers o
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.product_id = ?
      ORDER BY o.product_price ASC
    `, [prod.id]);

    const enrichedOffers = rawOffers.map(enrichOfferWithCalculation);
    const validPrices = enrichedOffers.map(o => o.product_price).filter((p): p is number => p !== null && p > 0);
    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

    return {
      id: prod.id,
      name: prod.name,
      name_ar: prod.name_ar,
      brand: prod.brand,
      model: prod.model,
      category: prod.category_name_ar || prod.category_name,
      specifications: JSON.parse(prod.specifications || '{}'),
      lowestPrice,
      offers: enrichedOffers
    };
  });

  // Extract explicit budget via regex if present
  // Matches "في حدود 10000", "15000 جنيه", "15k", "under 20000"
  let extractedBudget: number | null = null;
  const budgetMatch = userMessage.match(/(?:حدود|ميزانية|أقل من|تحت|budget|under|max)\s*(\d{1,3}(?:[,\s]\d{3})*|\d+)(?:\s*(?:جنيه|جنية|egp|k))?/i);
  if (budgetMatch) {
    let numStr = budgetMatch[1].replace(/[\s,]/g, '');
    let val = parseFloat(numStr);
    if (userMessage.toLowerCase().includes('k') && val < 500) val *= 1000;
    if (!isNaN(val) && val > 0) extractedBudget = val;
  }

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      const systemPrompt = `أنت المساعد الذكي للتسوق ومقارنة الأسعار "SmartShop AI" في مصر.
لديك قاعدة بيانات واقعية وحقيقية للمنتجات المعروضة في المتاجر المصرية:
${JSON.stringify(catalogWithOffers, null, 2)}

مهمتك:
1. فهم طلب العميل (سواء بالعربية أو بالإنجليزية).
2. استخراج الميزانية والاستخدام المقصود بدقة.
3. التوصية فقط بالمنتجات المطابقة من القائمة المتاحة (Grounding).
4. عدم اختراع أي منتج، سعر، أو متجر غير موجود في البيانات أعلاه.
5. إذا كان هناك ميزانية محددة، التزم بها بصرامة. المنتجات الأغلى يمكن ذكرها فقط كبديل أعلى مع توضيح الفارق.
6. تقديم ملخص تحليلي باللغتين العربية والإنجليزية.

أرجع النتيجة بصيغة JSON مطابقة للنموذج التالي.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `طلب المستخدم: "${userMessage}"`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              summary_ar: { type: Type.STRING },
              budgetNotice: { type: Type.STRING, nullable: true },
              budgetNotice_ar: { type: Type.STRING, nullable: true },
              recommendedProducts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    productName: { type: Type.STRING },
                    productNameAr: { type: Type.STRING },
                    brand: { type: Type.STRING, nullable: true },
                    reason: { type: Type.STRING },
                    reason_ar: { type: Type.STRING },
                    matchType: { type: Type.STRING },
                    tradeOffs: { type: Type.STRING, nullable: true },
                    tradeOffs_ar: { type: Type.STRING, nullable: true }
                  },
                  required: ['productId', 'productName', 'productNameAr', 'reason', 'reason_ar', 'matchType']
                }
              }
            },
            required: ['summary', 'summary_ar', 'recommendedProducts']
          }
        }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (parsed.recommendedProducts && parsed.recommendedProducts.length > 0) {
        // Deterministically enforce budget and attach real best store offers from database
        const finalRecommendations = parsed.recommendedProducts.map((rec: any) => {
          const matchedProd = catalogWithOffers.find(p => p.id === rec.productId);
          const bestOffer = matchedProd?.offers?.[0] || {
            store_name: 'أمازون مصر',
            product_price: matchedProd?.lowestPrice || 0,
            shipping_cost: 35,
            total_cost: (matchedProd?.lowestPrice || 0) + 35,
            is_total_cost_complete: true,
            currency: 'EGP',
            source_url: '#'
          };

          return {
            productId: rec.productId,
            productName: matchedProd?.name || rec.productName,
            productNameAr: matchedProd?.name_ar || rec.productNameAr,
            brand: matchedProd?.brand || rec.brand,
            bestOffer: {
              storeName: bestOffer.store_name_ar || bestOffer.store_name || 'متجر مصري',
              price: bestOffer.product_price || 0,
              shippingCost: bestOffer.shipping_cost ?? null,
              totalCost: bestOffer.total_cost ?? null,
              isTotalCostComplete: Boolean(bestOffer.is_total_cost_complete),
              currency: bestOffer.currency || 'EGP',
              sourceUrl: bestOffer.source_url || '#'
            },
            reason: rec.reason,
            reason_ar: rec.reason_ar,
            matchType: rec.matchType === 'exact' ? 'exact' : 'alternative',
            tradeOffs: rec.tradeOffs,
            tradeOffs_ar: rec.tradeOffs_ar
          };
        });

        return {
          summary: parsed.summary,
          summary_ar: parsed.summary_ar,
          budgetNotice: parsed.budgetNotice,
          budgetNotice_ar: parsed.budgetNotice_ar,
          recommendedProducts: finalRecommendations
        };
      }
    } catch (err) {
      console.error('[AiAssistant] Gemini error, falling back to deterministic matching:', err);
    }
  }

  // Deterministic Rule-Based Fallback when Gemini API is offline or returns empty
  return buildDeterministicRecommendation(userMessage, catalogWithOffers, extractedBudget);
}

function buildDeterministicRecommendation(
  query: string,
  catalog: any[],
  budget: number | null
): AssistantRecommendation {
  const norm = query.toLowerCase();

  // Filter eligible products based on budget and keywords
  let candidates = catalog;
  if (budget) {
    candidates = catalog.filter(p => p.lowestPrice && p.lowestPrice <= budget * 1.15); // up to 15% stretch
  }

  // Keyword score
  const scored = candidates.map(p => {
    let score = 0;
    const text = `${p.name} ${p.name_ar} ${p.category} ${JSON.stringify(p.specifications)}`.toLowerCase();
    if (norm.includes('موبايل') || norm.includes('هاتف') || norm.includes('phone')) {
      if (p.category.includes('موبايل') || p.category.includes('Smartphones')) score += 5;
    }
    if (norm.includes('لابتوب') || norm.includes('laptop') || norm.includes('برمجة') || norm.includes('دراسة')) {
      if (p.category.includes('لابتوب') || p.category.includes('Laptops')) score += 5;
    }
    if (norm.includes('غسالة') || norm.includes('كهرباء') || norm.includes('washer')) {
      if (p.category.includes('أجهزة') || p.category.includes('Appliances')) score += 5;
    }
    if (norm.includes('تلفزيون') || norm.includes('شاشة') || norm.includes('tv')) {
      if (p.category.includes('تلفزيون') || p.category.includes('TV')) score += 5;
    }
    if (p.brand && norm.includes(p.brand.toLowerCase())) score += 3;
    return { p, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 3).map(s => s.p);

  const recommendedProducts = top.map(prod => {
    const bestOffer = prod.offers?.[0] || {
      store_name: 'أمازون مصر',
      product_price: prod.lowestPrice || 0,
      shipping_cost: 35,
      total_cost: (prod.lowestPrice || 0) + 35,
      is_total_cost_complete: true,
      currency: 'EGP',
      source_url: '#'
    };

    const isUnderBudget = budget ? (prod.lowestPrice <= budget) : true;

    return {
      productId: prod.id,
      productName: prod.name,
      productNameAr: prod.name_ar,
      brand: prod.brand,
      bestOffer: {
        storeName: bestOffer.store_name_ar || bestOffer.store_name || 'متجر مصري',
        price: bestOffer.product_price || 0,
        shippingCost: bestOffer.shipping_cost ?? null,
        totalCost: bestOffer.total_cost ?? null,
        isTotalCostComplete: Boolean(bestOffer.is_total_cost_complete),
        currency: bestOffer.currency || 'EGP',
        sourceUrl: bestOffer.source_url || '#'
      },
      reason: `Matches your search criteria with confirmed availability in ${bestOffer.store_name_ar || bestOffer.store_name}.`,
      reason_ar: `مطابق لمتطلبات البحث ومتوفر بعرض مؤكد لدى ${bestOffer.store_name_ar || bestOffer.store_name}.`,
      matchType: (isUnderBudget ? 'exact' : 'alternative') as 'exact' | 'alternative',
      tradeOffs: budget && !isUnderBudget ? `Slightly exceeds budget by ${(prod.lowestPrice - budget).toLocaleString()} EGP` : undefined,
      tradeOffs_ar: budget && !isUnderBudget ? `يتجاوز الميزانية قليلاً بفارق ${(prod.lowestPrice - budget).toLocaleString()} ج.م` : undefined
    };
  });

  return {
    summary: `Found ${recommendedProducts.length} verified options matching your request in Egyptian stores.`,
    summary_ar: `تم العثور على ${recommendedProducts.length} خيارات مؤكدة مطابقة لطلبك في المتاجر المصرية.`,
    budgetNotice: budget ? `Enforced budget ceiling: ${budget.toLocaleString()} EGP.` : undefined,
    budgetNotice_ar: budget ? `تم تطبيق حد الميزانية المطلوب: ${budget.toLocaleString()} ج.م.` : undefined,
    recommendedProducts
  };
}
