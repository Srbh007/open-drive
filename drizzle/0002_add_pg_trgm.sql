CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS files_name_title_trgm_idx ON files USING GIN (lower(coalesce(title, name)) gin_trgm_ops);
