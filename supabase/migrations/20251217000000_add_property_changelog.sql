-- Add changelog column to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS changelog JSONB DEFAULT '[]'::jsonb;

-- Create function to automatically track property changes
CREATE OR REPLACE FUNCTION public.track_property_changes()
RETURNS TRIGGER AS $$
DECLARE
  change_entry JSONB;
  changes JSONB := '[]'::jsonb;
  old_val JSONB;
  new_val JSONB;
  field_name TEXT;
  old_text TEXT;
  new_text TEXT;
BEGIN
  -- Only process if this is an UPDATE (not INSERT)
  IF TG_OP = 'UPDATE' THEN
    -- Loop through all columns in the properties table
    FOR field_name IN 
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'properties'
        AND column_name != 'changelog'  -- Exclude changelog itself
        AND column_name != 'updated_at'  -- Exclude updated_at as it changes on every update
        AND column_name != 'created_at'  -- Exclude created_at as it never changes
    LOOP
      -- Get old and new values using dynamic SQL with proper type handling
      EXECUTE format('SELECT to_jsonb($1.%I) as val', field_name) INTO old_val USING OLD;
      EXECUTE format('SELECT to_jsonb($1.%I) as val', field_name) INTO new_val USING NEW;
      
      -- Convert JSONB to text representation, handling different types
      old_text := CASE 
        WHEN old_val IS NULL THEN NULL
        WHEN old_val = 'null'::jsonb THEN NULL
        WHEN jsonb_typeof(old_val) = 'null' THEN NULL
        WHEN jsonb_typeof(old_val) = 'string' THEN old_val #>> '{}'
        WHEN jsonb_typeof(old_val) = 'number' THEN old_val::text
        WHEN jsonb_typeof(old_val) = 'boolean' THEN old_val::text
        ELSE old_val::text
      END;
      
      new_text := CASE 
        WHEN new_val IS NULL THEN NULL
        WHEN new_val = 'null'::jsonb THEN NULL
        WHEN jsonb_typeof(new_val) = 'null' THEN NULL
        WHEN jsonb_typeof(new_val) = 'string' THEN new_val #>> '{}'
        WHEN jsonb_typeof(new_val) = 'number' THEN new_val::text
        WHEN jsonb_typeof(new_val) = 'boolean' THEN new_val::text
        ELSE new_val::text
      END;
      
      -- Only create changelog entry if values actually changed
      IF old_text IS DISTINCT FROM new_text THEN
        change_entry := jsonb_build_object(
          'date_and_time', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'field', field_name,
          'old_value', old_text,
          'new_value', new_text,
          'metadata', ''
        );
        
        changes := changes || change_entry;
      END IF;
    END LOOP;
    
    -- If there are any changes, append them to the existing changelog
    IF jsonb_array_length(changes) > 0 THEN
      NEW.changelog := COALESCE(OLD.changelog, '[]'::jsonb) || changes;
    ELSE
      NEW.changelog := COALESCE(OLD.changelog, '[]'::jsonb);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically track changes
DROP TRIGGER IF EXISTS property_changes_trigger ON public.properties;
CREATE TRIGGER property_changes_trigger
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.track_property_changes();

-- Add comment to the column
COMMENT ON COLUMN public.properties.changelog IS 'JSONB array tracking all changes to the property. Format: [{"date_and_time": "ISO8601", "field": "field_name", "old_value": "old", "new_value": "new", "metadata": ""}]';

