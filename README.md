# GlomoRegWatch - AI Regulatory Monitoring MVP

GlomoRegWatch is a specialized AI-powered compliance and regulatory monitoring dashboard explicitly designed for Glomopay. It automates the ingestion, analysis, and structured extraction of actionable compliance responsibilities from complex regulatory feeds (RBI & IFSCA) into a premium, minimalist triage interface.

## Core Features
1. **Automated Ingestion Engine**: Dynamically fetches and deduplicates raw regulatory circulars from the Reserve Bank of India (RBI) and IFSCA portals.
2. **Deterministic Hybrid AI Scoring**: Utilizes a robust 4-Factor engineering model (Impact, Urgency, Scope, Confidence) layered on top of OpenAI to algorithmically calculate and override "High/Medium/Low" compliance priorities.
3. **Glomopay Business Model Injection**: The AI strictly parses documents using a custom-injected `GLOMO_CONTEXT` object detailing LRS, FATF, and outward remittance rules.
4. **Self-Healing Pipeline**: Database engine actively intercepts stalled or failed extraction tasks and repairs them via subsequent `Fetch Now` requests.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI Engine**: OpenAI (`gpt-4o-mini`)
- **Styling**: Tailwind CSS & Lucide Icons

## Setup & Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_actual_openai_sk_key
   ```

3. **Supabase Schema Configuration**
   Run the SQL provided in `supabase_schema.sql` completely inside your Supabase SQL Editor. This will configure your `documents` table with the exact mapping schema.

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Access the dashboard natively at `http://localhost:3000`.

## Architecture Principles
This MVP prioritizes **high-trust engineering rules** over blind LLM reliance. The priority breakdown string is actively serialized directly inside the database relevance payload, removing the need for sprawling SQL relationships while ensuring dynamic, deeply interactive UI presentations on the front-end.
