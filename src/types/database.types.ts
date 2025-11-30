// Database schema types based on Supabase tables

export interface Property {
  id: number;
  external_id: string;
  name: string;
  slug: string | null;
  developer: string;
  developer_id: number | null;
  area: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinates: string | null;
  website: string | null;
  status: string;
  sale_status: string | null;
  completion_datetime: string | null;
  readiness: number | null;
  min_price: number | null;
  max_price: number | null;
  price_currency: string;
  service_charge: string | null;
  min_area: number | null;
  max_area: number | null;
  area_unit: string;
  furnishing: string | null;
  has_escrow: boolean;
  post_handover: boolean;
  cover_url: string | null;
  video_url: string | null;
  brochure_url: string | null;
  layouts_pdf: string | null;
  parking_specs: string | null;
  overview: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PartnerDeveloper {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  office_address: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  working_hours: string | null;
  created_at: string;
}

export interface PropertyImage {
  id: number;
  property_id: number;
  image_url: string;
  category: string | null; // 'cover', 'additional', etc.
  created_at: string;
}

export interface PropertyUnitBlock {
  id: number;
  property_id: number;
  source_id: string | null;
  external_id: string;
  unit_type: string;
  normalized_type: string | null;
  unit_bedrooms: string;
  units_amount: number | null;
  units_area_from_m2: number | null;
  units_area_to_m2: number | null;
  units_price_from: number | null;
  units_price_to: number | null;
  typical_unit_image_url: string | null;
  created_at: string;
}

export interface PropertyBuilding {
  id: number;
  property_id: number;
  external_id: string;
  name: string;
  description: string | null;
  completion_date: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Facility {
  id: number;
  name: string;
  created_at: string;
}

export interface PropertyFacility {
  id: number;
  property_id: number;
  facility_id: number;
  image_url: string | null;
  image_source: string | null;
  created_at: string;
}

export interface PropertyMapPoint {
  id: number;
  property_id: number;
  source_id: string | null;
  name: string;
  distance_km: number | null;
  created_at: string;
}

export interface PropertyPaymentPlan {
  id: number;
  property_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface PaymentPlanValue {
  id: number;
  property_payment_plan_id: number;
  name: string;
  value_raw: string;
  sequence: number;
  created_at: string;
}

// Combined property details interface
export interface PropertyDetails {
  property: Property;
  developer: PartnerDeveloper | null;
  images: PropertyImage[];
  unitBlocks: PropertyUnitBlock[];
  buildings: PropertyBuilding[];
  facilities: Array<Facility & { propertyFacility: PropertyFacility }>;
  mapPoints: PropertyMapPoint[];
  paymentPlans: Array<PropertyPaymentPlan & { values: PaymentPlanValue[] }>;
}

