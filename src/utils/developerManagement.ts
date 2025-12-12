import { SupabaseClient } from '@supabase/supabase-js';
import { PartnerDeveloper } from '../types/database.types';

export interface DeveloperFormData {
  name: string;
  email?: string | null;
  office_address?: string | null;
  website?: string | null;
  logo_url?: string | null;
  description?: string | null;
  working_hours?: any | null; // JSONB - can be object, array, string, or null
  source_id?: number | null;
}

export interface DeveloperManagementResult {
  success: boolean;
  developer?: PartnerDeveloper;
  error?: string;
}

/**
 * Fetch all developers from the database
 */
export const fetchDevelopers = async (
  supabase: SupabaseClient
): Promise<{ data: PartnerDeveloper[] | null; error: any }> => {
  const { data, error } = await supabase
    .from('partner_developers')
    .select('*')
    .order('name', { ascending: true });

  return { data, error };
};

/**
 * Create a new developer
 */
export const createDeveloper = async (
  supabase: SupabaseClient,
  developerData: DeveloperFormData
): Promise<DeveloperManagementResult> => {
  try {
    // Validate required fields
    if (!developerData.name || !developerData.name.trim()) {
      return {
        success: false,
        error: 'Developer name is required',
      };
    }

    // Check if developer with same name already exists
    const { data: existing } = await supabase
      .from('partner_developers')
      .select('id')
      .eq('name', developerData.name.trim())
      .single();

    if (existing) {
      return {
        success: false,
        error: `Developer "${developerData.name}" already exists`,
      };
    }

    // Parse working_hours if it's a string (convert to JSONB)
    let workingHoursJsonb = null;
    if (developerData.working_hours) {
      if (typeof developerData.working_hours === 'string') {
        try {
          workingHoursJsonb = JSON.parse(developerData.working_hours);
        } catch {
          // If not valid JSON, store as object with the string value
          workingHoursJsonb = { text: developerData.working_hours };
        }
      } else {
        workingHoursJsonb = developerData.working_hours;
      }
    }

    // Insert new developer
    const { data: newDeveloper, error: insertError } = await supabase
      .from('partner_developers')
      .insert({
        name: developerData.name.trim(),
        email: developerData.email?.trim() || null,
        office_address: developerData.office_address?.trim() || null,
        website: developerData.website?.trim() || null,
        logo_url: developerData.logo_url?.trim() || null,
        description: developerData.description?.trim() || null,
        working_hours: workingHoursJsonb,
        source_id: developerData.source_id || null,
      })
      .select()
      .single();

    if (insertError) {
      return {
        success: false,
        error: `Failed to create developer: ${insertError.message}`,
      };
    }

    return {
      success: true,
      developer: newDeveloper,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
};

/**
 * Update an existing developer
 */
export const updateDeveloper = async (
  supabase: SupabaseClient,
  developerId: number,
  developerData: DeveloperFormData
): Promise<DeveloperManagementResult> => {
  try {
    // Validate required fields
    if (!developerData.name || !developerData.name.trim()) {
      return {
        success: false,
        error: 'Developer name is required',
      };
    }

    // Check if another developer with same name exists
    const { data: existing } = await supabase
      .from('partner_developers')
      .select('id')
      .eq('name', developerData.name.trim())
      .neq('id', developerId)
      .single();

    if (existing) {
      return {
        success: false,
        error: `Another developer with name "${developerData.name}" already exists`,
      };
    }

    // Parse working_hours if it's a string (convert to JSONB)
    let workingHoursJsonb = null;
    if (developerData.working_hours) {
      if (typeof developerData.working_hours === 'string') {
        try {
          workingHoursJsonb = JSON.parse(developerData.working_hours);
        } catch {
          // If not valid JSON, store as object with the string value
          workingHoursJsonb = { text: developerData.working_hours };
        }
      } else {
        workingHoursJsonb = developerData.working_hours;
      }
    }

    // Update developer
    const { data: updatedDeveloper, error: updateError } = await supabase
      .from('partner_developers')
      .update({
        name: developerData.name.trim(),
        email: developerData.email?.trim() || null,
        office_address: developerData.office_address?.trim() || null,
        website: developerData.website?.trim() || null,
        logo_url: developerData.logo_url?.trim() || null,
        description: developerData.description?.trim() || null,
        working_hours: workingHoursJsonb,
        source_id: developerData.source_id || null,
      })
      .eq('id', developerId)
      .select()
      .single();

    if (updateError) {
      return {
        success: false,
        error: `Failed to update developer: ${updateError.message}`,
      };
    }

    return {
      success: true,
      developer: updatedDeveloper,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
};

/**
 * Delete a developer (optional - use with caution)
 */
export const deleteDeveloper = async (
  supabase: SupabaseClient,
  developerId: number
): Promise<DeveloperManagementResult> => {
  try {
    // Check if any properties are using this developer
    const { data: properties } = await supabase
      .from('properties')
      .select('id')
      .eq('developer_id', developerId)
      .limit(1);

    if (properties && properties.length > 0) {
      return {
        success: false,
        error: 'Cannot delete developer: properties are associated with this developer',
      };
    }

    const { error: deleteError } = await supabase
      .from('partner_developers')
      .delete()
      .eq('id', developerId);

    if (deleteError) {
      return {
        success: false,
        error: `Failed to delete developer: ${deleteError.message}`,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
};

