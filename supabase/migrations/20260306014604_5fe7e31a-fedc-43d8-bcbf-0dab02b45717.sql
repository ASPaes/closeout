
-- Rename table_name to entity_type
ALTER TABLE public.audit_logs RENAME COLUMN table_name TO entity_type;

-- Rename record_id to entity_id
ALTER TABLE public.audit_logs RENAME COLUMN record_id TO entity_id;

-- Merge old_data and new_data into metadata jsonb
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Migrate existing data into metadata
UPDATE public.audit_logs SET metadata = jsonb_build_object('old_data', old_data, 'new_data', new_data)
WHERE old_data IS NOT NULL OR new_data IS NOT NULL;

-- Drop old columns
ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS old_data;
ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS new_data;
