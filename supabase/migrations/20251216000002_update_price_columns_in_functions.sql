-- Update rebuild_property_vector function to use new column names (min_price, max_price instead of min_price_aed, max_price_aed)

CREATE OR REPLACE FUNCTION public.rebuild_property_vector(p_property_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_property record;
  v_developer record;
  v_unit_types jsonb;
  v_unit_types_text text;
  v_facilities text[];
  v_facilities_text text;
  v_payment_plans jsonb;
  v_payment_plans_text text;
  v_buildings jsonb;
  v_buildings_text text;
  v_nearby_points jsonb;
  v_nearby_points_text text;
  v_images_summary jsonb;
  v_image_count integer;
  v_primary_image text;
  v_searchable_text text;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = p_property_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  IF v_property.developer_id IS NOT NULL THEN
    SELECT * INTO v_developer FROM partner_developers WHERE id = v_property.developer_id;
  END IF;
  
  -- THIS IS THE FIXED UNIT TYPES AGGREGATION
  SELECT 
    jsonb_build_object(
      'available_bedrooms', jsonb_agg(DISTINCT unit_bedrooms ORDER BY unit_bedrooms),
      'unit_types', jsonb_agg(
        jsonb_build_object(
          'normalized_type', normalized_type,
          'unit_bedrooms', unit_bedrooms,
          'bedrooms_amount', bedrooms_amount,
          'units_amount', units_amount,
          'area_unit', area_unit,
          'units_area_from_m2', units_area_from_m2,
          'units_area_to_m2', units_area_to_m2,
          'units_price_from_aed', units_price_from_aed,
          'units_price_to_aed', units_price_to_aed,
          'price_currency', COALESCE(price_currency, 'AED'),
          'area_range', 
            CASE 
              WHEN units_area_from_m2 IS NOT NULL AND units_area_to_m2 IS NOT NULL 
              THEN units_area_from_m2::text || '-' || units_area_to_m2::text || ' m²'
              ELSE NULL
            END,
          'price_range',
            CASE 
              WHEN units_price_from_aed IS NOT NULL AND units_price_to_aed IS NOT NULL 
              THEN 
                CASE 
                  WHEN units_price_from_aed >= 1000000 
                  THEN ROUND(units_price_from_aed / 1000000, 2)::text || 'M-' || 
                       ROUND(units_price_to_aed / 1000000, 2)::text || 'M AED'
                  ELSE ROUND(units_price_from_aed / 1000, 0)::text || 'K-' || 
                       ROUND(units_price_to_aed / 1000, 0)::text || 'K AED'
                END
              WHEN units_price_from_aed IS NOT NULL
              THEN 
                CASE 
                  WHEN units_price_from_aed >= 1000000 
                  THEN ROUND(units_price_from_aed / 1000000, 2)::text || 'M AED'
                  ELSE ROUND(units_price_from_aed / 1000, 0)::text || 'K AED'
                END
              ELSE NULL
            END
        ) ORDER BY bedrooms_amount, normalized_type
      ),
      'total_units', SUM(COALESCE(units_amount, 0))
    )
  INTO v_unit_types
  FROM property_unit_blocks
  WHERE property_id = p_property_id;
  
  SELECT string_agg(name || ' (' || COALESCE(units_amount::text || ' units', 'units') ||
    COALESCE(', ' || units_area_from::text || '-' || units_area_to::text || ' ' || area_unit, '') ||
    COALESCE(', ' || 
      CASE WHEN units_price_from_aed >= 1000000 
        THEN ROUND(units_price_from_aed / 1000000, 2)::text || 'M-' || ROUND(units_price_to_aed / 1000000, 2)::text || 'M AED'
        ELSE ROUND(units_price_from_aed / 1000, 0)::text || 'K-' || ROUND(units_price_to_aed / 1000, 0)::text || 'K AED'
      END, '') || ')', ', ')
  INTO v_unit_types_text FROM property_unit_blocks WHERE property_id = p_property_id;
  
  SELECT array_agg(f.name ORDER BY f.name), 'Facilities: ' || string_agg(f.name, ', ' ORDER BY f.name)
  INTO v_facilities, v_facilities_text
  FROM property_facilities pf JOIN facilities f ON f.id = pf.facility_id WHERE pf.property_id = p_property_id;
  
  SELECT jsonb_build_object('available_plans', jsonb_agg(DISTINCT plan_name), 'has_payment_plan', bool_or(true),
    'plans', jsonb_agg(jsonb_build_object('name', plan_name, 'payments', payments, 'post_handover_months', months_after_handover)))
  INTO v_payment_plans FROM property_payment_plans WHERE property_id = p_property_id;
  
  SELECT 'Payment options: ' || string_agg(plan_name || 
    CASE WHEN months_after_handover > 0 THEN ' with ' || months_after_handover::text || '-month post-handover' ELSE '' END, ', ')
  INTO v_payment_plans_text FROM property_payment_plans WHERE property_id = p_property_id;
  
  SELECT jsonb_build_object('building_count', count(*), 'buildings', 
    jsonb_agg(jsonb_build_object('name', name, 'completion_date', completion_date) ORDER BY name))
  INTO v_buildings FROM property_buildings WHERE property_id = p_property_id;
  
  SELECT 'Buildings: ' || string_agg(name || CASE WHEN completion_date IS NOT NULL 
    THEN ' (completion ' || completion_date || ')' ELSE '' END, ', ' ORDER BY name)
  INTO v_buildings_text FROM property_buildings WHERE property_id = p_property_id;
  
  SELECT jsonb_agg(jsonb_build_object('name', name, 'distance_km', distance_km) ORDER BY distance_km)
  INTO v_nearby_points FROM (SELECT name, distance_km FROM property_map_points 
    WHERE property_id = p_property_id ORDER BY distance_km LIMIT 10) subquery;
  
  SELECT 'Nearby: ' || string_agg(name || ' (' || distance_km::text || 'km)', ', ')
  INTO v_nearby_points_text FROM (SELECT name, distance_km FROM property_map_points 
    WHERE property_id = p_property_id ORDER BY distance_km LIMIT 10) subquery;
  
  SELECT jsonb_build_object('total_images', count(*), 'categories', 
    jsonb_object_agg(COALESCE(category, 'uncategorized'), cat_count), 'primary_image', MIN(image_url)),
    count(*)::integer, MIN(image_url)
  INTO v_images_summary, v_image_count, v_primary_image
  FROM (SELECT category, image_url, count(*) OVER (PARTITION BY category) as cat_count 
    FROM property_images WHERE property_id = p_property_id) img_data;
  
  -- Updated to use min_price and max_price instead of min_price_aed and max_price_aed
  v_searchable_text := 
    COALESCE(v_property.name, '') || '. ' || COALESCE(v_property.area, '') || ', ' || 
    COALESCE(v_property.city, '') || ', ' || COALESCE(v_property.country, '') || '. ' ||
    CASE WHEN v_developer.name IS NOT NULL 
      THEN 'Developed by ' || v_developer.name || COALESCE(' - ' || v_developer.description, '') || '. ' ELSE '' END ||
    COALESCE(v_property.status, '') || ' property' ||
    CASE WHEN v_property.readiness IS NOT NULL THEN ' with ' || v_property.readiness::text || '% completion' ELSE '' END ||
    CASE WHEN v_property.completion_datetime IS NOT NULL 
      THEN ', expected ' || to_char(v_property.completion_datetime, 'Mon YYYY') ELSE '' END || '. ' ||
    CASE WHEN v_property.furnishing IS NOT NULL THEN v_property.furnishing || ' units available. ' ELSE '' END ||
    'Overview: ' || COALESCE(v_property.overview, '') || ' ' ||
    CASE WHEN v_unit_types_text IS NOT NULL THEN 'Available units: ' || v_unit_types_text || '. ' ELSE '' END ||
    COALESCE(v_facilities_text || '. ', '') || COALESCE(v_payment_plans_text || '. ', '') ||
    COALESCE(v_buildings_text || '. ', '') || COALESCE(v_nearby_points_text || '. ', '') ||
    'Price range: ' ||
    CASE WHEN v_property.min_price IS NOT NULL AND v_property.max_price IS NOT NULL THEN
      CASE WHEN v_property.min_price >= 1000000 
        THEN ROUND(v_property.min_price / 1000000, 2)::text || 'M-' || ROUND(v_property.max_price / 1000000, 2)::text || 'M AED'
        ELSE ROUND(v_property.min_price / 1000, 0)::text || 'K-' || ROUND(v_property.max_price / 1000, 0)::text || 'K AED'
      END ELSE 'Contact for pricing' END || '. ' ||
    'Area range: ' ||
    CASE WHEN v_property.min_area IS NOT NULL AND v_property.max_area IS NOT NULL 
      THEN v_property.min_area::text || '-' || v_property.max_area::text || ' ' || COALESCE(v_property.area_unit, 'sqft')
      ELSE 'varies' END || '. ' ||
    CASE WHEN v_property.parking IS NOT NULL THEN 'Parking: ' || v_property.parking || '. ' ELSE '' END ||
    CASE WHEN v_property.service_charge IS NOT NULL THEN 'Service charge: ' || v_property.service_charge || '. ' ELSE '' END ||
    CASE WHEN v_property.has_escrow THEN 'Escrow account available. ' ELSE '' END ||
    CASE WHEN v_property.post_handover THEN 'Post-handover payment options. ' ELSE '' END;
  
  INSERT INTO property_vectors (
    id, source_id, external_id, slug, internal_slug, name, area, city, country,
    status, readiness, sale_status, completion_datetime, furnishing, parking, service_charge, 
    has_escrow, post_handover, is_partner_project, overview,
    min_price, max_price, price_currency, min_area, max_area, area_unit,
    developer_id, developer_name, developer_description, developer_email, developer_website,
    unit_types_summary, unit_types_text, facilities, facilities_text,
    payment_plans_summary, payment_plans_text, buildings_summary, buildings_text,
    nearby_points, nearby_points_text, images_summary, image_count, primary_image_url,
    searchable_text, updated_at
  )
  VALUES (
    v_property.id, v_property.source_id, v_property.external_id, v_property.slug, v_property.internal_slug,
    v_property.name, v_property.area, v_property.city, v_property.country,
    v_property.status, v_property.readiness, v_property.sale_status, v_property.completion_datetime,
    v_property.furnishing, v_property.parking, v_property.service_charge, 
    v_property.has_escrow, v_property.post_handover, v_property.is_partner_project, v_property.overview,
    v_property.min_price, v_property.max_price, v_property.price_currency,
    v_property.min_area, v_property.max_area, v_property.area_unit,
    v_developer.id, v_developer.name, v_developer.description, v_developer.email, v_developer.website,
    v_unit_types, v_unit_types_text, v_facilities, v_facilities_text,
    v_payment_plans, v_payment_plans_text, v_buildings, v_buildings_text,
    v_nearby_points, v_nearby_points_text, v_images_summary, v_image_count, v_primary_image,
    v_searchable_text, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    source_id = EXCLUDED.source_id, external_id = EXCLUDED.external_id,
    slug = EXCLUDED.slug, internal_slug = EXCLUDED.internal_slug,
    name = EXCLUDED.name, area = EXCLUDED.area, city = EXCLUDED.city, country = EXCLUDED.country,
    status = EXCLUDED.status, readiness = EXCLUDED.readiness, sale_status = EXCLUDED.sale_status,
    completion_datetime = EXCLUDED.completion_datetime, furnishing = EXCLUDED.furnishing,
    parking = EXCLUDED.parking, service_charge = EXCLUDED.service_charge,
    has_escrow = EXCLUDED.has_escrow, post_handover = EXCLUDED.post_handover,
    is_partner_project = EXCLUDED.is_partner_project, overview = EXCLUDED.overview,
    min_price = EXCLUDED.min_price, max_price = EXCLUDED.max_price,
    price_currency = EXCLUDED.price_currency, min_area = EXCLUDED.min_area,
    max_area = EXCLUDED.max_area, area_unit = EXCLUDED.area_unit,
    developer_id = EXCLUDED.developer_id, developer_name = EXCLUDED.developer_name,
    developer_description = EXCLUDED.developer_description, developer_email = EXCLUDED.developer_email,
    developer_website = EXCLUDED.developer_website, unit_types_summary = EXCLUDED.unit_types_summary,
    unit_types_text = EXCLUDED.unit_types_text, facilities = EXCLUDED.facilities,
    facilities_text = EXCLUDED.facilities_text, payment_plans_summary = EXCLUDED.payment_plans_summary,
    payment_plans_text = EXCLUDED.payment_plans_text, buildings_summary = EXCLUDED.buildings_summary,
    buildings_text = EXCLUDED.buildings_text, nearby_points = EXCLUDED.nearby_points,
    nearby_points_text = EXCLUDED.nearby_points_text, images_summary = EXCLUDED.images_summary,
    image_count = EXCLUDED.image_count, primary_image_url = EXCLUDED.primary_image_url,
    searchable_text = EXCLUDED.searchable_text, updated_at = now();
END;
$function$;
