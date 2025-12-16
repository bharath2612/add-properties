-- Add sequence and default value for property_map_points.id
-- This allows inserts without explicitly providing an id

-- Create the sequence
CREATE SEQUENCE IF NOT EXISTS "public"."property_map_points_id_seq";

-- Set the sequence to start after any existing max id (if there are existing records)
-- This ensures no conflicts with existing data
DO $$
DECLARE
  max_id bigint;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM "public"."property_map_points";
  IF max_id > 0 THEN
    PERFORM setval('property_map_points_id_seq', max_id);
  END IF;
END $$;

-- Set the default value for the id column
ALTER TABLE "public"."property_map_points" 
  ALTER COLUMN "id" SET DEFAULT nextval('property_map_points_id_seq'::regclass);

-- Make the sequence owned by the column (so it gets dropped if the column is dropped)
ALTER SEQUENCE "public"."property_map_points_id_seq" 
  OWNED BY "public"."property_map_points"."id";

