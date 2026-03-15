import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    let base64: string

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      // n8n path — receives base64 JSON
      const body = await req.json()
      if (!body.file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      base64 = body.file
    } else {
      // Browser upload path — receives form data
      const formData = await req.formData()
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      const bytes = await file.arrayBuffer()
      base64 = Buffer.from(bytes).toString('base64')
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20251101',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are a customs document parser. Extract all fields from this commercial invoice and return ONLY valid JSON — no markdown, no explanation, no preamble.

Return this exact structure:
{
  "importer_name": "string or null",
  "importer_address": "string or null",
  "supplier_name": "string or null",
  "supplier_country": "string or null",
  "country_of_origin": "string or null",
  "invoice_number": "string or null",
  "invoice_date": "string or null",
  "invoice_value": "number or null",
  "currency": "string or null",
  "incoterms": "string or null",
  "line_items": [
    {
      "description": "string",
      "quantity": "number or null",
      "unit": "string or null",
      "unit_value": "number or null",
      "total_value": "number or null",
      "country_of_origin": "string or null"
    }
  ],
  "missing_fields": ["list of field names that are required but not found in the document"]
}

Required fields for customs entry: importer_name, supplier_name, supplier_country, country_of_origin, invoice_value, currency, line_items with descriptions.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json(parsed)

  } catch (err) {
    console.error('Extract error:', err)
    return NextResponse.json({ error: 'Failed to extract document fields', detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}