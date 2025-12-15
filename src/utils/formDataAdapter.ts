import { FormData } from '../types/property.types';
import { PropertyFormData, ImageInput, DeveloperFormData, BuildingFormData, UnitBlockFormData, PaymentPlanFormData, FacilityFormData, MapPointFormData } from '../types/property-form.types';

/**
 * Converts a price from a given currency to AED
 * Uses approximate exchange rates (can be updated with real-time rates if needed)
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

/**
 * Converts old FormData structure to new PropertyFormData structure
 */
export function convertToPropertyFormData(oldData: FormData): PropertyFormData {
  // Convert cover URL to ImageInput
  const cover_image: ImageInput | null = oldData.cover_url 
    ? { url: oldData.cover_url } 
    : null;

  // Convert image_urls string to array of ImageInput (commented out as not currently used)
  // const additionalImages: ImageInput[] = oldData.image_urls
  //   ? oldData.image_urls.split(',').map(url => url.trim()).filter(Boolean).map(url => ({ url }))
  //   : [];

  // Convert developer data - if developer_id exists, we'll need to fetch developer data
  // For now, create empty developer object (will be populated if needed)
  // Note: Since we're using developer_id now, developer object is mainly for backward compatibility
  const developer: DeveloperFormData = {
    name: '', // Will be populated from developer_id if available
    description: null,
    email: null,
    website: null,
    office_address: null,
    logo: null,
    working_hours: null,
  };

  // Convert buildings
  const buildings: BuildingFormData[] = oldData.buildings.map(building => ({
    external_id: building.id || null,
    name: building.building_name || '',
    description: building.building_description || null,
    completion_date: building.building_completion_date || null,
    image_url: building.building_image_url || null,
  }));

  // Convert unit types to unit blocks
  const unit_blocks: UnitBlockFormData[] = oldData.unitTypes.map(unit => ({
    id: unit.id || null,
    unit_type: unit.unit_type || '',
    normalized_type: unit.normalized_type || '',
    unit_bedrooms: unit.unit_bedrooms || null,
    units_amount: unit.units_amount || null,
    units_area_from_m2: unit.units_area_from_m2 || null,
    units_area_to_m2: unit.units_area_to_m2 || null,
    units_price_from: unit.units_price_from || null,
    units_price_to: unit.units_price_to || null,
    typical_unit_image_url: unit.typical_unit_image_url || null,
    area_unit: oldData.area_unit || null,
    price_currency: oldData.price_currency || null,
  }));

  // Convert payment plans
  const payment_plans: PaymentPlanFormData[] = oldData.paymentPlans.map(plan => ({
    plan_name: plan.payment_plan_name || '',
    months_after_handover: plan.months_after_handover || null,
    payment_steps: plan.payment_steps || null,
  }));

  // Convert facilities
  const facilities: FacilityFormData[] = oldData.facilities.map(facility => ({
    name: facility.facility_name || '',
    image_url: facility.facility_image_url || null,
    image_source: facility.facility_image_source || null,
    image: facility.facility_image_url ? { url: facility.facility_image_url } : null,
  }));

  // Convert map points
  const map_points: MapPointFormData[] = oldData.mapPoints.map(point => ({
    name: point.poi_name || '',
    distance_km: point.distance_km || null,
  }));

  return {
    external_id: oldData.external_id || null,
    slug: oldData.slug || '',
    name: oldData.name || '',
    area: oldData.area || null,
    city: oldData.city || '',
    country: oldData.country || '',
    status: oldData.status || null,
    readiness: oldData.readiness || null,
    sale_status: oldData.sale_status || null,
    completion_datetime: oldData.completion_datetime || null,
    // Convert property-level prices to AED if needed
    min_price_aed: oldData.min_price 
      ? (oldData.price_currency === 'AED' ? oldData.min_price : convertToAED(oldData.min_price, oldData.price_currency))
      : null,
    max_price_aed: oldData.max_price 
      ? (oldData.price_currency === 'AED' ? oldData.max_price : convertToAED(oldData.max_price, oldData.price_currency))
      : null,
    price_currency: oldData.price_currency || null,
    min_area: oldData.min_area || null,
    max_area: oldData.max_area || null,
    area_unit: oldData.area_unit || null,
    furnishing: oldData.furnishing || null,
    service_charge: oldData.service_charge || null,
    parking: oldData.parking_specs !== undefined && oldData.parking_specs !== null ? oldData.parking_specs : null,
    has_escrow: oldData.has_escrow || false,
    post_handover: oldData.post_handover || false,
    is_partner_project: false,
    coordinates_text: oldData.coordinates || null,
    overview: oldData.overview || null,
    website: oldData.website || null,
    video_url: oldData.video_url || null,
    brochure_url: oldData.brochure_url || null,
    layouts_pdf: oldData.layouts_pdf || null,
    permit_id: oldData.permit_id || null,
    cover_image,
    lobby_images: [],
    interior_images: [],
    architecture_images: [],
    master_plan_images: [],
    developer,
    developer_id: oldData.developer_id || null, // Preserve developer_id
    buildings,
    unit_blocks,
    payment_plans,
    facilities,
    map_points,
    // Legacy fields for backward compatibility
    cover_url: oldData.cover_url || null,
    image_urls: oldData.image_urls || null,
    unitTypes: oldData.unitTypes,
    mapPoints: oldData.mapPoints,
  };
}

