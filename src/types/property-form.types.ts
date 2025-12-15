// TypeScript interfaces for property form data and payload

export interface ImageInput {
  url: string;
  name?: string | null;
  path?: string | null;
  mime?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  image_source?: string | null;
}

export interface DeveloperFormData {
  name: string;
  description?: string | null;
  email?: string | null;
  website?: string | null;
  office_address?: string | null;
  logo?: ImageInput | null;
  working_hours?: string | null;
}

export interface BuildingFormData {
  external_id?: string | null;
  name: string;
  description?: string | null;
  completion_date?: string | null;   // ISO date string
  image_url?: string | null;
}

export interface UnitBlockFormData {
  id?: string | null;
  unit_type: string;                 // e.g. "Apartments"
  normalized_type: string;           // e.g. "1BR"
  unit_bedrooms?: string | null;
  bedrooms_amount?: number | null;
  units_amount: number | null;
  area_unit?: string | null;         // "sqft" or "m2"
  units_area_from?: number | null;   // in sqft
  units_area_to?: number | null;     // in sqft
  units_area_from_m2?: number | null;
  units_area_to_m2?: number | null;
  price_currency?: string | null;    // "AED"
  units_price_from?: number | null;
  units_price_to?: number | null;
  units_price_from_aed?: number | null;
  units_price_to_aed?: number | null;
  typical_unit_image_url?: string | null;
}

export interface PaymentPlanFormData {
  plan_name: string;
  months_after_handover?: number | null;
  payments_raw?: any;                // optional JSON config for now
  payment_steps?: string | null;     // legacy field for backward compatibility
}

export interface FacilityFormData {
  name: string;
  image?: ImageInput | null;
  image_source?: string | null;
  image_url?: string | null;         // legacy field for backward compatibility
}

export interface MapPointFormData {
  name: string;
  distance_km?: number | null;
}

export interface PropertyFormData {
  external_id?: string | null;
  slug: string;
  name: string;
  area?: string | null;
  city: string;
  country: string;
  status?: string | null;
  readiness?: number | null;
  sale_status?: string | null;
  completion_datetime?: string | null;
  min_price_aed?: number | null;
  max_price_aed?: number | null;
  price_currency?: string | null;
  min_area?: number | null;
  max_area?: number | null;
  area_unit?: string | null;
  furnishing?: string | null;
  service_charge?: string | null;
  parking?: string | null;
  has_escrow?: boolean;
  post_handover?: boolean;
  is_partner_project?: boolean;
  coordinates_text?: string | null;
  overview?: string | null;
  website?: string | null;
  video_url?: string | null;
  brochure_url?: string | null;
  layouts_pdf?: string | null;
  permit_id?: string | null;

  // Media and related entities
  cover_image?: ImageInput | null;
  lobby_images?: ImageInput[];
  interior_images?: ImageInput[];
  architecture_images?: ImageInput[];
  master_plan_images?: ImageInput[];

  developer: DeveloperFormData;
  developer_id?: number | null; // Preserve developer_id for backward compatibility
  buildings: BuildingFormData[];
  unit_blocks: UnitBlockFormData[];
  payment_plans: PaymentPlanFormData[];
  facilities: FacilityFormData[];
  map_points: MapPointFormData[];

  // Legacy fields for backward compatibility during migration
  cover_url?: string | null;
  image_urls?: string | null;
  unitTypes?: any[];
  mapPoints?: any[];
}

// Payload type that matches what backend expects
export interface FrontendPropertyPayload {
  slug?: string | null;
  name?: string | null;
  area?: string | null;
  city?: string | null;
  country?: string | null;
  developer?: string | null;
  developer_data?: any;
  status?: string | null;
  readiness?: number | string | null;
  sale_status?: string | null;
  completion_datetime?: string | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  min_price_aed?: number | null;
  max_price_aed?: number | null;
  price_currency?: string | null;
  min_area?: number | string | null;
  max_area?: number | string | null;
  area_unit?: string | null;
  furnishing?: string | null;
  service_charge?: string | null;
  parking?: string | null;
  has_escrow?: boolean | null;
  post_handover?: boolean | null;
  is_partner_project?: boolean | null;
  coordinates?: string | null;
  coordinates_text?: string | null;
  overview?: string | null;
  website?: string | null;
  video_url?: string | null;
  brochure_url?: string | null;
  layouts_pdf?: string | null;
  permit_id?: string | null;
  external_id?: string | null;
  cover?: ImageInput | null;
  lobby?: ImageInput[] | null;
  interior?: ImageInput[] | null;
  architecture?: ImageInput[] | null;
  master_plan?: ImageInput[] | null;
  buildings?: any;
  unit_blocks?: any;
  payment_plans?: any;
  facilities?: any;
  map_points?: any;
  [key: string]: any;
}

// Validation types
export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  path: string;        // e.g. "slug", "unit_blocks[0].units_amount"
  severity: IssueSeverity;
  message: string;
}
