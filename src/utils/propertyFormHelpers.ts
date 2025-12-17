import {
  PropertyFormData,
  FrontendPropertyPayload,
  ValidationIssue,
  BuildingFormData,
  UnitBlockFormData,
  PaymentPlanFormData,
  FacilityFormData,
  MapPointFormData,
} from '../types/property-form.types';

/**
 * Converts square meters to square feet
 */
function m2ToSqft(m2: number | null | undefined): number | null {
  if (m2 === null || m2 === undefined) return null;
  return m2 * 10.7639;
}

/**
 * Converts square feet to square meters
 */
function sqftToM2(sqft: number | null | undefined): number | null {
  if (sqft === null || sqft === undefined) return null;
  return sqft / 10.7639;
}

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
 * Builds the property payload from form data
 * This is the SINGLE source of truth for what gets sent to the backend
 */
export function buildPropertyPayload(form: PropertyFormData): FrontendPropertyPayload {
  const payload: FrontendPropertyPayload = {
    external_id: form.external_id || null,
    slug: form.slug || null,
    name: form.name || null,
    area: form.area || null,
    city: form.city || null,
    country: form.country || null,
    developer: form.developer?.name || null,
    developer_data: form.developer ? {
      name: form.developer.name,
      description: form.developer.description || null,
      email: form.developer.email || null,
      website: form.developer.website || null,
      office_address: form.developer.office_address || null,
      logo: form.developer.logo || null,
      working_hours: form.developer.working_hours || null,
    } : null,
    status: form.status || null,
    readiness: form.readiness || null,
    sale_status: form.sale_status || null,
    completion_datetime: form.completion_datetime || null,
    // Property-level prices: store face value with currency
    min_price: form.min_price ?? form.min_price_aed ?? null,
    max_price: form.max_price ?? form.max_price_aed ?? null,
    price_currency: form.price_currency || null,
    min_area: form.min_area || null,
    max_area: form.max_area || null,
    area_unit: form.area_unit || null,
    furnishing: form.furnishing || null,
    service_charge: form.service_charge || null,
    parking: form.parking || null,
    has_escrow: form.has_escrow || false,
    post_handover: form.post_handover || false,
    is_partner_project: form.is_partner_project || false,
    coordinates_text: form.coordinates_text || null,
    overview: form.overview || null,
    website: form.website || null,
    video_url: form.video_url || null,
    brochure_url: form.brochure_url || null,
    layouts_pdf: form.layouts_pdf || null,
    permit_id: form.permit_id || null,
    cover: form.cover_image || null,
    lobby: form.lobby_images && form.lobby_images.length > 0 ? form.lobby_images : null,
    interior: form.interior_images && form.interior_images.length > 0 ? form.interior_images : null,
    architecture: form.architecture_images && form.architecture_images.length > 0 ? form.architecture_images : null,
    master_plan: form.master_plan_images && form.master_plan_images.length > 0 ? form.master_plan_images : null,
  };

  // Map buildings
  if (form.buildings && form.buildings.length > 0) {
    payload.buildings = form.buildings.map((building: BuildingFormData) => ({
      external_id: building.external_id || null,
      name: building.name,
      description: building.description || null,
      completion_date: building.completion_date || null,
      image_url: building.image_url || null,
    }));
  }

  // Map unit blocks with proper conversions
  if (form.unit_blocks && form.unit_blocks.length > 0) {
    payload.unit_blocks = form.unit_blocks.map((block: UnitBlockFormData) => {
      // Ensure we have both sqft and m2 values
      let units_area_from = block.units_area_from;
      let units_area_to = block.units_area_to;
      let units_area_from_m2 = block.units_area_from_m2;
      let units_area_to_m2 = block.units_area_to_m2;

      // Convert if needed based on area_unit
      if (block.area_unit === 'sqft' || block.area_unit === 'sqm') {
        if (units_area_from !== null && units_area_from !== undefined && !units_area_from_m2) {
          units_area_from_m2 = sqftToM2(units_area_from);
        }
        if (units_area_to !== null && units_area_to !== undefined && !units_area_to_m2) {
          units_area_to_m2 = sqftToM2(units_area_to);
        }
      } else if (block.area_unit === 'm2') {
        if (units_area_from_m2 !== null && units_area_from_m2 !== undefined && !units_area_from) {
          units_area_from = m2ToSqft(units_area_from_m2);
        }
        if (units_area_to_m2 !== null && units_area_to_m2 !== undefined && !units_area_to) {
          units_area_to = m2ToSqft(units_area_to_m2);
        }
      }

      // Handle price conversions - ensure AED values are set
      let units_price_from_aed = block.units_price_from_aed;
      let units_price_to_aed = block.units_price_to_aed;

      // If AED values are not already set, convert from the given currency
      if (!units_price_from_aed && block.units_price_from !== null && block.units_price_from !== undefined) {
        if (block.price_currency === 'AED') {
          units_price_from_aed = block.units_price_from;
        } else {
          // Convert from the given currency to AED
          units_price_from_aed = convertToAED(block.units_price_from, block.price_currency);
        }
      }

      if (!units_price_to_aed && block.units_price_to !== null && block.units_price_to !== undefined) {
        if (block.price_currency === 'AED') {
          units_price_to_aed = block.units_price_to;
        } else {
          // Convert from the given currency to AED
          units_price_to_aed = convertToAED(block.units_price_to, block.price_currency);
        }
      }

      return {
        normalized_type: block.normalized_type,
        unit_bedrooms: block.unit_bedrooms || null,
        units_amount: block.units_amount || null,
        typical_unit_image_url: block.typical_unit_image_url || null,
        unit_type: block.unit_type,
        price_currency: block.price_currency || null,
        units_area_from_m2: units_area_from_m2,
        units_area_to_m2: units_area_to_m2,
        area_unit: block.area_unit || null,
        units_area_from: units_area_from,
        units_area_to: units_area_to,
        units_price_from: block.units_price_from || null,
        units_price_to: block.units_price_to || null,
        units_price_from_aed: units_price_from_aed,
        units_price_to_aed: units_price_to_aed,
      };
    });
  }

  // Map payment plans
  if (form.payment_plans && form.payment_plans.length > 0) {
    payload.payment_plans = form.payment_plans.map((plan: PaymentPlanFormData) => ({
      plan_name: plan.plan_name,
      months_after_handover: plan.months_after_handover || null,
      payments_raw: plan.payments_raw || null,
      payment_steps: plan.payment_steps || null,
    }));
  }

  // Map facilities
  if (form.facilities && form.facilities.length > 0) {
    payload.facilities = form.facilities.map((facility: FacilityFormData) => ({
      name: facility.name,
      image: facility.image || null,
      image_source: facility.image_source || null,
      image_url: facility.image_url || facility.image?.url || null,
    }));
  }

  // Map map points
  if (form.map_points && form.map_points.length > 0) {
    payload.map_points = form.map_points.map((point: MapPointFormData) => ({
      name: point.name,
      distance_km: point.distance_km || null,
    }));
  }

  return payload;
}

