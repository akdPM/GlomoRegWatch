CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    source_url TEXT UNIQUE NOT NULL,
    pdf_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_text TEXT,
    summary TEXT,
    relevance_score TEXT,
    why_it_matters TEXT,
    action_items JSONB,
    evidence_excerpt TEXT,
    status TEXT DEFAULT 'fetched', -- fetched, analyzed, reviewed
    slack_thread_ts TEXT, -- stores Slack message ts for thread replies
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Run this if the table already exists to add the new column:
-- ALTER TABLE documents ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT;