/**
 * Converts new PropertyFormData structure back to old FormData structure
 * (for backward compatibility during migration)
 */
export function convertToOldFormData(newData: PropertyFormData): FormData {
  return {
    external_id: newData.external_id || '',
    name: newData.name || '',
    slug: newData.slug || '',
    developer_id: newData.developer_id || null, // Use preserved developer_id
    area: newData.area || '',
    city: newData.city || '',
    country: newData.country || '',
    coordinates: newData.coordinates_text || '',
    website: newData.website || '',
    status: newData.status || '',
    sale_status: newData.sale_status || '',
    completion_datetime: newData.completion_datetime || '',
    readiness: newData.readiness || null,
    permit_id: newData.permit_id || '',
    // Convert back - if price_currency is not AED, we need to convert back
    // But actually, the form stores min_price_aed/max_price_aed, so use those directly
    min_price: newData.min_price_aed || null,
    max_price: newData.max_price_aed || null,
    price_currency: newData.price_currency || 'AED',
    service_charge: newData.service_charge || '',
    min_area: newData.min_area || null,
    max_area: newData.max_area || null,
    area_unit: newData.area_unit || 'sqft',
    furnishing: newData.furnishing || '',
    has_escrow: newData.has_escrow || false,
    post_handover: newData.post_handover || false,
    unitTypes: newData.unit_blocks.map(block => ({
      id: block.id || Date.now().toString(),
      unit_type: block.unit_type,
      normalized_type: block.normalized_type,
      unit_bedrooms: block.unit_bedrooms || '',
      units_amount: block.units_amount || null,
      units_area_from_m2: block.units_area_from_m2 || null,
      units_area_to_m2: block.units_area_to_m2 || null,
      units_price_from: block.units_price_from || null,
      units_price_to: block.units_price_to || null,
      typical_unit_image_url: block.typical_unit_image_url || '',
    })),
    buildings: newData.buildings.map(building => ({
      id: building.external_id || Date.now().toString(),
      building_name: building.name,
      building_description: building.description || '',
      building_completion_date: building.completion_date || '',
      building_image_url: building.image_url || '',
    })),
    facilities: newData.facilities.map(facility => ({
      id: Date.now().toString(),
      facility_name: facility.name,
      facility_image_url: facility.image_url || facility.image?.url || '',
      facility_image_source: facility.image_source || '',
    })),
    mapPoints: newData.map_points.map(point => ({
      id: Date.now().toString(),
      poi_name: point.name,
      distance_km: point.distance_km || null,
    })),
    cover_url: newData.cover_image?.url || newData.cover_url || '',
    // Use the preserved image_urls if available, otherwise reconstruct from image arrays
    image_urls: newData.image_urls || [
      ...(newData.lobby_images || []).map(img => img.url),
      ...(newData.interior_images || []).map(img => img.url),
      ...(newData.architecture_images || []).map(img => img.url),
      ...(newData.master_plan_images || []).map(img => img.url),
    ].filter(Boolean).join(','),
    video_url: newData.video_url || '',
    brochure_url: newData.brochure_url || '',
    layouts_pdf: newData.layouts_pdf || '',
    paymentPlans: newData.payment_plans.map(plan => ({
      id: Date.now().toString(),
      payment_plan_name: plan.plan_name,
      payment_steps: plan.payment_steps || '',
      months_after_handover: plan.months_after_handover || null,
    })),
    parking_specs: newData.parking !== null && newData.parking !== undefined ? newData.parking : '',
    overview: newData.overview || '',
  };
}

