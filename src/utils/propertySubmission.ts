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
    const imagesToInsert: Array<{ property_id: number; image_url: string; category: string }> = [];

    // Add cover image if provided
    if (formData.cover_url && formData.cover_url.trim()) {
      imagesToInsert.push({
        property_id: property_id,
        image_url: formData.cover_url.trim(),
        category: 'cover',
      });
    }

    // Add additional images if provided
    if (formData.image_urls && formData.image_urls.trim()) {
      const imageUrls = formData.image_urls.split(',').map(url => url.trim()).filter(url => url);
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

          return {
            property_id: property_id,
            external_id: unit.id || null,
            unit_type: unit.unit_type.trim(),
            normalized_type: unit.normalized_type || null,
            unit_bedrooms: unit.unit_bedrooms.trim(),
            units_amount: unit.units_amount || null,
            units_area_from_m2: unit.units_area_from_m2 || null,
            units_area_to_m2: unit.units_area_to_m2 || null,
            units_price_from: unit.units_price_from || null,
            units_price_to: unit.units_price_to || null,
            price_currency: unitCurrency,
            units_price_from_aed: units_price_from_aed,
            units_price_to_aed: units_price_to_aed,
            typical_unit_image_url: unit.typical_unit_image_url || null,
          };
        });

      if (validUnitBlocks.length > 0) {
        const { error: unitsError } = await supabase
          .from('property_unit_blocks')
          .insert(validUnitBlocks);

        if (unitsError) {
          throw new Error(`Failed to insert unit blocks: ${unitsError.message}`);
        }
      }
    }

    // Step 7: Insert Buildings
    if (formData.buildings && formData.buildings.length > 0) {
      // Filter out invalid buildings
      const validBuildings = formData.buildings
        .filter(building => building && building.building_name && building.building_name.trim())
        .map(building => ({
          property_id: property_id,
          external_id: building.id || null,
          name: building.building_name.trim(),
          description: building.building_description || null,
          completion_date: building.building_completion_date || null,
          image_url: building.building_image_url || null,
        }));

      if (validBuildings.length > 0) {
        const { error: buildingsError } = await supabase
          .from('property_buildings')
          .insert(validBuildings);

        if (buildingsError) {
          throw new Error(`Failed to insert buildings: ${buildingsError.message}`);
        }
      }
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
        const { error: propertyFacilityError } = await supabase
          .from('property_facilities')
          .insert({
            property_id: property_id,
            facility_id: facility_id,
            image_url: facility.facility_image_url || null,
            image_source: facility.facility_image_source || null,
          });

        if (propertyFacilityError) {
          console.error(`Failed to link facility "${facility.facility_name}":`, propertyFacilityError.message);
        }
      }
    }

    // Step 9: Insert Map Points
    if (formData.mapPoints && formData.mapPoints.length > 0) {
      // Filter out invalid map points and ensure name is not empty
      const validMapPoints = formData.mapPoints
        .filter(point => point && point.poi_name && point.poi_name.trim())
        .map(point => {
          // Explicitly destructure to exclude 'id' and create a clean object
          const { id, ...pointWithoutId } = point as any;
          // Create a completely fresh object with ONLY the fields the database expects
          return {
            property_id: property_id,
            name: String(point.poi_name).trim(),
            distance_km: point.distance_km != null ? Number(point.distance_km) : null,
          };
        });

      if (validMapPoints.length > 0) {
        // Log what we're about to insert for debugging
        console.log('Inserting map points:', JSON.stringify(validMapPoints, null, 2));
        
        const { data, error: mapPointsError } = await supabase
          .from('property_map_points')
          .insert(validMapPoints)
          .select();

        if (mapPointsError) {
          console.error('Map points insertion error:', {
            error: mapPointsError,
            message: mapPointsError.message,
            details: mapPointsError.details,
            hint: mapPointsError.hint,
            code: mapPointsError.code,
            dataBeingInserted: JSON.stringify(validMapPoints, null, 2),
          });
          // Instead of throwing, log the error and continue
          // Map points are optional, so we shouldn't fail the entire submission
          console.warn('Failed to insert map points, but continuing with property submission');
        } else {
          console.log(`Successfully inserted ${validMapPoints.length} map points`);
        }
      }
    }

    // Step 10: Insert Payment Plans and Values
    if (formData.paymentPlans && formData.paymentPlans.length > 0) {
      // Filter out invalid payment plans
      const validPaymentPlans = formData.paymentPlans.filter(
        plan => plan && plan.payment_plan_name && plan.payment_plan_name.trim()
      );

      for (const plan of validPaymentPlans) {
        // Insert payment plan header (without description field - it doesn't exist in the table)
        const { data: newPlan, error: planError } = await supabase
          .from('property_payment_plans')
          .insert({
            property_id: property_id,
            name: plan.payment_plan_name.trim(),
          })
          .select('id')
          .single();

        if (planError) {
          console.error(`Failed to insert payment plan "${plan.payment_plan_name}":`, planError.message);
          continue;
        }

        // Parse and insert payment steps
        if (plan.payment_steps && plan.payment_steps.trim()) {
          const steps = plan.payment_steps.split(',').map(s => s.trim()).filter(s => s);
          if (steps.length > 0) {
            const planValues = steps.map((step, index) => ({
              property_payment_plan_id: newPlan.id,
              name: `Step ${index + 1}`,
              value_raw: step,
              sequence: index + 1,
            }));

            const { error: valuesError } = await supabase
              .from('payment_plan_values')
              .insert(planValues);

            if (valuesError) {
              console.error(`Failed to insert payment plan values:`, valuesError.message);
            }
          }
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

