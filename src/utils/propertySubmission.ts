import { SupabaseClient } from '@supabase/supabase-js';
import { FormData } from '../types/property.types';
import { validateFormData, formatValidationErrors } from './validation';

export interface SubmissionResult {
  success: boolean;
  propertyId?: number;
  error?: string;
  details?: any;
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

    // Step 3: Handle Developer (check if exists or create new)
    let developer_id: number | null = null;
    if (formData.developer && formData.developer.trim()) {
      // First, try to find existing developer by name
      const { data: existingDev, error: devSearchError } = await supabase
        .from('partner_developers')
        .select('id')
        .eq('name', formData.developer)
        .single();

      if (devSearchError && devSearchError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned", which is expected if developer doesn't exist
        throw new Error(`Error searching for developer: ${devSearchError.message}`);
      }

      if (existingDev) {
        developer_id = existingDev.id;
      } else {
        // Create new developer
        const { data: newDev, error: devInsertError } = await supabase
          .from('partner_developers')
          .insert({
            name: formData.developer,
            email: formData.developer_email || null,
            office_address: formData.developer_office || null,
            website: formData.developer_website || null,
            logo_url: formData.developer_logo_url || null,
            description: formData.developer_description || null,
            working_hours: formData.developer_working_hours || null,
          })
          .select('id')
          .single();

        if (devInsertError) {
          throw new Error(`Failed to create developer: ${devInsertError.message}`);
        }

        developer_id = newDev.id;
      }
    }

    // Step 4: Insert Property
    const { data: newProperty, error: propertyError } = await supabase
      .from('properties')
      .insert({
        external_id: formData.external_id,
        name: formData.name,
        slug: formData.slug || null,
        // developer: formData.developer,
        developer_id: developer_id,
        area: formData.area,
        city: formData.city || null,
        country: formData.country || null,
        // latitude: latitude,
        // longitude: longitude,
        website: formData.website || null,
        status: formData.status,
        sale_status: formData.sale_status || null,
        completion_datetime: formData.completion_datetime || null,
        readiness: formData.readiness,
        permit_id: formData.permit_id || null,
        // min_price: formData.min_price,
        // max_price: formData.max_price,
        price_currency: formData.price_currency,
        service_charge: formData.service_charge || null,
        min_area: formData.min_area,
        max_area: formData.max_area,
        area_unit: formData.area_unit,
        furnishing: formData.furnishing || null,
        has_escrow: formData.has_escrow || false,
        post_handover: formData.post_handover || false,
        // cover_url: formData.cover_url || null,
        video_url: formData.video_url || null,
        brochure_url: formData.brochure_url || null,
        layouts_pdf: formData.layouts_pdf || null,
        // parking_specs: formData.parking_specs || null,
        overview: formData.overview || null,
      })
      .select('id')
      .single();

    if (propertyError) {
      throw new Error(`Failed to create property: ${propertyError.message}`);
    }

    const property_id = newProperty.id;

    // Step 5: Insert Property Images
    if (formData.image_urls && formData.image_urls.trim()) {
      const imageUrls = formData.image_urls.split(',').map(url => url.trim()).filter(url => url);
      if (imageUrls.length > 0) {
        const images = imageUrls.map((url, index) => ({
          property_id: property_id,
          image_url: url,
          category: index === 0 ? 'cover' : 'additional',
        }));

        const { error: imagesError } = await supabase
          .from('property_images')
          .insert(images);

        if (imagesError) {
          console.error('Failed to insert property images:', imagesError.message);
        }
      }
    }

    // Step 6: Insert Unit Types
    if (formData.unitTypes && formData.unitTypes.length > 0) {
      const unitBlocks = formData.unitTypes.map(unit => ({
        property_id: property_id,
        external_id: unit.id,
        unit_type: unit.unit_type,
        normalized_type: unit.normalized_type || null,
        unit_bedrooms: unit.unit_bedrooms,
        units_amount: unit.units_amount,
        units_area_from_m2: unit.units_area_from_m2,
        units_area_to_m2: unit.units_area_to_m2,
        units_price_from: unit.units_price_from,
        units_price_to: unit.units_price_to,
        typical_unit_image_url: unit.typical_unit_image_url || null,
      }));

      const { error: unitsError } = await supabase
        .from('property_unit_blocks')
        .insert(unitBlocks);

      if (unitsError) {
        throw new Error(`Failed to insert unit blocks: ${unitsError.message}`);
      }
    }

    // Step 7: Insert Buildings
    if (formData.buildings && formData.buildings.length > 0) {
      const buildings = formData.buildings.map(building => ({
        property_id: property_id,
        external_id: building.id,
        name: building.building_name,
        description: building.building_description || null,
        completion_date: building.building_completion_date || null,
        image_url: building.building_image_url || null,
      }));

      const { error: buildingsError } = await supabase
        .from('property_buildings')
        .insert(buildings);

      if (buildingsError) {
        throw new Error(`Failed to insert buildings: ${buildingsError.message}`);
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
      const mapPoints = formData.mapPoints.map(point => ({
        property_id: property_id,
        name: point.poi_name,
        distance_km: point.distance_km,
      }));

      const { error: mapPointsError } = await supabase
        .from('property_map_points')
        .insert(mapPoints);

      if (mapPointsError) {
        throw new Error(`Failed to insert map points: ${mapPointsError.message}`);
      }
    }

    // Step 10: Insert Payment Plans and Values
    if (formData.paymentPlans && formData.paymentPlans.length > 0) {
      for (const plan of formData.paymentPlans) {
        // Insert payment plan header
        const { data: newPlan, error: planError } = await supabase
          .from('property_payment_plans')
          .insert({
            property_id: property_id,
            name: plan.payment_plan_name,
            description: null,
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

