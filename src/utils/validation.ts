import { FormData } from '../types/property.types';

export interface ValidationError {
  field: string;
  message: string;
  step?: number;
}

export const validateFormData = (formData: FormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Step 1: Project Identity - MANDATORY
  if (!formData.external_id || formData.external_id.trim() === '') {
    errors.push({ field: 'external_id', message: 'External ID is required', step: 1 });
  }
  if (!formData.name || formData.name.trim() === '') {
    errors.push({ field: 'name', message: 'Property Name is required', step: 1 });
  }
  if (!formData.developer_id || formData.developer_id === null) {
    errors.push({ field: 'developer_id', message: 'Developer is required', step: 1 });
  }
  if (!formData.overview || formData.overview.trim() === '') {
    errors.push({ field: 'overview', message: 'Project overview is required', step: 1 });
  } else if (formData.overview.trim().length < 150) {
    errors.push({ 
      field: 'overview', 
      message: `Project overview must be at least 150 characters (currently ${formData.overview.trim().length} characters)`, 
      step: 1 
    });
  }

  // Step 2: Location - MANDATORY
  if (!formData.area || formData.area.trim() === '') {
    errors.push({ field: 'area', message: 'Area is required', step: 2 });
  }
  if (!formData.city || formData.city.trim() === '') {
    errors.push({ field: 'city', message: 'City is required', step: 2 });
  }
  if (!formData.country || formData.country.trim() === '') {
    errors.push({ field: 'country', message: 'Country is required', step: 2 });
  }
  if (!formData.coordinates || formData.coordinates.trim() === '') {
    errors.push({ field: 'coordinates', message: 'Coordinates are required', step: 2 });
  }

  // Step 3: Status - MANDATORY
  if (!formData.status || formData.status.trim() === '') {
    errors.push({ field: 'status', message: 'Status is required', step: 3 });
  }
  if (!formData.permit_id || formData.permit_id.trim() === '') {
    errors.push({ field: 'permit_id', message: 'RERA Number / Permit ID is required', step: 3 });
  }

  // Step 4: Pricing - MANDATORY
  if (!formData.price_currency || formData.price_currency.trim() === '') {
    errors.push({ field: 'price_currency', message: 'Price Currency is required', step: 4 });
  }
  if (!formData.area_unit || formData.area_unit.trim() === '') {
    errors.push({ field: 'area_unit', message: 'Area Unit is required', step: 4 });
  }

  // Step 5: Unit Types Validation (at least one required)
  if (!formData.unitTypes || formData.unitTypes.length === 0) {
    errors.push({
      field: 'unitTypes',
      message: 'At least one unit type is required',
      step: 5,
    });
  }

  // Step 5: Unit Types Validation (per item)
  formData.unitTypes.forEach((unit, index) => {
    if (!unit.unit_type || unit.unit_type.trim() === '') {
      errors.push({ 
        field: `unitTypes[${index}].unit_type`, 
        message: `Unit Type is required for unit ${index + 1}`, 
        step: 5 
      });
    }
    if (!unit.unit_bedrooms || unit.unit_bedrooms.trim() === '') {
      errors.push({ 
        field: `unitTypes[${index}].unit_bedrooms`, 
        message: `Bedrooms is required for unit ${index + 1}`, 
        step: 5 
      });
    }
    if (!unit.id || unit.id.trim() === '') {
      errors.push({ 
        field: `unitTypes[${index}].id`, 
        message: `ID is required for unit ${index + 1}`, 
        step: 5 
      });
    }
  });

  // Step 6: Buildings Validation (at least one required)
  if (!formData.buildings || formData.buildings.length === 0) {
    errors.push({
      field: 'buildings',
      message: 'At least one building is required',
      step: 6,
    });
  }

  // Step 6: Buildings Validation (per item)
  formData.buildings.forEach((building, index) => {
    if (!building.id || building.id.trim() === '') {
      errors.push({ 
        field: `buildings[${index}].id`, 
        message: `ID is required for building ${index + 1}`, 
        step: 6 
      });
    }
    if (!building.building_name || building.building_name.trim() === '') {
      errors.push({ 
        field: `buildings[${index}].building_name`, 
        message: `Name is required for building ${index + 1}`, 
        step: 6 
      });
    }
  });

  // Step 6: Facilities Validation (at least one required)
  if (!formData.facilities || formData.facilities.length === 0) {
    errors.push({
      field: 'facilities',
      message: 'At least one facility is required',
      step: 6,
    });
  }

  // Step 6: Facilities Validation (per item)
  formData.facilities.forEach((facility, index) => {
    if (!facility.facility_name || facility.facility_name.trim() === '') {
      errors.push({ 
        field: `facilities[${index}].facility_name`, 
        message: `Name is required for facility ${index + 1}`, 
        step: 6 
      });
    }
  });

  // Step 6: Map Points Validation (at least one required)
  if (!formData.mapPoints || formData.mapPoints.length === 0) {
    errors.push({
      field: 'mapPoints',
      message: 'At least one point of interest is required',
      step: 6,
    });
  }

  // Step 6: Map Points Validation (per item)
  formData.mapPoints.forEach((point, index) => {
    if (!point.poi_name || point.poi_name.trim() === '') {
      errors.push({ 
        field: `mapPoints[${index}].poi_name`, 
        message: `Name is required for map point ${index + 1}`, 
        step: 6 
      });
    }
  });

  // Step 7: Media Validation
  if (!formData.cover_url || formData.cover_url.trim() === '') {
    errors.push({
      field: 'cover_url',
      message: 'Cover image is required',
      step: 7,
    });
  }

  // Check additional images
  const additionalImages = formData.image_urls 
    ? formData.image_urls.split(',').map(url => url.trim()).filter(Boolean)
    : [];
  if (additionalImages.length === 0) {
    errors.push({
      field: 'image_urls',
      message: 'At least one additional image is required',
      step: 7,
    });
  }

  // Step 8: Payment Plans Validation (at least one required)
  if (!formData.paymentPlans || formData.paymentPlans.length === 0) {
    errors.push({
      field: 'paymentPlans',
      message: 'At least one payment plan is required',
      step: 8,
    });
  }

  // Step 8: Payment Plans Validation (per item)
  formData.paymentPlans.forEach((plan, index) => {
    if (!plan.payment_plan_name || plan.payment_plan_name.trim() === '') {
      errors.push({ 
        field: `paymentPlans[${index}].payment_plan_name`, 
        message: `Plan name is required for payment plan ${index + 1}`, 
        step: 8 
      });
    }
    if (!plan.payment_steps || plan.payment_steps.trim() === '') {
      errors.push({ 
        field: `paymentPlans[${index}].payment_steps`, 
        message: `Payment steps are required for payment plan ${index + 1}`, 
        step: 8 
      });
    }
  });

  return errors;
};

export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return '';
  
  const grouped = errors.reduce((acc, error) => {
    const step = error.step || 0;
    if (!acc[step]) acc[step] = [];
    acc[step].push(error.message);
    return acc;
  }, {} as Record<number, string[]>);

  let message = 'Please fix the following errors:\n\n';
  Object.keys(grouped).sort().forEach(step => {
    if (step !== '0') {
      message += `Step ${step}:\n`;
    }
    grouped[parseInt(step)].forEach(msg => {
      message += `  • ${msg}\n`;
    });
    message += '\n';
  });

  return message;
};
