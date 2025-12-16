-- Rename min_price_aed and max_price_aed to min_price and max_price in properties table

ALTER TABLE "public"."properties" 
  RENAME COLUMN "min_price_aed" TO "min_price";

ALTER TABLE "public"."properties" 
  RENAME COLUMN "max_price_aed" TO "max_price";

-- Also update property_vectors view if it references these columns
-- (The view will need to be recreated or updated separately if it exists)