/**
 * Validates the property form data and returns a list of issues
 */
export function validatePropertyForm(form: PropertyFormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // REQUIRED FIELDS (errors)
  if (!form.slug || !form.slug.trim()) {
    issues.push({ path: 'slug', severity: 'error', message: 'Slug is required' });
  }

  if (!form.name || !form.name.trim()) {
    issues.push({ path: 'name', severity: 'error', message: 'Property name is required' });
  }

  if (!form.city || !form.city.trim()) {
    issues.push({ path: 'city', severity: 'error', message: 'City is required' });
  }

  if (!form.country || !form.country.trim()) {
    issues.push({ path: 'country', severity: 'error', message: 'Country is required' });
  }

  // Note: Developer validation is now handled at form level (developer_id selection)
  // Developer object in PropertyFormData may be empty if using developer_id
  // Validation for developer_id happens in the form component itself

  if (!form.unit_blocks || form.unit_blocks.length === 0) {
    issues.push({
      path: 'unit_blocks',
      severity: 'error',
      message: 'At least one unit block is required'
    });
  }

  // WARNINGS (nice to have, but not fatal)
  if (!form.cover_image?.url) {
    issues.push({
      path: 'cover_image.url',
      severity: 'warning',
      message: 'Cover image is recommended'
    });
  }

  if (!form.payment_plans || form.payment_plans.length === 0) {
    issues.push({
      path: 'payment_plans',
      severity: 'warning',
      message: 'No payment plans added'
    });
  }

  if (!form.facilities || form.facilities.length === 0) {
    issues.push({
      path: 'facilities',
      severity: 'warning',
      message: 'No facilities added'
    });
  }

  if (!form.map_points || form.map_points.length === 0) {
    issues.push({
      path: 'map_points',
      severity: 'warning',
      message: 'No map points / points of interest added'
    });
  }

  // Validate unit blocks
  if (form.unit_blocks) {
    form.unit_blocks.forEach((block, idx) => {
      if (!block.units_amount) {
        issues.push({
          path: `unit_blocks[${idx}].units_amount`,
          severity: 'warning',
          message: 'units_amount is missing'
        });
      }

      if (!block.units_area_from_m2 || !block.units_area_to_m2) {
        issues.push({
          path: `unit_blocks[${idx}].units_area_from_m2`,
          severity: 'warning',
          message: 'Units area in m2 is partially missing'
        });
      }

      if (!block.units_price_from || !block.units_price_to) {
        issues.push({
          path: `unit_blocks[${idx}].units_price_from`,
          severity: 'warning',
          message: 'Units price range is partially missing'
        });
      }

      // Check if AED values are set, or if they can be derived from price_currency and price values
      const canDeriveAED = block.price_currency && 
        block.units_price_from !== null && block.units_price_from !== undefined &&
        block.units_price_to !== null && block.units_price_to !== undefined;
      
      const hasAEDValues = block.units_price_from_aed !== null && block.units_price_from_aed !== undefined &&
        block.units_price_to_aed !== null && block.units_price_to_aed !== undefined;

      // Only warn if AED values are missing AND we can't derive them
      if (!hasAEDValues && !canDeriveAED) {
        issues.push({
          path: `unit_blocks[${idx}].units_price_from_aed`,
          severity: 'warning',
          message: 'Units price range in AED is missing and cannot be derived from currency conversion'
        });
      }
    });
  }

  // Validate price range at property level
  if (!form.min_price_aed || !form.max_price_aed) {
    issues.push({
      path: 'min_price_aed',
      severity: 'warning',
      message: 'Property price range in AED is missing'
    });
  }

  // Validate coordinates
  if (!form.coordinates_text) {
    issues.push({
      path: 'coordinates_text',
      severity: 'warning',
      message: 'Coordinates or location text is missing'
    });
  }

  return issues;
}

