// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to generate hash ID
function generateHashId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return -Math.abs(hash);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const requestData = await req.json()
    const { property, unitTypes, buildings, facilities, mapPoints, images, paymentPlans, developer } = requestData

    console.log('Received property entry request:', property.name)

    // Step 1: Check if property already exists
    const { data: existingProperty } = await supabaseClient
      .from('properties')
      .select('id')
      .eq('external_id', property.external_id)
      .single()

    if (existingProperty) {
      throw new Error(`Property with external_id ${property.external_id} already exists`)
    }

    // Step 2: Generate property_id
    const property_id = generateHashId(property.external_id)

    // Step 3: Parse coordinates if provided
    let latitude = null
    let longitude = null
    if (property.coordinates) {
      const coords = property.coordinates.split(',').map((c: string) => c.trim())
      if (coords.length === 2) {
        latitude = parseFloat(coords[0])
        longitude = parseFloat(coords[1])
      }
    }

    // Step 4: Insert/Get Developer
    let developer_id = null
    if (developer.name) {
      // Check if developer exists
      const { data: existingDev } = await supabaseClient
        .from('partner_developers')
        .select('id')
        .eq('name', developer.name)
        .single()

      if (existingDev) {
        developer_id = existingDev.id
        
        // Update developer info if new data provided
        if (developer.email || developer.phone || developer.website) {
          await supabaseClient
            .from('partner_developers')
            .update({
              email: developer.email || undefined,
              phone: developer.phone || undefined,
              office_address: developer.office_address || undefined,
              website: developer.website || undefined,
              logo_url: developer.logo_url || undefined,
              description: developer.description || undefined,
              working_hours: developer.working_hours || undefined,
            })
            .eq('id', developer_id)
        }
      } else {
        // Insert new developer
        const { data: newDev, error: devError } = await supabaseClient
          .from('partner_developers')
          .insert({
            name: developer.name,
            email: developer.email,
            phone: developer.phone,
            office_address: developer.office_address,
            website: developer.website,
            logo_url: developer.logo_url,
            description: developer.description,
            working_hours: developer.working_hours,
          })
          .select('id')
          .single()

        if (devError) {
          console.error('Developer insert error:', devError)
        } else {
          developer_id = newDev.id
        }
      }
    }

    // Step 5: Insert Property
    const { error: propertyError } = await supabaseClient
      .from('properties')
      .insert({
        id: property_id,
        external_id: property.external_id,
        name: property.name,
        slug: property.slug || null,
        developer_id: developer_id,
        area: property.area,
        city: property.city || null,
        country: property.country || null,
        latitude: latitude,
        longitude: longitude,
        website: property.website || null,
        status: property.status,
        sale_status: property.sale_status || null,
        completion_datetime: property.completion_datetime || null,
        readiness: property.readiness,
        min_price: property.min_price,
        max_price: property.max_price,
        price_currency: property.price_currency,
        service_charge: property.service_charge || null,
        min_area: property.min_area,
        max_area: property.max_area,
        area_unit: property.area_unit,
        furnishing: property.furnishing || null,
        has_escrow: property.has_escrow || false,
        post_handover: property.post_handover || false,
        cover_url: property.cover_url || null,
        video_url: property.video_url || null,
        brochure_url: property.brochure_url || null,
        layouts_pdf: property.layouts_pdf || null,
        parking_specs: property.parking_specs || null,
        overview: property.overview || null,
      })

    if (propertyError) {
      throw new Error(`Property insert failed: ${propertyError.message}`)
    }

    console.log('Property inserted with ID:', property_id)

    // Step 6: Insert Unit Types
    if (unitTypes && unitTypes.length > 0) {
      const unitBlocksToInsert = unitTypes.map((unit: any) => ({
        property_id: property_id,
        external_id: generateHashId(`${property.external_id}-${unit.unit_type}-${unit.unit_bedrooms}`).toString(),
        unit_type: unit.unit_type,
        normalized_type: unit.normalized_type || null,
        unit_bedrooms: unit.unit_bedrooms,
        units_amount: unit.units_amount,
        units_area_from_m2: unit.units_area_from_m2,
        units_area_to_m2: unit.units_area_to_m2,
        units_price_from: unit.units_price_from,
        units_price_to: unit.units_price_to,
        typical_unit_image_url: unit.typical_unit_image_url || null,
      }))

      const { error: unitsError } = await supabaseClient
        .from('property_unit_blocks')
        .insert(unitBlocksToInsert)

      if (unitsError) {
        console.error('Unit blocks insert error:', unitsError)
      } else {
        console.log(`Inserted ${unitBlocksToInsert.length} unit types`)
      }
    }

    // Step 7: Insert Buildings
    if (buildings && buildings.length > 0) {
      const buildingsToInsert = buildings
        .filter((b: any) => b.building_name)
        .map((building: any) => ({
          property_id: property_id,
          external_id: generateHashId(`${property.external_id}-building-${building.building_name}`).toString(),
          name: building.building_name,
          description: building.building_description || null,
          completion_date: building.building_completion_date || null,
          image_url: building.building_image_url || null,
        }))

      if (buildingsToInsert.length > 0) {
        const { error: buildingsError } = await supabaseClient
          .from('property_buildings')
          .insert(buildingsToInsert)

        if (buildingsError) {
          console.error('Buildings insert error:', buildingsError)
        } else {
          console.log(`Inserted ${buildingsToInsert.length} buildings`)
        }
      }
    }

    // Step 8: Insert/Link Facilities
    if (facilities && facilities.length > 0) {
      for (const facility of facilities) {
        if (!facility.facility_name) continue

        // Check if facility exists in master table
        let facility_id = null
        const { data: existingFacility } = await supabaseClient
          .from('facilities')
          .select('id')
          .eq('name', facility.facility_name)
          .single()

        if (existingFacility) {
          facility_id = existingFacility.id
        } else {
          // Insert new facility
          const { data: newFacility, error: facilityError } = await supabaseClient
            .from('facilities')
            .insert({ name: facility.facility_name })
            .select('id')
            .single()

          if (facilityError) {
            console.error('Facility insert error:', facilityError)
            continue
          }
          facility_id = newFacility.id
        }

        // Link facility to property
        const { error: linkError } = await supabaseClient
          .from('property_facilities')
          .insert({
            property_id: property_id,
            facility_id: facility_id,
            image_url: facility.facility_image_url || null,
            image_source: facility.facility_image_source || null,
          })

        if (linkError) {
          console.error('Property facility link error:', linkError)
        }
      }
      console.log(`Processed ${facilities.length} facilities`)
    }

    // Step 9: Insert Map Points
    if (mapPoints && mapPoints.length > 0) {
      const mapPointsToInsert = mapPoints
        .filter((p: any) => p.poi_name)
        .map((point: any) => ({
          property_id: property_id,
          name: point.poi_name,
          distance_km: point.distance_km,
        }))

      if (mapPointsToInsert.length > 0) {
        const { error: mapPointsError } = await supabaseClient
          .from('property_map_points')
          .insert(mapPointsToInsert)

        if (mapPointsError) {
          console.error('Map points insert error:', mapPointsError)
        } else {
          console.log(`Inserted ${mapPointsToInsert.length} map points`)
        }
      }
    }

    // Step 10: Insert Images
    if (images) {
      const imageList: string[] = []
      
      // Split by newlines and commas
      const splitImages = images.split(/[\n,]/).map((url: string) => url.trim()).filter((url: string) => url)
      imageList.push(...splitImages)

      if (imageList.length > 0) {
        const imagesToInsert = imageList.map((url) => ({
          property_id: property_id,
          image_url: url,
          category: 'additional',
        }))

        const { error: imagesError } = await supabaseClient
          .from('property_images')
          .insert(imagesToInsert)

        if (imagesError) {
          console.error('Images insert error:', imagesError)
        } else {
          console.log(`Inserted ${imagesToInsert.length} images`)
        }
      }
    }

    // Insert cover image separately
    if (property.cover_url) {
      await supabaseClient
        .from('property_images')
        .insert({
          property_id: property_id,
          image_url: property.cover_url,
          category: 'cover',
        })
    }

    // Step 11: Insert Payment Plans
    if (paymentPlans && paymentPlans.length > 0) {
      for (const plan of paymentPlans) {
        if (!plan.payment_plan_name) continue

        // Generate plan ID
        const plan_id = generateHashId(`${property.external_id}-plan-${plan.payment_plan_name}`)

        // Insert payment plan
        const { error: planError } = await supabaseClient
          .from('property_payment_plans')
          .insert({
            id: plan_id,
            property_id: property_id,
            name: plan.payment_plan_name,
            description: plan.months_after_handover ? `${plan.months_after_handover} months after handover` : null,
          })

        if (planError) {
          console.error('Payment plan insert error:', planError)
          continue
        }

        // Parse and insert payment steps
        if (plan.payment_steps) {
          const steps = plan.payment_steps.split('|').map((s: string) => s.trim()).filter((s: string) => s)
          
          const paymentValuesToInsert = steps.map((step: string, index: number) => ({
            id: generateHashId(`${plan_id}-step-${index}`),
            property_payment_plan_id: plan_id,
            name: step,
            value_raw: step,
            sequence: index + 1,
          }))

          const { error: valuesError } = await supabaseClient
            .from('payment_plan_values')
            .insert(paymentValuesToInsert)

          if (valuesError) {
            console.error('Payment plan values insert error:', valuesError)
          }
        }
      }
      console.log(`Processed ${paymentPlans.length} payment plans`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        property_id: property_id,
        message: `Property "${property.name}" successfully added!`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

