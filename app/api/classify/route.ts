import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    const { line_items, supplier_country } = await req.json()

    if (!line_items || line_items.length === 0) {
      return NextResponse.json({ error: 'No line items provided' }, { status: 400 })
    }

    const itemList = line_items
      .map((item: { description: string }, i: number) => `${i + 1}. ${item.description}`)
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `You are a licensed US customs broker with 20 years of experience classifying goods under the Harmonized Tariff Schedule of the United States (HTSUS).

Supplier/Origin country: ${supplier_country || 'Unknown'}

For each product description below, provide a classification. Return ONLY a valid JSON array — no markdown, no explanation, no preamble.

Products to classify:
${itemList}

Return this exact structure (one object per product, in order):
[
  {
    "item_number": 1,
    "description": "original description",
    "hts_code": "XXXX.XX.XXXX",
    "hts_description": "official HTS chapter/heading description",
    "confidence": 85,
    "duty_rate": "X.X%",
    "reasoning": "2-3 sentence plain-English explanation of why this code applies, referencing the General Rules of Interpretation if relevant",
    "flags": [
      {
        "type": "section_301" | "ad_cvd" | "fda" | "usda" | "usmca" | "info",
        "message": "plain English description of the flag"
      }
    ],
    "alternative_codes": [
      {
        "hts_code": "XXXX.XX.XXXX",
        "reason": "brief reason this could also apply"
      }
    ]
  }
]

Flag guidelines:
- Add a "section_301" flag if the origin is China and the product is likely subject to Section 301 tariffs (most manufactured goods)
- Add an "ad_cvd" flag if anti-dumping or countervailing duties commonly apply to this product type
- Add an "fda" flag if the product requires FDA prior notice (food, drugs, cosmetics, medical devices)
- Add a "usda" flag if USDA/APHIS requirements may apply (plants, animals, agricultural products)
- Add a "usmca" flag if the product may qualify for USMCA preferential duty treatment
- Confidence: 90-100 = high confidence, classify and approve; 70-89 = moderate, recommend review; below 70 = low, escalate to senior broker`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({ classifications: parsed })
  } catch (err) {
    console.error('Classify error:', err)
    return NextResponse.json({ error: 'Failed to classify line items' }, { status: 500 })
  }
}
