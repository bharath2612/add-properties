export interface UnitType {
  id: string;
  unit_type: string;
  normalized_type: string;
  unit_bedrooms: string;
  units_amount: number | null;
  units_area_from_m2: number | null;
  units_area_to_m2: number | null;
  units_price_from: number | null;
  units_price_to: number | null;
  typical_unit_image_url: string;
}

export interface Building {
  id: string;
  building_name: string;
  building_description: string;
  building_completion_date: string;
  building_image_url: string;
}

export interface Facility {
  id: string;
  facility_name: string;
  facility_image_url: string;
  facility_image_source: string;
}

export interface MapPoint {
  id: string;
  poi_name: string;
  distance_km: number | null;
}

export interface PaymentPlan {
  id: string;
  payment_plan_name: string;
  payment_steps: string;
  months_after_handover: number | null;
}

export interface FormData {
  // Step 1: Basic Information
  external_id: string;
  name: string;
  slug: string;
  developer: string;

  // Step 2: Location & Contact
  area: string;
  city: string;
  country: string;
  coordinates: string;
  website: string;

  // Step 3: Project Status & Timeline
  status: string;
  sale_status: string;
  completion_datetime: string;
  readiness: number | null;
  permit_id: string;

  // Step 4: Pricing & Terms
  min_price: number | null;
  max_price: number | null;
  price_currency: string;
  service_charge: string;
  min_area: number | null;
  max_area: number | null;
  area_unit: string;
  furnishing: string;
  has_escrow: boolean;
  post_handover: boolean;

  // Step 5: Unit Types (Dynamic)
  unitTypes: UnitType[];

  // Step 6: Amenities & Features
  buildings: Building[];
  facilities: Facility[];
  mapPoints: MapPoint[];

  // Step 7: Media & Documents
  cover_url: string;
  image_urls: string;
  video_url: string;
  brochure_url: string;
  layouts_pdf: string;

  // Step 8: Payment Plans & Parking
  paymentPlans: PaymentPlan[];
  parking_specs: string;

  // Step 9: Developer & Description
  overview: string;
  developer_email: string;
  developer_phone: string;
  developer_office: string;
  developer_description: string;
  developer_website: string;
  developer_logo_url: string;
  developer_working_hours: string;
}

export const initialFormData: FormData = {
  external_id: '',
  name: '',
  slug: '',
  developer: '',
  area: '',
  city: '',
  country: '',
  coordinates: '',
  website: '',
  status: '',
  sale_status: '',
  completion_datetime: '',
  readiness: null,
  permit_id: '',
  min_price: null,
  max_price: null,
  price_currency: 'AED',
  service_charge: '',
  min_area: null,
  max_area: null,
  area_unit: 'sqft',
  furnishing: '',
  has_escrow: false,
  post_handover: false,
  unitTypes: [],
  buildings: [],
  facilities: [],
  mapPoints: [],
  cover_url: '',
  image_urls: '',
  video_url: '',
  brochure_url: '',
  layouts_pdf: '',
  paymentPlans: [],
  parking_specs: '',
  overview: '',
  developer_email: '',
  developer_phone: '',
  developer_office: '',
  developer_description: '',
  developer_website: '',
  developer_logo_url: '',
  developer_working_hours: '',
};

