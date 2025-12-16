-- Rename min_price_aed and max_price_aed to min_price and max_price in properties table

ALTER TABLE "public"."properties" 
  RENAME COLUMN "min_price_aed" TO "min_price";

ALTER TABLE "public"."properties" 
  RENAME COLUMN "max_price_aed" TO "max_price";

-- Update property_vectors table columns
ALTER TABLE "public"."property_vectors" 
  RENAME COLUMN "min_price_aed" TO "min_price";

ALTER TABLE "public"."property_vectors" 
  RENAME COLUMN "max_price_aed" TO "max_price";

-- Update indexes that reference the old column names
DROP INDEX IF EXISTS "public"."idx_property_vectors_price_range";
CREATE INDEX IF NOT EXISTS "idx_property_vectors_price_range" ON "public"."property_vectors" USING btree (min_price, max_price);

-- Note: The rebuild_property_vector function also needs to be updated
-- This is done in migration 20251216000002_update_price_columns_in_functions.sql

