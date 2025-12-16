-- Complete Property Data Query
-- This query retrieves all information for a property ID from all related tables
-- Replace :property_id with the actual property ID you want to query

WITH property_data AS (
  SELECT 
    p.*,
    pd.id as developer_table_id,
    pd.name as developer_name,
    pd.description as developer_description,
    pd.email as developer_email,
    pd.website as developer_website,
    pd.office_address as developer_office_address,
    pd.logo_url as developer_logo_url,
    pd.working_hours as developer_working_hours,
    pd.raw_data as developer_raw_data,
    pd.created_at as developer_created_at,
    pd.updated_at as developer_updated_at
  FROM properties p
  LEFT JOIN partner_developers pd ON p.developer_id = pd.id
  WHERE p.id = :property_id
),
property_images_data AS (
  SELECT 
    property_id,
    jsonb_agg(
      jsonb_build_object(
        'image_url', image_url,
        'type', type,
        'category', category,
        'display_order', display_order,
        'name', name,
        'path', path,
        'mime', mime,
        'size', size,
        'width', width,
        'height', height,
        'image_source', image_source,
        'new_url', new_url
      ) ORDER BY display_order, image_url
    ) as images
  FROM property_images
  WHERE property_id = :property_id
  GROUP BY property_id
),
payment_plans_data AS (
  SELECT 
    property_id,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'plan_name', plan_name,
        'months_after_handover', months_after_handover,
        'payments', payments,
        'created_at', created_at
      ) ORDER BY id
    ) as payment_plans
  FROM property_payment_plans
  WHERE property_id = :property_id
  GROUP BY property_id
),
units_data AS (
  SELECT 
    property_id,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'external_id', external_id,
        'name', name,
        'normalized_type', normalized_type,
        'area_unit', area_unit,
        'area_from_m2', area_from_m2,
        'area_to_m2', area_to_m2,
        'price_from', price_from,
        'price_to', price_to,
        'currency', currency,
        'typical_image_url', typical_image_url,
        'unit_bedrooms', unit_bedrooms,
        'bedrooms_amount', bedrooms_amount,
        'units_amount', units_amount,
        'typical_unit_image_url', typical_unit_image_url,
        'unit_type', unit_type,
        'price_currency', price_currency,
        'units_area_from', units_area_from,
        'units_area_to', units_area_to,
        'units_price_from_aed', units_price_from_aed,
        'units_price_to_aed', units_price_to_aed,
        'units_area_from_m2', units_area_from_m2,
        'units_area_to_m2', units_area_to_m2,
        'units_price_from', units_price_from,
        'units_price_to', units_price_to
      ) ORDER BY id
    ) as units
  FROM property_unit_blocks
  WHERE property_id = :property_id
  GROUP BY property_id
),
buildings_data AS (
  SELECT 
    property_id,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'external_id', external_id,
        'name', name,
        'description', description,
        'completion_date', completion_date,
        'image_url', image_url,
        'raw_data', raw_data,
        'created_at', created_at
      ) ORDER BY id
    ) as buildings
  FROM property_buildings
  WHERE property_id = :property_id
  GROUP BY property_id
)
SELECT 
  -- Property main data
  pd.*,
  -- Related data as JSONB arrays
  COALESCE(pid.images, '[]'::jsonb) as property_images,
  COALESCE(ppd.payment_plans, '[]'::jsonb) as payment_plans,
  COALESCE(ud.units, '[]'::jsonb) as units,
  COALESCE(bd.buildings, '[]'::jsonb) as buildings
FROM property_data pd
LEFT JOIN property_images_data pid ON pd.id = pid.property_id
LEFT JOIN payment_plans_data ppd ON pd.id = ppd.property_id
LEFT JOIN units_data ud ON pd.id = ud.property_id
LEFT JOIN buildings_data bd ON pd.id = bd.property_id;

