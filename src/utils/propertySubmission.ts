import { SupabaseClient } from '@supabase/supabase-js';
import { FormData } from '../types/property.types';
import { validateFormData, formatValidationErrors } from './validation';

export interface SubmissionResult {
  success: boolean;
  propertyId?: number;
  error?: string;
  details?: any;
}

/**
 * Converts a price from a given currency to AED
 * Uses approximate exchange rates
 */
function convertToAED(amount: number | null | undefined, fromCurrency: string | null | undefined): number | null {
  if (amount === null || amount === undefined || !fromCurrency) return null;
  if (fromCurrency === 'AED') return amount;

  // Approximate exchange rates (1 unit of currency = X AED)
  const exchangeRates: Record<string, number> = {
    'USD': 3.67,  // 1 USD = 3.67 AED
    'EUR': 4.0,   // 1 EUR ≈ 4.0 AED
    'GBP': 4.6,   // 1 GBP ≈ 4.6 AED
    'INR': 0.044, // 1 INR ≈ 0.044 AED
  };

  const rate = exchangeRates[fromCurrency.toUpperCase()];
  if (!rate) {
    console.warn(`Unknown currency ${fromCurrency}, cannot convert to AED`);
    return null;
  }

  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
}

export const submitProperty = async (
  supabase: SupabaseClient,
  formData: FormData
): Promise<SubmissionResult> => {
  try {
    // Step 1: Validate form data
    const validationErrors = validateFormData(formData);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: formatValidationErrors(validationErrors),
      };
    }

    // Step 2: Parse coordinates if provided
    // Coordinates parsing logic removed as it is currently unused
    /*
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (formData.coordinates && formData.coordinates.trim()) {
      const coords = formData.coordinates.split(',').map(c => parseFloat(c.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        latitude = coords[0];
        longitude = coords[1];
      }
    }
    */

    // Step 3: Use developer_id directly (developer is now managed separately)
    const developer_id: number | null = formData.developer_id || null;
    
    // Validate that developer exists if developer_id is provided
    if (developer_id) {
      const { data: developer, error: devError } = await supabase
        .from('partner_developers')
        .select('id')
        .eq('id', developer_id)
        .single();

      if (devError || !developer) {
        throw new Error(`Developer with ID ${developer_id} not found. Please select a valid developer.`);
      }
    }

    // Step 3.5: Check if property already exists to prevent duplicates
    const { data: existingProperty } = await supabase
      .from('properties')
      .select('id')
      .eq('external_id', formData.external_id)
      .single();

    if (existingProperty) {
      throw new Error(`Property with external_id "${formData.external_id}" already exists. Please use a different external ID.`);
    }

    // Step 4: Insert Property
    // Prepare parking value - preserve empty strings as null for database
    const parkingValue = formData.parking_specs && formData.parking_specs.trim() 
      ? formData.parking_specs.trim() 
      : null;
    
    // Prepare media URLs - filter out blob URLs (they won't work after page reload)
    const videoUrl = formData.video_url && formData.video_url.trim() && !formData.video_url.startsWith('blob:')
      ? formData.video_url.trim() 
      : null;
    const brochureUrl = formData.brochure_url && formData.brochure_url.trim() && !formData.brochure_url.startsWith('blob:')
      ? formData.brochure_url.trim() 
      : null;
    const layoutsPdf = formData.layouts_pdf && formData.layouts_pdf.trim() && !formData.layouts_pdf.startsWith('blob:')
      ? formData.layouts_pdf.trim() 
      : null;

    console.log('Inserting property with:', {
      parking: parkingValue,
      video_url: videoUrl,
      brochure_url: brochureUrl,
      layouts_pdf: layoutsPdf,
    });

    const { data: newProperty, error: propertyError } = await supabase
      .from('properties')
      .insert({
        external_id: formData.external_id,
        name: formData.name,
        slug: formData.slug || null,
        developer_id: developer_id,
        area: formData.area,
        city: formData.city || null,
        country: formData.country || null,
        website: formData.website || null,
        status: formData.status,
        sale_status: formData.sale_status || null,
        completion_datetime: formData.completion_datetime || null,
        readiness: formData.readiness,
        permit_id: formData.permit_id || null,
        // Convert property-level prices to AED if needed
        min_price_aed: formData.price_currency === 'AED' 
          ? formData.min_price 
          : (formData.min_price ? convertToAED(formData.min_price, formData.price_currency) : null),
        max_price_aed: formData.price_currency === 'AED'
          ? formData.max_price
          : (formData.max_price ? convertToAED(formData.max_price, formData.price_currency) : null),
        price_currency: formData.price_currency,
        service_charge: formData.service_charge || null,
        min_area: formData.min_area,
        max_area: formData.max_area,
        area_unit: formData.area_unit,
        furnishing: formData.furnishing || null,
        has_escrow: formData.has_escrow || false,
        post_handover: formData.post_handover || false,
        coordinates_text: formData.coordinates || null,
        parking: parkingValue,
        video_url: videoUrl,
        brochure_url: brochureUrl,
        layouts_pdf: layoutsPdf,
        overview: formData.overview || null,
      })
      .select('id')
      .single();

    if (propertyError) {
      throw new Error(`Failed to create property: ${propertyError.message}`);
    }

    const property_id = newProperty.id;

    // Step 5: Insert Property Images
    // Filter out blob URLs - they won't work after page reload
    const imagesToInsert: Array<{ property_id: number; image_url: string; category: string }> = [];

    // Add cover image if provided (skip blob URLs)
    if (formData.cover_url && formData.cover_url.trim() && !formData.cover_url.startsWith('blob:')) {
      imagesToInsert.push({
        property_id: property_id,
        image_url: formData.cover_url.trim(),
        category: 'cover',
      });
    }

    // Add additional images if provided (skip blob URLs)
    if (formData.image_urls && formData.image_urls.trim()) {
      const imageUrls = formData.image_urls
        .split(',')
        .map(url => url.trim())
        .filter(url => url && !url.startsWith('blob:'));
      imageUrls.forEach((url) => {
        imagesToInsert.push({
          property_id: property_id,
          image_url: url,
          category: 'additional',
        });
      });
    }

    if (imagesToInsert.length > 0) {
      const { error: imagesError } = await supabase
        .from('property_images')
        .insert(imagesToInsert);

      if (imagesError) {
        console.error('Failed to insert property images:', imagesError.message);
      }
    } else {
      console.warn('No valid images to insert (all were blob URLs or empty)');
    }

    // Step 6: Insert Unit Types
    if (formData.unitTypes && formData.unitTypes.length > 0) {
      // Filter out invalid unit types
      const validUnitBlocks = formData.unitTypes
        .filter(unit => unit && unit.unit_type && unit.unit_type.trim() && unit.unit_bedrooms && unit.unit_bedrooms.trim())
        .map(unit => {
          // Convert prices to AED if needed
          const unitCurrency = formData.price_currency || 'AED';
          const units_price_from_aed = convertToAED(unit.units_price_from, unitCurrency);
          const units_price_to_aed = convertToAED(unit.units_price_to, unitCurrency);

          // Ensure we have area_unit from formData or unit
          const areaUnit = formData.area_unit || 'sqft';
          
          // Calculate sqft values from m² if available (1 m² = 10.7639 sqft)
          const units_area_from = unit.units_area_from_m2 != null 
            ? Math.round(unit.units_area_from_m2 * 10.7639 * 100) / 100 
            : null;
          const units_area_to = unit.units_area_to_m2 != null 
            ? Math.round(unit.units_area_to_m2 * 10.7639 * 100) / 100 
            : null;
          
          // Filter out blob URLs from image URLs
          const typicalImageUrl = unit.typical_unit_image_url && !unit.typical_unit_image_url.startsWith('blob:')
            ? unit.typical_unit_image_url
            : null;

          return {
            property_id: property_id,
            external_id: unit.id || null,
            name: null, // Can be set if needed
            unit_type: unit.unit_type.trim(),
            normalized_type: unit.normalized_type || null,
            unit_bedrooms: unit.unit_bedrooms.trim(),
            bedrooms_amount: unit.unit_bedrooms.trim(), // Also set bedrooms_amount
            units_amount: unit.units_amount || null,
            area_unit: areaUnit,
            units_area_from_m2: unit.units_area_from_m2 || null,
            units_area_to_m2: unit.units_area_to_m2 || null,
            units_area_from: units_area_from, // Calculate from m²
            units_area_to: units_area_to, // Calculate from m²
            units_price_from: unit.units_price_from || null,
            units_price_to: unit.units_price_to || null,
            price_currency: unitCurrency,
            units_price_from_aed: units_price_from_aed,
            units_price_to_aed: units_price_to_aed,
            typical_unit_image_url: typicalImageUrl,
            typical_image_url: typicalImageUrl, // Some schemas use this field
          };
        });

      if (validUnitBlocks.length > 0) {
        console.log(`Inserting ${validUnitBlocks.length} unit blocks:`, JSON.stringify(validUnitBlocks, null, 2));
        const { error: unitsError } = await supabase
          .from('property_unit_blocks')
          .insert(validUnitBlocks);

        if (unitsError) {
          console.error('Unit blocks insertion error details:', {
            error: unitsError,
            message: unitsError.message,
            details: unitsError.details,
            hint: unitsError.hint,
            code: unitsError.code,
          });
          throw new Error(`Failed to insert unit blocks: ${unitsError.message}`);
        } else {
          console.log(`Successfully inserted ${validUnitBlocks.length} unit blocks`);
        }
      } else {
        console.warn('No valid unit blocks to insert after filtering');
      }
    } else {
      console.warn('No unit types provided in formData');
    }

    // Step 7: Insert Buildings
    if (formData.buildings && formData.buildings.length > 0) {
      // Filter out invalid buildings and blob URLs
      const validBuildings = formData.buildings
        .filter(building => building && building.building_name && building.building_name.trim())
        .map(building => {
          // Filter out blob URLs from image_url
          const imageUrl = building.building_image_url && !building.building_image_url.startsWith('blob:')
            ? building.building_image_url
            : null;
          
          return {
            property_id: property_id,
            external_id: building.id || null,
            name: building.building_name.trim(),
            description: building.building_description || null,
            completion_date: building.building_completion_date || null,
            image_url: imageUrl,
          };
        });

      if (validBuildings.length > 0) {
        console.log(`Inserting ${validBuildings.length} buildings:`, JSON.stringify(validBuildings, null, 2));
        const { error: buildingsError } = await supabase
          .from('property_buildings')
          .insert(validBuildings);

        if (buildingsError) {
          console.error('Buildings insertion error:', buildingsError);
          throw new Error(`Failed to insert buildings: ${buildingsError.message}`);
        } else {
          console.log(`Successfully inserted ${validBuildings.length} buildings`);
        }
      } else {
        console.warn('No valid buildings to insert after filtering');
      }
    } else {
      console.warn('No buildings provided in formData');
    }

    // Step 8: Handle Facilities (check if exists, create if not, then link)
    if (formData.facilities && formData.facilities.length > 0) {
      for (const facility of formData.facilities) {
        // Search for existing facility by name
        const { data: existingFacility } = await supabase
          .from('facilities')
          .select('id')
          .eq('name', facility.facility_name)
          .single();

        let facility_id: number;

        if (existingFacility) {
          // Use existing facility
          facility_id = existingFacility.id;
        } else {
          // Create new facility
          const { data: newFacility, error: facilityInsertError } = await supabase
            .from('facilities')
            .insert({ name: facility.facility_name })
            .select('id')
            .single();

          if (facilityInsertError) {
            console.error(`Failed to create facility "${facility.facility_name}":`, facilityInsertError.message);
            continue;
          }

          facility_id = newFacility.id;
        }

        // Link facility to property
        // Filter out blob URLs from facility image_url
        const facilityImageUrl = facility.facility_image_url && !facility.facility_image_url.startsWith('blob:')
          ? facility.facility_image_url
          : null;
        
        const { error: propertyFacilityError } = await supabase
          .from('property_facilities')
          .insert({
            property_id: property_id,
            facility_id: facility_id,
            image_url: facilityImageUrl,
            image_source: facility.facility_image_source || null,
          });

        if (propertyFacilityError) {
          console.error(`Failed to link facility "${facility.facility_name}":`, propertyFacilityError.message);
        }
      }
    }

    // Step 9: Insert Map Points
    // Note: source_id is required (NOT NULL) in the schema
    console.log('🔍 Map points check:', {
      hasMapPoints: !!formData.mapPoints,
      mapPointsLength: formData.mapPoints?.length || 0,
      mapPointsData: formData.mapPoints,
      mapPointsType: typeof formData.mapPoints,
      isArray: Array.isArray(formData.mapPoints),
    });
    
    // Debug: Check if mapPoints is actually an array with data
    if (!formData.mapPoints) {
      console.warn('⚠️ formData.mapPoints is null or undefined');
    } else if (!Array.isArray(formData.mapPoints)) {
      console.error('❌ formData.mapPoints is not an array:', typeof formData.mapPoints, formData.mapPoints);
    } else if (formData.mapPoints.length === 0) {
      console.warn('⚠️ formData.mapPoints is an empty array - no map points to insert');
    }
    
    if (formData.mapPoints && Array.isArray(formData.mapPoints) && formData.mapPoints.length > 0) {
      // Use source_id = 2 as default (as per user's request)
      // The schema requires source_id to be NOT NULL and reference data_sources(id)
      const defaultSourceId = 2;
      
      console.log(`✅ Using default source_id: ${defaultSourceId} for map points`);
      
      // Verify that source_id 2 exists in data_sources (optional check)
      const { data: sourceCheck, error: sourceCheckError } = await supabase
        .from('data_sources')
        .select('id')
        .eq('id', defaultSourceId)
        .maybeSingle();
      
      if (sourceCheckError) {
        console.warn(`⚠️ Could not verify source_id ${defaultSourceId} exists:`, sourceCheckError.message);
      } else if (!sourceCheck) {
        console.error(`❌ CRITICAL: source_id ${defaultSourceId} does not exist in data_sources table!`);
        console.error('💡 Please create it: INSERT INTO data_sources (id, code, name, active) VALUES (2, \'manual\', \'Manual Entry\', true);');
      } else {
        console.log(`✅ Verified source_id ${defaultSourceId} exists in data_sources`);
      }

      // Filter out invalid map points and ensure name is not empty
      // Note: The schema has a unique constraint on (property_id, source_id, name)
      // So we need to ensure we don't have duplicates
      const validMapPoints = formData.mapPoints
        .filter(point => {
          const isValid = point && point.poi_name && point.poi_name.trim();
          if (!isValid) {
            console.warn('Filtered out invalid map point:', point);
          }
          return isValid;
        })
        .map((point) => {
          // Create a completely fresh object with ONLY the fields the database expects
          // Note: id is auto-generated by the database sequence (property_map_points_id_seq)
          return {
            // Don't provide id - database will auto-generate it using the sequence
            property_id: property_id,
            source_id: defaultSourceId, // Always 2 as per user's request
            name: String(point.poi_name).trim(),
            distance_km: point.distance_km != null ? Number(point.distance_km) : null,
          };
        });
      
      // Remove duplicates based on (property_id, source_id, name) unique constraint
      const uniqueMapPoints = validMapPoints.filter((point, index, self) => 
        index === self.findIndex(p => 
          p.property_id === point.property_id && 
          p.source_id === point.source_id && 
          p.name === point.name
        )
      );
      
      if (uniqueMapPoints.length < validMapPoints.length) {
        console.warn(`⚠️ Removed ${validMapPoints.length - uniqueMapPoints.length} duplicate map points (same property_id, source_id, name)`);
      }

      console.log(`Filtered map points: ${uniqueMapPoints.length} valid and unique out of ${formData.mapPoints.length} total`);

      if (uniqueMapPoints.length > 0) {
        // Log what we're about to insert for debugging
        console.log(`📝 Inserting ${uniqueMapPoints.length} map points with source_id: ${defaultSourceId}`);
        console.log('📋 Map points data:', JSON.stringify(uniqueMapPoints, null, 2));
        
        const { data: insertedMapPoints, error: mapPointsError } = await supabase
          .from('property_map_points')
          .insert(uniqueMapPoints)
          .select();

        if (mapPointsError) {
          console.error('❌ Map points insertion FAILED:', {
            error: mapPointsError,
            message: mapPointsError.message,
            details: mapPointsError.details,
            hint: mapPointsError.hint,
            code: mapPointsError.code,
            dataBeingInserted: JSON.stringify(uniqueMapPoints, null, 2),
          });
          
          // Check if it's an ID-related error
          if (mapPointsError.message?.includes('id') || mapPointsError.message?.includes('null')) {
            console.error('💡 The error might be because the id field is required but not auto-generated.');
            console.error('💡 Make sure the migration has been run to add the sequence: 20251216000000_add_sequence_to_property_map_points.sql');
            console.error('💡 Run: supabase migration up');
          }
          
          // Check if it's a foreign key error
          if (mapPointsError.code === '23503' || mapPointsError.message?.includes('foreign key')) {
            console.error('💡 Foreign key constraint violation. Ensure source_id 2 exists in data_sources table.');
            console.error('💡 Run: SELECT * FROM data_sources WHERE id = 2;');
            console.error('💡 If it doesn\'t exist, create it: INSERT INTO data_sources (id, code, name, active) VALUES (2, \'manual\', \'Manual Entry\', true);');
          }
          
          // Check if it's a unique constraint error
          if (mapPointsError.code === '23505' || mapPointsError.message?.includes('unique')) {
            console.error('💡 Unique constraint violation. A map point with the same (property_id, source_id, name) already exists.');
            console.error('💡 This might mean map points were already inserted for this property.');
          }
          
          // Don't throw - map points are optional, but log the error clearly
          console.warn('⚠️ Map points were not saved, but property submission continues');
          console.warn('⚠️ Property was created successfully, but map points could not be inserted.');
          console.warn('⚠️ You may need to manually add map points or fix the database issue.');
        } else {
          console.log(`✅ Successfully inserted ${insertedMapPoints?.length || uniqueMapPoints.length} map points`);
          if (insertedMapPoints && insertedMapPoints.length > 0) {
            console.log('✅ Inserted map points:', insertedMapPoints.map(mp => ({ id: mp.id, name: mp.name, distance: mp.distance_km })));
          }
        }
      } else {
        if (formData.mapPoints.length > 0) {
          console.warn(`⚠️ No valid map points to insert after filtering (${formData.mapPoints.length} provided but all were empty or invalid)`);
          console.warn('⚠️ Map points that were filtered out:', formData.mapPoints);
          console.warn('💡 Make sure each map point has a non-empty "poi_name" field');
        } else {
          console.log('ℹ️ No map points provided in form data');
        }
      }
    } else {
      console.log('No map points provided in formData');
    }

    // Step 10: Insert Payment Plans
    // Note: The schema uses 'plan_name' (not 'name') and 'payments' as jsonb (not separate table)
    if (formData.paymentPlans && formData.paymentPlans.length > 0) {
      // Filter out invalid payment plans
      const validPaymentPlans = formData.paymentPlans.filter(
        plan => plan && plan.payment_plan_name && plan.payment_plan_name.trim()
      );

      for (const plan of validPaymentPlans) {
        // Parse payment steps into JSONB array format
        let paymentsJsonb: any[] = [];
        
        if (plan.payment_steps && plan.payment_steps.trim()) {
          // Support both comma-separated and pipe-separated formats
          const steps = plan.payment_steps.split(/[,|]/).map(s => s.trim()).filter(s => s);
          paymentsJsonb = steps.map((step, index) => ({
            step: index + 1,
            description: step,
            percentage: null, // Can be parsed from step if needed
          }));
        }

        // If no steps provided, create empty array
        if (paymentsJsonb.length === 0) {
          paymentsJsonb = [];
        }

        // Insert payment plan with correct field names
        const { error: planError } = await supabase
          .from('property_payment_plans')
          .insert({
            property_id: property_id,
            plan_name: plan.payment_plan_name.trim(), // Use 'plan_name' not 'name'
            months_after_handover: plan.months_after_handover || 0,
            payments: paymentsJsonb, // Use 'payments' jsonb field
          });

        if (planError) {
          console.error(`Failed to insert payment plan "${plan.payment_plan_name}":`, planError.message);
          console.error('Plan data:', { plan_name: plan.payment_plan_name, payments: paymentsJsonb });
        } else {
          console.log(`Successfully inserted payment plan: ${plan.payment_plan_name}`);
        }
      }
    }

    return {
      success: true,
      propertyId: property_id,
      details: {
        message: 'Property created successfully with all related data',
      },
    };
  } catch (error: any) {
    console.error('Property submission error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during submission',
    };
  }
};

