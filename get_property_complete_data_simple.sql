-- Simple version: Get all property data with related tables
-- Replace 123 with your actual property ID

SELECT 
  -- Property main data
  p.*,
  
  -- Developer data
  pd.id as developer_table_id,
  pd.name as developer_name,
  pd.description as developer_description,
  pd.email as developer_email,
  pd.website as developer_website,
  pd.office_address as developer_office_address,
  pd.logo_url as developer_logo_url,
  pd.working_hours as developer_working_hours,
  
  -- Images as JSON array
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'image_url', image_url,
        'type', type,
        'category', category,
        'display_order', display_order,
        'name', name,
        'mime', mime,
        'size', size,
        'width', width,
        'height', height,
        'new_url', new_url
      ) ORDER BY display_order
    )
    FROM property_images
    WHERE property_id = p.id
  ) as property_images,
  
  -- Payment plans as JSON array
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'plan_name', plan_name,
        'months_after_handover', months_after_handover,
        'payments', payments,
        'created_at', created_at
      )
    )
    FROM property_payment_plans
    WHERE property_id = p.id
  ) as payment_plans,
  
  -- Units as JSON array
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'normalized_type', normalized_type,
        'unit_bedrooms', unit_bedrooms,
        'bedrooms_amount', bedrooms_amount,
        'units_amount', units_amount,
        'area_unit', area_unit,
        'units_area_from_m2', units_area_from_m2,
        'units_area_to_m2', units_area_to_m2,
        'units_price_from_aed', units_price_from_aed,
        'units_price_to_aed', units_price_to_aed,
        'typical_unit_image_url', typical_unit_image_url
      )
    )
    FROM property_unit_blocks
    WHERE property_id = p.id
  ) as units,
  
  -- Buildings as JSON array
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'description', description,
        'completion_date', completion_date,
        'image_url', image_url
      )
    )
    FROM property_buildings
    WHERE property_id = p.id
  ) as buildings

FROM properties p
LEFT JOIN partner_developers pd ON p.developer_id = pd.id
WHERE p.id = 123;  -- Replace 123 with your property ID

