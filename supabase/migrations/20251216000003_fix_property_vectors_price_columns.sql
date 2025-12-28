-- Fix property_vectors table columns if they still have old names
-- This migration handles the case where the previous migration didn't apply correctly

DO $$
BEGIN
  -- Check if min_price_aed exists and rename it to min_price
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'property_vectors' 
      AND column_name = 'min_price_aed'
  ) THEN
    ALTER TABLE "public"."property_vectors" 
      RENAME COLUMN "min_price_aed" TO "min_price";
  END IF;

  -- Check if max_price_aed exists and rename it to max_price
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'property_vectors' 
      AND column_name = 'max_price_aed'
  ) THEN
    ALTER TABLE "public"."property_vectors" 
      RENAME COLUMN "max_price_aed" TO "max_price";
  END IF;
END $$;

-- Update index if it still references old column names
DO $$
BEGIN
  -- Drop the old index if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'property_vectors' 
      AND indexname = 'idx_property_vectors_price_range'
  ) THEN
    DROP INDEX IF EXISTS "public"."idx_property_vectors_price_range";
  END IF;
END $$;

-- Create the index with new column names
CREATE INDEX IF NOT EXISTS "idx_property_vectors_price_range" 
  ON "public"."property_vectors" 
  USING btree (min_price, max_price);


