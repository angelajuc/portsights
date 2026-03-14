# Portsights

AI powered customs brokerage data entry automation. Upload a commercial invoice PDF → extract fields → classify HTS codes → flag compliance risks.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

```bash
npx vercel
# Add ANTHROPIC_API_KEY as environment variable in Vercel dashboard
```

## How it works

1. Upload a commercial invoice PDF
2. `/api/extract` — Claude parses the PDF and extracts structured invoice fields
3. `/api/classify` — Claude classifies each line item under the US Harmonized Tariff Schedule
4. Results show extracted fields, HTS codes with confidence scores, duty rates, and compliance flags (Section 301, AD/CVD, FDA, USDA, USMCA)

## n8n Email Automation

To automate document chasing via email:
1. Gmail trigger → new email with PDF attachment
2. HTTP node → POST to /api/extract
3. IF node → check missing_fields array
4. Gmail node → auto-reply listing missing documents

## Stack

- Next.js 15 (App Router)
- Claude claude-opus-4-5 (document parsing + HTS classification)
- Vercel (deployment)
