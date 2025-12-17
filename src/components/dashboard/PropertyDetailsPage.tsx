import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// Use base client since PropertyDetailsPage is already protected by DashboardAuth
// The authenticatedSupabase proxy causes "Session expired" errors unnecessarily
import { supabase as baseClient } from '../../lib/supabaseAuth';
import { PropertyDetails } from '../../types/database.types';
import FileUpload from '../property-entry/FileUpload';
import { deleteFromR2 } from '../../utils/r2Upload';

const PropertyDetailsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<PropertyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [facilitySearchTerm, setFacilitySearchTerm] = useState<string>('');
  const [facilitySearchResults, setFacilitySearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (slug) {
      fetchPropertyDetails(slug);
    }
  }, [slug]);

  const fetchPropertyDetails = async (identifier: string) => {
    try {
      setLoading(true);
      setError(null);

      // Check if identifier is numeric (id) or string (slug)
      const isNumeric = !isNaN(Number(identifier)) && identifier.trim() !== '';
      
      let property = null;
      
      if (isNumeric) {
        // If numeric, query by ID
        const { data, error } = await baseClient
          .from('properties')
          .select('*')
          .eq('id', Number(identifier))
          .maybeSingle();
        
        if (data && !error) {
          property = data;
        }
      } else {
        // If not numeric, try slug first
        const { data: slugData, error: slugError } = await baseClient
          .from('properties')
          .select('*')
          .eq('slug', identifier)
          .maybeSingle();
        
        if (slugData && !slugError) {
          property = slugData;
        } else {
          // Fallback: try as ID in case it's a numeric string or slug doesn't exist
          const idValue = Number(identifier);
          if (!isNaN(idValue) && idValue.toString() === identifier.trim()) {
            const { data: idData, error: idError } = await baseClient
              .from('properties')
              .select('*')
              .eq('id', idValue)
              .maybeSingle();
            
            if (idData && !idError) {
              property = idData;
            }
          }
        }
      }

      if (!property) {
        console.error('Property not found for identifier:', identifier);
        throw new Error(`Property not found: ${identifier}`);
      }

      // Map old column names to new names for consistency
      // After migration runs, these will be the same
      if (property.min_price_aed !== undefined && property.min_price === undefined) {
        property.min_price = property.min_price_aed;
      }
      if (property.max_price_aed !== undefined && property.max_price === undefined) {
        property.max_price = property.max_price_aed;
      }

      // Fetch all related data in parallel
      const [
        { data: developer },
        { data: images },
        { data: unitBlocks },
        { data: buildings },
        { data: propertyFacilities },
        { data: mapPoints },
        { data: paymentPlans },
      ] = await Promise.all([
        // Developer
        property.developer_id
          ? baseClient.from('partner_developers').select('*').eq('id', property.developer_id).single()
          : Promise.resolve({ data: null }),
        
        // Images
        baseClient.from('property_images').select('*').eq('property_id', property.id).order('category'),
        
        // Unit blocks
        baseClient.from('property_unit_blocks').select('*').eq('property_id', property.id),
        
        // Buildings
        baseClient.from('property_buildings').select('*').eq('property_id', property.id),
        
        // Facilities
        baseClient
          .from('property_facilities')
          .select('*, facilities(*)')
          .eq('property_id', property.id),
        
        // Map points
        baseClient.from('property_map_points').select('*').eq('property_id', property.id),
        
        // Payment plans
        baseClient.from('property_payment_plans').select('*').eq('property_id', property.id),
      ]);

      // Payment plans use payments jsonb field, not a separate values table
      const paymentPlansWithValues = (paymentPlans || []).map((plan: any) => {
        // Parse payments jsonb if it exists
        let values: any[] = [];
        if (plan.payments) {
          try {
            const payments = typeof plan.payments === 'string' ? JSON.parse(plan.payments) : plan.payments;
            if (Array.isArray(payments)) {
              values = payments.map((p: any, index: number) => ({
                id: index,
                sequence: index + 1,
                name: p.description || p.name || p.value_raw || '',
                value_raw: p.value_raw || p.description || p.name || '',
              }));
            }
          } catch (e) {
            console.error('Error parsing payments:', e);
          }
        }
        return { ...plan, values };
      });

      // Transform facilities data
      // Note: property_facilities table uses composite primary key (property_id, facility_id), not an id column
      const facilitiesData = (propertyFacilities || [])
        .filter((pf: any) => {
          if (!pf || !pf.property_id || !pf.facility_id) {
            console.warn('Skipping property_facility record with missing property_id or facility_id:', pf);
            return false;
          }
          return true;
        })
        .map((pf: any) => ({
          ...pf.facilities,
          propertyFacility: {
            // Use composite key identifier (property_id, facility_id) since there's no id column
            compositeKey: `${pf.property_id}_${pf.facility_id}`,
            property_id: pf.property_id,
            facility_id: pf.facility_id,
            image_url: pf.image_url,
            image_source: pf.image_source,
          },
        }));

      setDetails({
        property,
        developer: developer || null,
        images: images || [],
        unitBlocks: unitBlocks || [],
        buildings: buildings || [],
        facilities: facilitiesData,
        mapPoints: mapPoints || [],
        paymentPlans: paymentPlansWithValues,
      });

      // Set cover image as selected (if available), otherwise first image
      if (images && images.length > 0) {
        const coverImage = images.find((img: any) => img.category === 'cover');
        setSelectedImage(coverImage ? coverImage.image_url : images[0].image_url);
      } else if (property.cover_url) {
        setSelectedImage(property.cover_url);
      } else {
        setSelectedImage(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load property details');
      console.error('Error fetching property details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number | null, currency: string = 'AED') => {
    if (!price) return 'N/A';
    return `${price.toLocaleString()} ${currency}`;
  };

  const toggleEdit = (sectionId: string, initialValues: any = {}) => {
    if (editingSections.has(sectionId)) {
      // Cancel editing
      setEditingSections(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
      const newEditValues = { ...editValues };
      delete newEditValues[sectionId];
      setEditValues(newEditValues);
    } else {
      // Start editing
      setEditingSections(prev => new Set(prev).add(sectionId));
      setEditValues(prev => ({ ...prev, [sectionId]: { ...initialValues } }));
    }
  };

  const updateEditValue = (sectionId: string, field: string, value: any) => {
    setEditValues(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [field]: value,
      },
    }));
  };

  const saveSection = async (sectionId: string, updateFn: () => Promise<void>) => {
    setSaving(sectionId);
    try {
      await updateFn();
      setEditingSections(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
      const newEditValues = { ...editValues };
      delete newEditValues[sectionId];
      setEditValues(newEditValues);
    } catch (err: any) {
      console.error(`Error saving ${sectionId}:`, err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteProperty = async () => {
    if (!details?.property) return;
    
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete "${details.property.name}"?\n\nThis will permanently delete:\n- All property data\n- All images and media files\n- All related records (units, buildings, facilities, etc.)\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;

    setDeleting(true);
    try {
      const property = details.property;
      const filesToDelete: string[] = [];

      // Collect all file URLs that need to be deleted from R2
      
      // 1. Property images
      if (details.images && details.images.length > 0) {
        details.images.forEach((img: any) => {
          if (img.image_url && img.image_url.startsWith('http')) {
            filesToDelete.push(img.image_url);
          }
        });
      }

      // 2. Cover URL
      if (property.cover_url && property.cover_url.startsWith('http')) {
        filesToDelete.push(property.cover_url);
      }

      // 3. Video URL
      if (property.video_url && property.video_url.startsWith('http')) {
        filesToDelete.push(property.video_url);
      }

      // 4. Brochure URL
      if (property.brochure_url && property.brochure_url.startsWith('http')) {
        filesToDelete.push(property.brochure_url);
      }

      // 5. Layouts PDF
      if (property.layouts_pdf && property.layouts_pdf.startsWith('http')) {
        filesToDelete.push(property.layouts_pdf);
      }

      // 6. Unit type images
      if (details.unitBlocks && details.unitBlocks.length > 0) {
        details.unitBlocks.forEach((unit: any) => {
          const unitImageUrl = unit.typical_unit_image_url || unit.typical_image_url;
          if (unitImageUrl && unitImageUrl.startsWith('http')) {
            filesToDelete.push(unitImageUrl);
          }
        });
      }

      // 7. Building images
      if (details.buildings && details.buildings.length > 0) {
        details.buildings.forEach((building: any) => {
          if (building.image_url && building.image_url.startsWith('http')) {
            filesToDelete.push(building.image_url);
          }
        });
      }

      // 8. Facility images
      if (details.facilities && details.facilities.length > 0) {
        details.facilities.forEach((facility: any) => {
          const facilityImageUrl = facility.propertyFacility?.image_url || facility.image_url;
          if (facilityImageUrl && facilityImageUrl.startsWith('http')) {
            filesToDelete.push(facilityImageUrl);
          }
        });
      }

      // Delete all files from R2
      console.log(`Deleting ${filesToDelete.length} files from R2...`);
      const deletePromises = filesToDelete.map(url => deleteFromR2(url));
      await Promise.allSettled(deletePromises); // Use allSettled to continue even if some deletions fail

      // Delete the property (CASCADE will delete all related records)
      const { error: deleteError } = await baseClient
        .from('properties')
        .delete()
        .eq('id', property.id);

      if (deleteError) {
        throw new Error(`Failed to delete property: ${deleteError.message}`);
      }

      // Navigate back to properties list
      navigate('/properties');
    } catch (err: any) {
      console.error('Error deleting property:', err);
      alert(`Failed to delete property: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const SectionHeader: React.FC<{
    title: string;
    sectionId: string;
    onEdit: () => void;
    onSave: () => Promise<void>;
    onAddItem?: () => void;
    addLabel?: string;
  }> = ({ title, sectionId, onEdit, onSave, onAddItem, addLabel }) => {
    const isEditing = editingSections.has(sectionId);
    const isSaving = saving === sectionId;

    const handleCancel = () => {
      setEditingSections(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
      setEditValues(prev => {
        const newEditValues = { ...prev };
        delete newEditValues[sectionId];
        return newEditValues;
      });
    };

    return (
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-black dark:text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                title="Cancel changes"
              >
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={() => saveSection(sectionId, onSave)}
                disabled={isSaving}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                title="Save changes"
              >
                {isSaving ? (
                  <svg className="w-4 h-4 animate-spin text-gray-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {onAddItem && (
                <button
                  onClick={onAddItem}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                  title={addLabel || `Add ${title}`}
                >
                  + {addLabel || 'Add'}
                </button>
              )}
              <button
                onClick={onEdit}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
                title="Edit section"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-black text-black dark:text-white">
        <p className="text-lg mb-4">{error || 'Property not found'}</p>
        <Link to="/properties" className="text-sm text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white">
          ← Back to Properties
        </Link>
      </div>
    );
  }

  const { property, developer, images, unitBlocks, buildings, facilities, mapPoints, paymentPlans } = details;

  // Determine which images to display - use property_images if available, otherwise use cover_url
  // Note: property_images table uses composite primary key (property_id, image_url), not an id column
  // Sort images: cover first, then additional images
  const displayImages = images && images.length > 0 
    ? images
        .map((img: any) => ({ ...img, _key: `${img.property_id}-${img.image_url}` }))
        .sort((a: any, b: any) => {
          // Cover images first, then additional
          if (a.category === 'cover' && b.category !== 'cover') return -1;
          if (a.category !== 'cover' && b.category === 'cover') return 1;
          return 0;
        })
    : (property.cover_url ? [{ _key: 'fallback-cover', property_id: property.id, image_url: property.cover_url, category: 'cover' }] : []);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-zinc-900 sticky top-0 bg-white dark:bg-black z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/properties" className="text-sm text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Properties
          </Link>
          <div className="flex gap-2">
            <button 
              onClick={handleDeleteProperty}
              disabled={deleting || !details?.property}
              className="px-3 py-1.5 bg-red-600 dark:bg-red-700 text-white rounded text-xs hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Images Gallery - Hero Section */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Property Images"
              sectionId="images"
              onEdit={() => {
                const coverImage = images.find((img: any) => img.category === 'cover') || (property.cover_url ? { image_url: property.cover_url } : null);
                const additionalImages = images.filter((img: any) => img.category === 'additional').map((img: any) => img.image_url);
                toggleEdit('images', {
                  coverImage: coverImage?.image_url || '',
                  additionalImages: additionalImages,
                });
              }}
              onSave={async () => {
                const values = editValues['images'] || {};
                const coverImageUrl = values.coverImage || '';
                const additionalImageUrls = Array.isArray(values.additionalImages) ? values.additionalImages : [];

                // Handle cover image update
                const oldCoverImage = images.find((img: any) => img.category === 'cover');
                const oldCoverUrl = oldCoverImage?.image_url || '';
                
                // Only update if changed
                if (coverImageUrl !== oldCoverUrl) {
                  // Delete old cover image from R2 if it exists and is from R2
                  if (oldCoverUrl && oldCoverUrl.trim() !== '' && oldCoverUrl.startsWith('http')) {
                    try {
                      await deleteFromR2(oldCoverUrl);
                    } catch (err) {
                      console.error('Error deleting old cover image from R2:', err);
                    }
                  }
                  
                  // Delete old from database using composite key (property_id, image_url)
                  if (oldCoverImage) {
                    const { error: deleteError } = await baseClient
                      .from('property_images')
                      .delete()
                      .eq('property_id', property.id)
                      .eq('image_url', oldCoverUrl);
                    if (deleteError) {
                      console.error('Error deleting cover image from database:', deleteError);
                      throw deleteError;
                    }
                  }
                  
                  // Insert new cover image if provided
                  if (coverImageUrl && coverImageUrl.trim() !== '') {
                    const { error: insertError } = await baseClient
                      .from('property_images')
                      .insert({ property_id: property.id, image_url: coverImageUrl.trim(), category: 'cover' });
                    if (insertError) {
                      console.error('Error inserting cover image to database:', insertError);
                      throw insertError;
                    }
                  }
                }

                // Handle additional images
                const currentAdditionalImages = images.filter((img: any) => img.category === 'additional');
                const currentUrls = currentAdditionalImages.map((img: any) => (img.image_url || '').trim()).filter(Boolean);
                const newUrls = additionalImageUrls.map((url: string) => (url || '').trim()).filter(Boolean);
                
                // Find images to delete (in database but not in new list)
                for (const img of currentAdditionalImages) {
                  const imgUrl = (img.image_url || '').trim();
                  if (imgUrl && !newUrls.includes(imgUrl)) {
                    // Delete from R2 if it's an R2 URL
                    if (imgUrl.startsWith('http')) {
                      try {
                        await deleteFromR2(imgUrl);
                      } catch (err) {
                        console.error('Error deleting image from R2:', err);
                      }
                    }
                    // Delete from database using composite key (property_id, image_url)
                    const { error: deleteError } = await baseClient
                      .from('property_images')
                      .delete()
                      .eq('property_id', property.id)
                      .eq('image_url', imgUrl);
                    if (deleteError) {
                      console.error('Error deleting image from database:', deleteError);
                      throw deleteError;
                    }
                  }
                }

                // Add new images (only those not already in database)
                for (const url of newUrls) {
                  if (url && !currentUrls.includes(url)) {
                    const { error: insertError } = await baseClient
                      .from('property_images')
                      .insert({ property_id: property.id, image_url: url, category: 'additional' });
                    if (insertError) {
                      console.error('Error inserting image to database:', insertError);
                    }
                  }
                }

                // Refresh data
                const refreshId = slug || property.slug || property.id.toString();
                await fetchPropertyDetails(refreshId);
              }}
            />
            {editingSections.has('images') ? (
              <div className="space-y-6">
            <div>
                  <FileUpload
                    label="Cover Image"
                    accept="image/*"
                    category="image"
                    currentUrl={editValues['images']?.coverImage || ''}
                    onUploadComplete={(url) => {
                      updateEditValue('images', 'coverImage', url);
                    }}
                  />
              </div>
              <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Additional Images
                  </label>
                  <FileUpload
                    label=""
                    accept="image/*"
                    category="image"
                    multiple={true}
                    hidePreview={true}
                    onMultipleUploadComplete={(urls) => {
                      const currentImages = editValues['images']?.additionalImages || [];
                      updateEditValue('images', 'additionalImages', [...currentImages, ...urls]);
                    }}
                  />
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {(editValues['images']?.additionalImages || []).filter((url: string) => url && url.trim() !== '').map((url: string, index: number) => (
                      <div key={`${url}-${index}`} className="relative group">
                        <img
                          src={url}
                          alt={`Additional ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-300 dark:border-zinc-800"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <button
                          onClick={() => {
                            const currentImages = editValues['images']?.additionalImages || [];
                            updateEditValue('images', 'additionalImages', currentImages.filter((u: string) => u !== url));
                          }}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
              </div>
                    ))}
                    {(editValues['images']?.additionalImages || []).filter((url: string) => url && url.trim() !== '').length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-zinc-400 col-span-4">No additional images added yet</p>
            )}
              </div>
              </div>
          </div>
            ) : (
              <>
                {displayImages.length > 0 && (
                  <>
            <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden mb-4">
              <img
                        src={selectedImage || displayImages[0]?.image_url}
                alt={property.name}
                className="w-full h-96 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            {displayImages.length > 1 && (
              <div className="grid grid-cols-6 gap-2">
                    {displayImages.slice(0, 6).map((img: any) => (
                  <button
                        key={img._key || `${img.property_id}-${img.image_url}`}
                    onClick={() => setSelectedImage(img.image_url)}
                    className={`border rounded-lg overflow-hidden h-20 ${
                      selectedImage === img.image_url 
                        ? 'border-black dark:border-white' 
                        : 'border-gray-300 dark:border-zinc-800'
                    }`}
                  >
                    <img
                      src={img.image_url}
                      alt="Property"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </button>
                ))}
                {displayImages.length > 6 && (
                  <button className="border border-gray-300 dark:border-zinc-800 rounded-lg h-20 flex items-center justify-center bg-gray-50 dark:bg-zinc-950 text-xs text-gray-600 dark:text-zinc-400">
                    +{displayImages.length - 6} more
                  </button>
                )}
              </div>
                    )}
                  </>
                )}
                {displayImages.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400">No images available</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Property Header - Basic Info */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-medium text-black dark:text-white">{property.name}</h1>
                {property.external_id && (
                  <span className="text-xs text-gray-500 dark:text-zinc-500 font-mono">
                    ({property.external_id})
                  </span>
                )}
            </div>
              <p className="text-sm text-gray-600 dark:text-zinc-400">{property.area}{property.city ? `, ${property.city}` : ''}{property.country ? `, ${property.country}` : ''}</p>
            </div>
            <span className="px-3 py-1 text-xs border border-gray-300 dark:border-zinc-800 rounded text-gray-600 dark:text-zinc-400">
              {property.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm items-center">
            {editingSections.has('header_pricing') ? (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-zinc-500">Min Price ({property.price_currency || 'AED'}):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValues['header_pricing']?.min_price ?? property.min_price ?? ''}
                    onChange={(e) => updateEditValue('header_pricing', 'min_price', e.target.value ? Number(e.target.value) : null)}
                    className="w-32 p-1.5 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-zinc-500">Max Price ({property.price_currency || 'AED'}):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValues['header_pricing']?.max_price ?? property.max_price ?? ''}
                    onChange={(e) => updateEditValue('header_pricing', 'max_price', e.target.value ? Number(e.target.value) : null)}
                    className="w-32 p-1.5 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                  />
                </div>
                <button
                  onClick={() => saveSection('header_pricing', async () => {
                    const values = editValues['header_pricing'] || {};
                    const updates: any = {};
                    // Use new column names (min_price, max_price)
                    if (values.min_price !== undefined) updates.min_price = values.min_price ? Number(values.min_price) : null;
                    if (values.max_price !== undefined) updates.max_price = values.max_price ? Number(values.max_price) : null;
                    
                    const { error } = await baseClient
                      .from('properties')
                      .update(updates)
                      .eq('id', property.id);
                    if (error) throw error;
                    await fetchPropertyDetails(slug || property.id.toString());
                  })}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
                  title="Save"
                >
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setEditingSections(prev => {
                      const next = new Set(prev);
                      next.delete('header_pricing');
                      return next;
                    });
                    setEditValues(prev => {
                      const newEditValues = { ...prev };
                      delete newEditValues['header_pricing'];
                      return newEditValues;
                    });
                  }}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
                  title="Cancel"
                >
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                {property.min_price && (
              <div>
                    <span className="text-gray-600 dark:text-zinc-500">From </span>
                    <span className="text-black dark:text-white font-medium">{formatPrice(property.min_price, property.price_currency)}</span>
              </div>
            )}
                {property.max_price && (
                  <div>
                    <span className="text-gray-600 dark:text-zinc-500">To </span>
                    <span className="text-black dark:text-white font-medium">{formatPrice(property.max_price, property.price_currency)}</span>
                  </div>
                )}
                <button
                  onClick={() => toggleEdit('header_pricing', {
                    min_price: property.min_price,
                    max_price: property.max_price,
                  })}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
                  title="Edit prices"
                >
                  <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </>
            )}
            {developer && (
              <div>
                <span className="text-gray-600 dark:text-zinc-500">Developer: </span>
                <span className="text-black dark:text-white">{developer.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        {(
        <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6 overflow-hidden">
            <SectionHeader
              title="Overview"
              sectionId="overview"
              onEdit={() => toggleEdit('overview', { overview: property.overview || '' })}
              onSave={async () => {
                const values = editValues['overview'] || {};
                const { error } = await baseClient
                  .from('properties')
                  .update({ overview: values.overview || null })
                  .eq('id', property.id);
                if (error) throw error;
                setDetails(prev => prev ? { ...prev, property: { ...prev.property, overview: values.overview || null } } : null);
              }}
            />
            {editingSections.has('overview') ? (
              <textarea
                value={editValues['overview']?.overview || ''}
                onChange={(e) => updateEditValue('overview', 'overview', e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-black text-black dark:text-white text-sm min-h-[200px]"
                placeholder="Enter property overview..."
              />
            ) : property.overview ? (
              <div 
                className="text-sm text-gray-700 dark:text-zinc-400 leading-relaxed prose prose-sm max-w-none dark:prose-invert
                  prose-headings:text-black dark:prose-headings:text-white prose-headings:font-medium prose-headings:text-sm
                  prose-p:text-gray-700 dark:prose-p:text-zinc-400 prose-p:leading-relaxed prose-p:break-words
                  prose-ul:text-gray-700 dark:prose-ul:text-zinc-400 prose-ul:list-disc prose-ul:ml-4
                  prose-li:text-gray-700 dark:prose-li:text-zinc-400 prose-li:marker:text-gray-500 dark:prose-li:marker:text-zinc-600
                  prose-strong:text-black dark:prose-strong:text-white prose-strong:font-medium
                  break-words overflow-wrap-anywhere word-wrap break-all"
                dangerouslySetInnerHTML={{ 
                  __html: property.overview
                    .replace(/#{5}\s+(.*?)(\n|$)/g, '<h5 class="font-medium text-white mt-4 mb-2">$1</h5>')
                    .replace(/#{4}\s+(.*?)(\n|$)/g, '<h4 class="font-medium text-white mt-4 mb-2">$1</h4>')
                    .replace(/#{3}\s+(.*?)(\n|$)/g, '<h3 class="font-medium text-white mt-4 mb-2">$1</h3>')
                    .replace(/#{2}\s+(.*?)(\n|$)/g, '<h2 class="font-medium text-white mt-4 mb-2">$1</h2>')
                    .replace(/#{1}\s+(.*?)(\n|$)/g, '<h1 class="font-medium text-white mt-4 mb-2">$1</h1>')
                    .replace(/\\\*/g, '•')
                    .replace(/\n\n/g, '</p><p class="mt-3 break-words">')
                    .replace(/\n/g, '<br/>')
                    .replace(/^/, '<p class="break-words">')
                    .replace(/$/, '</p>')
                }}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-zinc-400">N/A - No overview added yet</p>
            )}
          </div>
        )}

        {/* Key Highlights / Quick Facts */}
        {(
        <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Key Highlights"
              sectionId="highlights"
              onEdit={() => toggleEdit('highlights', {
                status: property.status || '',
                sale_status: property.sale_status || '',
                service_charge: property.service_charge || '',
                furnishing: property.furnishing || '',
              })}
              onSave={async () => {
                const values = editValues['highlights'] || {};
                const updates: any = {};
                if (values.status !== undefined) updates.status = values.status;
                if (values.sale_status !== undefined) updates.sale_status = values.sale_status || null;
                if (values.service_charge !== undefined) updates.service_charge = values.service_charge || null;
                if (values.furnishing !== undefined) updates.furnishing = values.furnishing || null;
                
                const { error } = await baseClient
                  .from('properties')
                  .update(updates)
                  .eq('id', property.id);
                if (error) throw error;
                setDetails(prev => prev ? { ...prev, property: { ...prev.property, ...updates } } : null);
              }}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {editingSections.has('highlights') ? (
                <>
            <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Project Status</label>
                    <input
                      type="text"
                      value={editValues['highlights']?.status || ''}
                      onChange={(e) => updateEditValue('highlights', 'status', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
            </div>
              <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Sale Status</label>
                    <input
                      type="text"
                      value={editValues['highlights']?.sale_status || ''}
                      onChange={(e) => updateEditValue('highlights', 'sale_status', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Service Charge</label>
                    <input
                      type="text"
                      value={editValues['highlights']?.service_charge || ''}
                      onChange={(e) => updateEditValue('highlights', 'service_charge', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Furnishing</label>
                    <input
                      type="text"
                      value={editValues['highlights']?.furnishing || ''}
                      onChange={(e) => updateEditValue('highlights', 'furnishing', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Project Status</p>
                    <p className="text-black dark:text-white font-medium">{property.status || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Sale Status</p>
                    <p className="text-black dark:text-white font-medium">{property.sale_status || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Service Charge</p>
                    <p className="text-black dark:text-white font-medium">{property.service_charge || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Furnishing</p>
                    <p className="text-black dark:text-white font-medium">{property.furnishing || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pricing Details */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Pricing Details"
              sectionId="pricing"
              onEdit={() => toggleEdit('pricing', {
                min_price: property.min_price,
                max_price: property.max_price,
                min_area: property.min_area,
                max_area: property.max_area,
                price_currency: property.price_currency || 'AED',
                area_unit: property.area_unit || 'sqft',
              })}
              onSave={async () => {
                const values = editValues['pricing'] || {};
                const updates: any = {};
                // Use new column names (min_price, max_price)
                if (values.min_price !== undefined) updates.min_price = values.min_price ? Number(values.min_price) : null;
                if (values.max_price !== undefined) updates.max_price = values.max_price ? Number(values.max_price) : null;
                if (values.price_currency !== undefined) updates.price_currency = values.price_currency;
                if (values.min_area !== undefined) updates.min_area = values.min_area ? Number(values.min_area) : null;
                if (values.max_area !== undefined) updates.max_area = values.max_area ? Number(values.max_area) : null;
                if (values.area_unit !== undefined) updates.area_unit = values.area_unit;
                
                const { error } = await baseClient
                  .from('properties')
                  .update(updates)
                  .eq('id', property.id);
                if (error) throw error;
                setDetails(prev => prev ? { ...prev, property: { ...prev.property, ...updates } } : null);
              }}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {editingSections.has('pricing') ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Min Price ({property.price_currency || 'AED'})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editValues['pricing']?.min_price ?? property.min_price ?? ''}
                      onChange={(e) => updateEditValue('pricing', 'min_price', e.target.value ? Number(e.target.value) : null)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Max Price ({property.price_currency || 'AED'})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editValues['pricing']?.max_price ?? property.max_price ?? ''}
                      onChange={(e) => updateEditValue('pricing', 'max_price', e.target.value ? Number(e.target.value) : null)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Min Area</label>
                    <input
                      type="number"
                      value={editValues['pricing']?.min_area ?? ''}
                      onChange={(e) => updateEditValue('pricing', 'min_area', e.target.value ? Number(e.target.value) : null)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Max Area</label>
                    <input
                      type="number"
                      value={editValues['pricing']?.max_area ?? ''}
                      onChange={(e) => updateEditValue('pricing', 'max_area', e.target.value ? Number(e.target.value) : null)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Currency</label>
                    <select
                      value={editValues['pricing']?.price_currency || 'AED'}
                      onChange={(e) => updateEditValue('pricing', 'price_currency', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    >
                      <option value="AED">AED</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="INR">INR</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Area Unit</label>
                    <select
                      value={editValues['pricing']?.area_unit || 'sqft'}
                      onChange={(e) => updateEditValue('pricing', 'area_unit', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    >
                      <option value="sqft">sqft</option>
                      <option value="m²">m²</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Min Price</p>
                    <p className="text-black dark:text-white font-medium">{property.min_price ? formatPrice(property.min_price, property.price_currency) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Max Price</p>
                    <p className="text-black dark:text-white font-medium">{property.max_price ? formatPrice(property.max_price, property.price_currency) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Area Range</p>
                    <p className="text-black dark:text-white font-medium">
                      {property.min_area && property.max_area 
                        ? `${property.min_area} - ${property.max_area} ${property.area_unit || 'sqft'}`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Currency</p>
                    <p className="text-black dark:text-white font-medium">{property.price_currency || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Project Status & Timeline */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Project Status & Timeline"
              sectionId="status_timeline"
              onEdit={() => toggleEdit('status_timeline', {
                permit_id: (property as any).permit_id || '',
                completion_datetime: property.completion_datetime || '',
                readiness: property.readiness,
              })}
              onSave={async () => {
                const values = editValues['status_timeline'] || {};
                const updates: any = {};
                if (values.permit_id !== undefined) updates.permit_id = values.permit_id || null;
                if (values.completion_datetime !== undefined) updates.completion_datetime = values.completion_datetime || null;
                if (values.readiness !== undefined) updates.readiness = values.readiness !== null && values.readiness !== '' ? Number(values.readiness) : null;
                
                const { error } = await baseClient
                  .from('properties')
                  .update(updates)
                  .eq('id', property.id);
                if (error) throw error;
                setDetails(prev => prev ? { ...prev, property: { ...prev.property, ...updates } } : null);
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {editingSections.has('status_timeline') ? (
                <>
                <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">RERA Number / Permit ID</label>
                    <input
                      type="text"
                      value={editValues['status_timeline']?.permit_id || ''}
                      onChange={(e) => updateEditValue('status_timeline', 'permit_id', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm font-mono"
                    />
                </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Expected Completion</label>
                    <input
                      type="date"
                      value={editValues['status_timeline']?.completion_datetime ? new Date(editValues['status_timeline'].completion_datetime).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateEditValue('status_timeline', 'completion_datetime', e.target.value ? new Date(e.target.value).toISOString() : '')}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Construction Readiness (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editValues['status_timeline']?.readiness ?? ''}
                      onChange={(e) => updateEditValue('status_timeline', 'readiness', e.target.value ? Number(e.target.value) : null)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">RERA Number / Permit ID</p>
                <p className="text-black dark:text-white font-mono">{(property as any).permit_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Expected Completion</p>
                <p className="text-black dark:text-white">{property.completion_datetime ? new Date(property.completion_datetime).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Construction Readiness</p>
                <p className="text-black dark:text-white">{property.readiness !== null ? `${property.readiness}%` : 'N/A'}</p>
              </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Buyer Protection */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Buyer Protection"
              sectionId="protection"
              onEdit={() => toggleEdit('protection', {
                has_escrow: property.has_escrow || false,
                post_handover: property.post_handover || false,
              })}
              onSave={async () => {
                const values = editValues['protection'] || {};
                const { error } = await baseClient
                  .from('properties')
                  .update({
                    has_escrow: values.has_escrow || false,
                    post_handover: values.post_handover || false,
                  })
                  .eq('id', property.id);
                if (error) throw error;
                setDetails(prev => prev ? { ...prev, property: { ...prev.property, has_escrow: values.has_escrow || false, post_handover: values.post_handover || false } } : null);
              }}
            />
            {editingSections.has('protection') ? (
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editValues['protection']?.has_escrow || false}
                    onChange={(e) => updateEditValue('protection', 'has_escrow', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-black dark:text-white">Escrow Protection</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editValues['protection']?.post_handover || false}
                    onChange={(e) => updateEditValue('protection', 'post_handover', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-black dark:text-white">Post Handover Payment</span>
                </label>
              </div>
            ) : (
            <div className="flex flex-wrap gap-4">
              {property.has_escrow && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-black dark:text-white">Escrow Protection</span>
                </div>
              )}
              {property.post_handover && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-black dark:text-white">Post Handover Payment</span>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Parking Specifications */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Parking Specifications"
              sectionId="parking"
              onEdit={() => toggleEdit('parking', {
                parking: (property as any).parking || '',
              })}
              onSave={async () => {
                const values = editValues['parking'] || {};
                const { error } = await baseClient
                  .from('properties')
                  .update({ parking: values.parking || null })
                  .eq('id', property.id);
                if (error) throw error;
                setDetails(prev => prev ? { ...prev, property: { ...prev.property, parking: values.parking || null } } : null);
              }}
            />
            {editingSections.has('parking') ? (
              <textarea
                value={editValues['parking']?.parking || ''}
                onChange={(e) => updateEditValue('parking', 'parking', e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-black text-black dark:text-white text-sm min-h-[100px]"
                placeholder="Enter parking specifications..."
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-line">{(property as any).parking || 'N/A - No parking specifications added yet'}</p>
            )}
          </div>
        )}

        {/* Media & Documents */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Media & Documents"
              sectionId="media"
              onEdit={() => toggleEdit('media', {
                video_url: property.video_url || '',
                brochure_url: property.brochure_url || '',
                layouts_pdf: property.layouts_pdf || '',
              })}
              onSave={async () => {
                const values = editValues['media'] || {};
                const updates: any = {};
                if (values.video_url !== undefined) updates.video_url = values.video_url || null;
                if (values.brochure_url !== undefined) updates.brochure_url = values.brochure_url || null;
                if (values.layouts_pdf !== undefined) updates.layouts_pdf = values.layouts_pdf || null;
                
                const { error } = await baseClient
                  .from('properties')
                  .update(updates)
                  .eq('id', property.id);
                if (error) throw error;
                setDetails(prev => prev ? { ...prev, property: { ...prev.property, ...updates } } : null);
              }}
            />
            {editingSections.has('media') ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Video URL</label>
                  <input
                    type="url"
                    value={editValues['media']?.video_url || ''}
                    onChange={(e) => updateEditValue('media', 'video_url', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Brochure URL</label>
                  <input
                    type="url"
                    value={editValues['media']?.brochure_url || ''}
                    onChange={(e) => updateEditValue('media', 'brochure_url', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Floor Plans PDF URL</label>
                  <input
                    type="url"
                    value={editValues['media']?.layouts_pdf || ''}
                    onChange={(e) => updateEditValue('media', 'layouts_pdf', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                  />
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {property.video_url ? (
                <div className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                    <span className="text-sm font-medium text-black dark:text-white">Property Video</span>
                  </div>
                  <a
                    href={property.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    Watch Video
                  </a>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">N/A - No video</p>
                </div>
              )}
              {property.brochure_url ? (
                <div className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-black dark:text-white">Brochure PDF</span>
                  </div>
                  <a
                    href={property.brochure_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    Download Brochure
                  </a>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">N/A - No brochure</p>
                </div>
              )}
              {property.layouts_pdf ? (
                <div className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-black dark:text-white">Floor Plans PDF</span>
                  </div>
                  <a
                    href={property.layouts_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    Download Floor Plans
                  </a>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">N/A - No floor plans</p>
                </div>
              )}
            </div>
        )}
          </div>
        )}

        {/* Unit Types */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Unit Types"
              sectionId="unit_types"
              onEdit={() => toggleEdit('unit_types', {
                units: unitBlocks.map((unit: any) => ({
                  id: unit.id,
                  unit_bedrooms: unit.unit_bedrooms || '',
                  units_area_from: unit.units_area_from || '',
                  units_area_to: unit.units_area_to || '',
                  units_area_from_m2: unit.units_area_from_m2 || '',
                  units_area_to_m2: unit.units_area_to_m2 || '',
                  units_price_from: unit.units_price_from || '',
                  units_price_to: unit.units_price_to || '',
                  units_amount: unit.units_amount || '',
                  unit_type: unit.unit_type || '',
                  image_url: unit.typical_unit_image_url || unit.typical_image_url || '',
                })),
              })}
              onSave={async () => {
                const values = editValues['unit_types'] || {};
                const unitUpdates = values.units || [];
                
                for (const unitUpdate of unitUpdates) {
                  if (unitUpdate._isNew) {
                    // Insert new unit
                    if (unitUpdate.unit_bedrooms && unitUpdate.unit_bedrooms.trim() !== '') {
                      const updates: any = {
                        property_id: property.id,
                        unit_bedrooms: unitUpdate.unit_bedrooms,
                        typical_unit_image_url: unitUpdate.image_url || null,
                        typical_image_url: unitUpdate.image_url || null,
                      };
                      if (unitUpdate.units_area_from !== undefined && unitUpdate.units_area_from !== null) updates.units_area_from = unitUpdate.units_area_from;
                      if (unitUpdate.units_area_to !== undefined && unitUpdate.units_area_to !== null) updates.units_area_to = unitUpdate.units_area_to;
                      if (unitUpdate.units_price_from !== undefined && unitUpdate.units_price_from !== null) updates.units_price_from = unitUpdate.units_price_from;
                      if (unitUpdate.units_price_to !== undefined && unitUpdate.units_price_to !== null) updates.units_price_to = unitUpdate.units_price_to;
                      if (unitUpdate.units_amount !== undefined && unitUpdate.units_amount !== null) updates.units_amount = unitUpdate.units_amount;
                      if (unitUpdate.unit_type !== undefined && unitUpdate.unit_type !== null && unitUpdate.unit_type.trim() !== '') updates.unit_type = unitUpdate.unit_type;
                      
                      await baseClient
                        .from('property_unit_blocks')
                        .insert(updates);
                    }
                  } else {
                    // Update existing unit
                    const unit = unitBlocks.find((u: any) => u.id === unitUpdate.id);
                    if (!unit) continue;
                    
                    const oldImageUrl = ((unit as any).typical_unit_image_url || (unit as any).typical_image_url || '').trim();
                    const newImageUrl = (unitUpdate.image_url || '').trim();
                    
                    const updates: any = {};
                    if (unitUpdate.unit_bedrooms !== undefined) updates.unit_bedrooms = unitUpdate.unit_bedrooms;
                    if (unitUpdate.units_area_from !== undefined) updates.units_area_from = unitUpdate.units_area_from || null;
                    if (unitUpdate.units_area_to !== undefined) updates.units_area_to = unitUpdate.units_area_to || null;
                    if (unitUpdate.units_price_from !== undefined) updates.units_price_from = unitUpdate.units_price_from || null;
                    if (unitUpdate.units_price_to !== undefined) updates.units_price_to = unitUpdate.units_price_to || null;
                    if (unitUpdate.units_amount !== undefined) updates.units_amount = unitUpdate.units_amount || null;
                    if (unitUpdate.unit_type !== undefined) updates.unit_type = unitUpdate.unit_type || null;
                    
                    if (oldImageUrl !== newImageUrl) {
                      // Delete old image from R2 if it's an R2 URL
                      if (oldImageUrl && oldImageUrl.startsWith('http')) {
                        try {
                          await deleteFromR2(oldImageUrl);
                        } catch (err) {
                          console.error('Error deleting unit image from R2:', err);
                        }
                      }
                      updates.typical_unit_image_url = newImageUrl || null;
                      updates.typical_image_url = newImageUrl || null;
                    }
                    
                    if (Object.keys(updates).length > 0) {
                      await baseClient
                        .from('property_unit_blocks')
                        .update(updates)
                        .eq('id', unit.id);
                    }
                  }
                }
                
                const refreshId = slug || property.slug || property.id.toString();
                await fetchPropertyDetails(refreshId);
              }}
            />
            {unitBlocks.length === 0 && !editingSections.has('unit_types') ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-zinc-400">N/A - No unit types added yet</p>
              </div>
            ) : (
              <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(editingSections.has('unit_types') ? editValues['unit_types']?.units || [] : unitBlocks).map((unit: any, index: number) => {
                    const isEditing = editingSections.has('unit_types');
                    const isNew = unit._isNew;
                    const unitImageUrl = unit.typical_unit_image_url || unit.typical_image_url;
                    const editUnitData = editValues['unit_types']?.units?.find((u: any) => u.id === unit.id);
                    const displayImageUrl = isEditing && editUnitData ? editUnitData.image_url : unitImageUrl;
                    
                    return (
                      <div key={unit.id || `new-${index}`} className="border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
                        {isEditing ? (
                          <div className="p-4 space-y-3">
                            <div>
                              <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Unit Type</label>
                              <input
                                type="text"
                                value={editUnitData?.unit_bedrooms ?? unit.unit_bedrooms ?? ''}
                                onChange={(e) => {
                                  const units = editValues['unit_types']?.units || [];
                                  const updatedUnit = { ...(editUnitData || unit), unit_bedrooms: e.target.value };
                                  if (isNew) {
                                    units[index] = updatedUnit;
                                  } else {
                                    const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                                    if (unitIndex >= 0) {
                                      units[unitIndex] = updatedUnit;
                                    }
                                  }
                                  updateEditValue('unit_types', 'units', units);
                                }}
                                placeholder="e.g., 1BR, 2BR"
                                className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Area From (sqft)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editUnitData?.units_area_from ?? unit.units_area_from ?? ''}
                                  onChange={(e) => {
                                    const units = editValues['unit_types']?.units || [];
                                    const updatedUnit = { ...(editUnitData || unit), units_area_from: e.target.value ? parseFloat(e.target.value) : null };
                                    if (isNew) {
                                      units[index] = updatedUnit;
                                    } else {
                                      const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                                      if (unitIndex >= 0) {
                                        units[unitIndex] = updatedUnit;
                                      }
                                    }
                                    updateEditValue('unit_types', 'units', units);
                                  }}
                                  className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Area To (sqft)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editUnitData?.units_area_to ?? unit.units_area_to ?? ''}
                                  onChange={(e) => {
                                    const units = editValues['unit_types']?.units || [];
                                    const updatedUnit = { ...(editUnitData || unit), units_area_to: e.target.value ? parseFloat(e.target.value) : null };
                                    if (isNew) {
                                      units[index] = updatedUnit;
                                    } else {
                                      const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                                      if (unitIndex >= 0) {
                                        units[unitIndex] = updatedUnit;
                                      }
                                    }
                                    updateEditValue('unit_types', 'units', units);
                                  }}
                                  className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Price From ({property.price_currency || 'AED'})</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={
                                    editUnitData?.units_price_from !== undefined && editUnitData?.units_price_from !== null
                                      ? editUnitData.units_price_from.toString()
                                      : (unit.units_price_from ? unit.units_price_from.toString() : '')
                                  }
                                  onChange={(e) => {
                                    const units = editValues['unit_types']?.units || [];
                                    const priceValue = e.target.value ? parseFloat(e.target.value) : null;
                                    const updatedUnit = { ...(editUnitData || unit), units_price_from: priceValue };
                                    if (isNew) {
                                      units[index] = updatedUnit;
                                    } else {
                                      const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                                      if (unitIndex >= 0) {
                                        units[unitIndex] = updatedUnit;
                                      }
                                    }
                                    updateEditValue('unit_types', 'units', units);
                                  }}
                                  className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Price To ({property.price_currency || 'AED'})</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={
                                    editUnitData?.units_price_to !== undefined && editUnitData?.units_price_to !== null
                                      ? editUnitData.units_price_to.toString()
                                      : (unit.units_price_to ? unit.units_price_to.toString() : '')
                                  }
                                  onChange={(e) => {
                                    const units = editValues['unit_types']?.units || [];
                                    const priceValue = e.target.value ? parseFloat(e.target.value) : null;
                                    const updatedUnit = { ...(editUnitData || unit), units_price_to: priceValue };
                                    if (isNew) {
                                      units[index] = updatedUnit;
                                    } else {
                                      const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                                      if (unitIndex >= 0) {
                                        units[unitIndex] = updatedUnit;
                                      }
                                    }
                                    updateEditValue('unit_types', 'units', units);
                                  }}
                                  className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Units Available</label>
                                <input
                                  type="number"
                                  value={editUnitData?.units_amount ?? unit.units_amount ?? ''}
                                  onChange={(e) => {
                                    const units = editValues['unit_types']?.units || [];
                                    const updatedUnit = { ...(editUnitData || unit), units_amount: e.target.value ? parseInt(e.target.value) : null };
                                    if (isNew) {
                                      units[index] = updatedUnit;
                                    } else {
                                      const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                                      if (unitIndex >= 0) {
                                        units[unitIndex] = updatedUnit;
                                      }
                                    }
                                    updateEditValue('unit_types', 'units', units);
                                  }}
                                  className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Type</label>
                                <input
                                  type="text"
                                  value={editUnitData?.unit_type ?? unit.unit_type ?? ''}
                                  onChange={(e) => {
                                    const units = editValues['unit_types']?.units || [];
                                    const updatedUnit = { ...(editUnitData || unit), unit_type: e.target.value };
                                    if (isNew) {
                                      units[index] = updatedUnit;
                                    } else {
                                      const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                                      if (unitIndex >= 0) {
                                        units[unitIndex] = updatedUnit;
                                      }
                                    }
                                    updateEditValue('unit_types', 'units', units);
                                  }}
                                  placeholder="e.g., Apartments"
                                  className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                                />
                              </div>
                            </div>
                            <FileUpload
                              label="Unit Image"
                              accept="image/*"
                              category="image"
                              currentUrl={editUnitData?.image_url || unitImageUrl || ''}
                              onUploadComplete={(url) => {
                                const units = editValues['unit_types']?.units || [];
                                if (isNew) {
                                  units[index] = { ...unit, image_url: url };
                                } else {
                                  const updatedUnits = units.map((u: any) => 
                                    u.id === unit.id ? { ...u, image_url: url } : u
                                  );
                                  updateEditValue('unit_types', 'units', updatedUnits);
                                  return;
                                }
                                updateEditValue('unit_types', 'units', units);
                              }}
                            />
                            {isNew && (
                              <button
                                onClick={() => {
                                  const units = editValues['unit_types']?.units || [];
                                  updateEditValue('unit_types', 'units', units.filter((_: any, i: number) => i !== index));
                                }}
                                className="w-full px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {displayImageUrl ? (
                              <div className="w-full h-48 bg-gray-100 dark:bg-zinc-900">
                                <img
                                  src={displayImageUrl}
                                  alt={unit.unit_bedrooms}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : null}
                            <div className="p-4">
                  <h3 className="text-sm font-medium mb-2 text-black dark:text-white">{unit.unit_bedrooms}</h3>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-zinc-400">
                                {((unit.units_area_from && unit.units_area_to) || (unit.units_area_from_m2 && unit.units_area_to_m2)) && (
                      <p>
                        Area: {
                          unit.units_area_from && unit.units_area_to
                            ? `${unit.units_area_from} - ${unit.units_area_to} ${property.area_unit || 'sqft'}`
                            : unit.units_area_from_m2 && unit.units_area_to_m2
                            ? `${unit.units_area_from_m2} - ${unit.units_area_to_m2} m²`
                            : ''
                        }
                      </p>
                    )}
                    {unit.units_price_from && (
                                  <p>Price: {formatPrice(unit.units_price_from, property.price_currency)} - {formatPrice(unit.units_price_to, property.price_currency)}</p>
                    )}
                                {unit.units_amount && <p>Units Available: {unit.units_amount}</p>}
                                {unit.unit_type && unit.unit_type !== unit.unit_bedrooms && (
                                  <p className="text-gray-500 dark:text-zinc-500">Type: {unit.unit_type}</p>
                                )}
                  </div>
                </div>
                          </>
                        )}
            </div>
                    );
                  })}
                </div>
                {editingSections.has('unit_types') && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const currentUnits = editValues['unit_types']?.units || [];
                        updateEditValue('unit_types', 'units', [
                          ...currentUnits,
                          { unit_bedrooms: '', units_area_from: null, units_area_to: null, units_price_from: null, units_price_to: null, units_amount: null, unit_type: '', image_url: '', _isNew: true },
                        ]);
                      }}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded text-sm hover:bg-blue-700 dark:hover:bg-blue-800"
                    >
                      + Add Another Unit Type
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Facilities & Amenities */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Facilities & Amenities"
              sectionId="facilities"
              onEdit={() => toggleEdit('facilities', {
                facilities: facilities.map((facility: any) => ({
                  propertyFacilityCompositeKey: facility.propertyFacility?.compositeKey,
                  propertyId: facility.propertyFacility?.property_id,
                  facilityId: facility.id,
                  name: facility.name,
                  image_url: facility.propertyFacility?.image_url || facility.image_url || '',
                })),
              })}
              onAddItem={() => {
                // Just enable editing mode - don't create empty facility card
                // User will search and select facilities, which will add them
                setEditingSections(prev => new Set(prev).add('facilities'));
                // Initialize edit values with existing facilities if not already set
                if (!editValues['facilities']) {
                  const current = facilities.map((facility: any) => ({
                    propertyFacilityCompositeKey: facility.propertyFacility?.compositeKey,
                    propertyId: facility.propertyFacility?.property_id,
                    facilityId: facility.id,
                    name: facility.name,
                    image_url: facility.propertyFacility?.image_url || facility.image_url || '',
                  }));
                  updateEditValue('facilities', 'facilities', current);
                }
              }}
              addLabel="Add Facility"
              onSave={async () => {
                const values = editValues['facilities'] || {};
                const facilityUpdates = values.facilities || [];
                const errors: string[] = [];
                
                for (const facilityUpdate of facilityUpdates) {
                  // Get facility_id - must be a valid number
                  const facilityIdStr = String(facilityUpdate.facilityId || '').trim();
                  let facilityIdNumber: number | null = null;
                  
                  if (facilityIdStr && facilityIdStr !== '' && facilityIdStr !== 'null' && facilityIdStr !== 'undefined') {
                    const parsed = Number(facilityIdStr);
                    if (!isNaN(parsed) && parsed > 0) {
                      facilityIdNumber = parsed;
                    }
                  }
                  
                  const newImageUrl = (facilityUpdate.image_url || '').trim();
                  const propertyId = facilityUpdate.propertyId || property.id;

                  // Delete facility link if flagged
                  if (facilityUpdate._remove) {
                    // If this is a new facility that hasn't been saved yet, just skip it
                    // (no need to delete from database since it was never inserted)
                    if (facilityUpdate._isNew) {
                      console.log('Skipping removal of new facility (not yet saved to database):', facilityUpdate.name || facilityUpdate.facilityId);
                      continue;
                    }

                    // Find the facility to get the image URL for deletion
                    const foundFacility = facilities.find((f: any) => 
                      Number(f.id) === facilityIdNumber ||
                      (f.propertyFacility?.facility_id && Number(f.propertyFacility.facility_id) === facilityIdNumber)
                    );
                    const oldImageUrl = (foundFacility?.propertyFacility?.image_url || '').trim();
                    
                    // Validate we have both property_id and facility_id for composite key deletion
                    if (!facilityIdNumber || !propertyId) {
                      const facilityName = foundFacility?.name || facilityUpdate.name || 'Unknown facility';
                      errors.push(`Cannot delete facility "${facilityName}": Missing property_id or facility_id.`);
                      console.error('Missing composite key for deletion:', {
                        facilityIdNumber,
                        propertyId,
                        facilityUpdate
                      });
                      continue;
                    }

                    try {
                      // Delete image from R2 if it exists
                      if (oldImageUrl && oldImageUrl.startsWith('http')) {
                        try {
                          const deleteResult = await deleteFromR2(oldImageUrl);
                          if (!deleteResult.success) {
                            console.warn(`Failed to delete facility image from R2: ${deleteResult.error}`);
                          }
                        } catch (err) {
                          console.error('Error deleting facility image from R2:', err);
                          // Don't fail the whole operation if R2 delete fails
                        }
                      }

                      // Delete from property_facilities table using composite key (property_id, facility_id)
                      const { error: deleteError } = await baseClient
                        .from('property_facilities')
                        .delete()
                        .eq('property_id', propertyId)
                        .eq('facility_id', facilityIdNumber);

                      if (deleteError) {
                        const facilityName = foundFacility?.name || facilityUpdate.name || 'Unknown facility';
                        errors.push(`Failed to delete facility "${facilityName}": ${deleteError.message}`);
                        console.error('Error deleting facility from property_facilities:', {
                          deleteError,
                          propertyId,
                          facilityId: facilityIdNumber,
                          facilityUpdate
                        });
                        throw new Error(`Failed to delete facility: ${deleteError.message}`);
                      }

                      console.log(`Successfully deleted facility "${foundFacility?.name || 'Unknown'}" with property_id=${propertyId}, facility_id=${facilityIdNumber}`);
                    } catch (err: any) {
                      const facilityName = foundFacility?.name || facilityUpdate.name || 'Unknown facility';
                      errors.push(`Error deleting facility "${facilityName}": ${err.message || 'Unknown error'}`);
                      console.error('Exception during facility deletion:', err);
                      // Continue processing other facilities instead of failing completely
                    }
                    continue; // skip further processing for removed items
                  }

                  if (facilityUpdate._isNew) {
                    // Validate facility_id - check for empty string, null, undefined, or invalid number
                    if (!facilityIdNumber) {
                      errors.push(`Cannot add facility: Invalid facility_id (empty or missing). Please select a valid facility from the search results.`);
                      console.error('Invalid facility_id for new facility (empty/missing):', facilityUpdate);
                      continue;
                    }

                    // Check if this facility is already linked to this property
                    try {
                      const { data: existingLink, error: checkError } = await baseClient
                        .from('property_facilities')
                        .select('image_url')
                        .eq('property_id', propertyId)
                        .eq('facility_id', facilityIdNumber)
                        .maybeSingle();

                      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
                        errors.push(`Error checking for existing facility link: ${checkError.message}`);
                        console.error('Error checking for existing facility link:', checkError);
                        continue;
                      }

                      if (existingLink) {
                        // Facility already exists - update it instead of inserting
                        console.log(`Facility (ID: ${facilityIdNumber}) already linked to property. Updating image_url instead.`);
                        const { error: updateError } = await baseClient
                          .from('property_facilities')
                          .update({
                            image_url: newImageUrl || null,
                          })
                          .eq('property_id', propertyId)
                          .eq('facility_id', facilityIdNumber);

                        if (updateError) {
                          errors.push(`Failed to update existing facility link (ID: ${facilityIdNumber}): ${updateError.message}`);
                          console.error('Error updating existing facility link:', updateError);
                        } else {
                          console.log(`Successfully updated existing facility link with property_id=${propertyId}, facility_id=${facilityIdNumber}`);
                        }
                        continue;
                      }

                      // Facility doesn't exist yet - insert it
                      const { error: insertError } = await baseClient
                        .from('property_facilities')
                        .insert({
                          property_id: propertyId,
                          facility_id: facilityIdNumber,
                          image_url: newImageUrl || null,
                        });

                      if (insertError) {
                        // Check if it's a duplicate key error (race condition or concurrent edit)
                        if (insertError.code === '23505' || insertError.message.includes('duplicate key') || insertError.message.includes('unique constraint')) {
                          console.warn(`Facility (ID: ${facilityIdNumber}) was added by another operation. Attempting to update instead.`);
                          // Try to update it using composite key
                          const { error: raceUpdateError } = await baseClient
                            .from('property_facilities')
                            .update({
                              image_url: newImageUrl || null,
                            })
                            .eq('property_id', propertyId)
                            .eq('facility_id', facilityIdNumber);

                          if (raceUpdateError) {
                            errors.push(`Failed to add/update facility (ID: ${facilityIdNumber}): ${raceUpdateError.message}`);
                          } else {
                            console.log(`Successfully updated facility link after race condition with property_id=${propertyId}, facility_id=${facilityIdNumber}`);
                          }
                        } else {
                          errors.push(`Failed to add facility (ID: ${facilityIdNumber}): ${insertError.message}`);
                          console.error('Error inserting facility into property_facilities:', {
                            insertError,
                            propertyId,
                            facilityId: facilityIdNumber,
                            facilityUpdate
                          });
                        }
                      } else {
                        console.log(`Successfully added facility with property_id=${propertyId}, facility_id=${facilityIdNumber}`);
                      }
                    } catch (err: any) {
                      errors.push(`Error adding facility (ID: ${facilityIdNumber}): ${err.message || 'Unknown error'}`);
                      console.error('Exception during facility insertion:', err);
                      // Continue processing other facilities
                    }
                    continue;
                  }

                  // Find facility by facility_id
                  const facility = facilities.find((f: any) => 
                    Number(f.id) === facilityIdNumber ||
                    (f.propertyFacility?.facility_id && Number(f.propertyFacility.facility_id) === facilityIdNumber)
                  );
                  
                  if (!facility) {
                    console.warn('Facility not found for update:', {
                      facilityIdNumber,
                      facilityUpdate
                    });
                    continue;
                  }

                  // Get property_id and facility_id for composite key update
                  const updatePropertyId = propertyId;
                  const updateFacilityId = facilityIdNumber || facility.propertyFacility?.facility_id || facility.id;
                  
                  if (!updatePropertyId || !updateFacilityId) {
                    errors.push(`Cannot update facility "${facility.name || 'Unknown'}": Missing property_id or facility_id.`);
                    console.error('Missing composite key for update:', {
                      updatePropertyId,
                      updateFacilityId,
                      facility
                    });
                    continue;
                  }
                  
                  const facilityAny = facility as any;
                  const oldImageUrl = (facilityAny.propertyFacility?.image_url || facilityAny.image_url || '').trim();
                  
                  if (oldImageUrl !== newImageUrl) {
                    // Delete old image from R2 if it's an R2 URL
                    if (oldImageUrl && oldImageUrl.startsWith('http')) {
                      try {
                        const deleteResult = await deleteFromR2(oldImageUrl);
                        if (!deleteResult.success) {
                          console.warn(`Failed to delete old facility image from R2: ${deleteResult.error}`);
                        }
                      } catch (err) {
                        console.error('Error deleting facility image from R2:', err);
                        // Don't fail the whole operation if R2 delete fails
                      }
                    }
                  }

                  try {
                    const { error: updateError } = await baseClient
                      .from('property_facilities')
                      .update({ 
                        image_url: newImageUrl || null,
                      })
                      .eq('property_id', updatePropertyId)
                      .eq('facility_id', updateFacilityId);

                    if (updateError) {
                      errors.push(`Failed to update facility "${facility.name || 'Unknown'}": ${updateError.message}`);
                      console.error('Error updating facility in property_facilities:', {
                        updateError,
                        propertyId: updatePropertyId,
                        facilityId: updateFacilityId,
                        facility
                      });
                      throw new Error(`Failed to update facility: ${updateError.message}`);
                    }

                    console.log(`Successfully updated facility "${facility.name || 'Unknown'}" with property_id=${updatePropertyId}, facility_id=${updateFacilityId}`);
                  } catch (err: any) {
                    errors.push(`Error updating facility "${facility.name || 'Unknown'}": ${err.message || 'Unknown error'}`);
                    console.error('Exception during facility update:', err);
                    // Continue processing other facilities
                  }
                }
                
                // Show errors if any occurred
                if (errors.length > 0) {
                  const errorMessage = `Some facility operations failed:\n\n${errors.join('\n')}`;
                  console.error('Facility operation errors:', errors);
                  alert(errorMessage);
                  // Still refresh to show what was successfully updated
                }
                
                const refreshId = slug || property.slug || property.id.toString();
                await fetchPropertyDetails(refreshId);
              }}
            />
            {editingSections.has('facilities') && (
              <div className="mb-4 p-3 border border-dashed border-gray-300 dark:border-zinc-800 rounded">
                <p className="text-xs text-gray-600 dark:text-zinc-400 mb-2">Search and add facility from master list</p>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={facilitySearchTerm}
                    onChange={async (e) => {
                      const term = e.target.value;
                      setFacilitySearchTerm(term);
                      if (term.trim().length >= 2) {
                        const { data } = await baseClient
                          .from('facilities')
                          .select('id,name')
                          .ilike('name', `%${term}%`)
                          .limit(8);
                        setFacilitySearchResults(data || []);
                      } else {
                        setFacilitySearchResults([]);
                      }
                    }}
                    className="w-full rounded border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                    placeholder="Search facilities"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFacilitySearchTerm('');
                      setFacilitySearchResults([]);
                    }}
                    className="px-3 py-2 bg-gray-200 dark:bg-zinc-800 text-sm rounded hover:bg-gray-300 dark:hover:bg-zinc-700"
                  >
                    Clear
                  </button>
                </div>
                {facilitySearchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 dark:border-zinc-800 rounded p-2 max-h-40 overflow-auto space-y-1">
                    {facilitySearchResults.map((res: any) => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => {
                          const existing = editValues['facilities']?.facilities || facilities.map((f: any) => ({
                            propertyFacilityCompositeKey: f.propertyFacility?.compositeKey,
                            propertyId: f.propertyFacility?.property_id,
                            facilityId: f.id,
                            name: f.name,
                            image_url: f.propertyFacility?.image_url || f.image_url || '',
                          }));
                          const updated = [
                            ...existing,
                            {
                              propertyFacilityCompositeKey: null,
                              propertyId: property.id,
                              facilityId: res.id,
                              name: res.name,
                              image_url: '',
                              _isNew: true,
                            },
                          ];
                          updateEditValue('facilities', 'facilities', updated);
                          setFacilitySearchTerm('');
                          setFacilitySearchResults([]);
                        }}
                        className="w-full flex justify-between items-center px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-900 text-xs text-left"
                      >
                        <span>{res.name}</span>
                        <span className="text-[11px] text-gray-500 dark:text-zinc-500">ID: {res.id}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-1">Select to add; you can remove existing facilities below.</p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(editValues['facilities']?.facilities || facilities)
                .filter((facility: any) => {
                  // Filter out empty facilities (those without a valid facilityId)
                  // Only show facilities that have been properly selected/added
                  if (facility._isNew && (!facility.facilityId || facility.facilityId === '' || facility.facilityId === null)) {
                    return false;
                  }
                  return true;
                })
                .map((facility: any, idx: number) => {
                const facilityImageUrl = facility.propertyFacility?.image_url || facility.image_url;
                const isEditing = editingSections.has('facilities');
                const editFacilityData = isEditing
                  ? (editValues['facilities']?.facilities || [])[idx] || editValues['facilities']?.facilities?.find((f: any) => f.facilityId === facility.id)
                  : null;
                const displayImageUrl = isEditing && editFacilityData ? editFacilityData.image_url : facilityImageUrl;
                const markedForRemoval = isEditing && editFacilityData?._remove;
                
                return (
                  <div
                    key={facility.propertyFacilityId || facility.id || idx}
                    className={`border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden relative ${markedForRemoval ? 'opacity-60 ring-1 ring-red-400' : ''}`}
                  >
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          const facilities = editValues['facilities']?.facilities || [];
                          const updated = [...facilities];
                          updated[idx] = {
                            ...(updated[idx] || facility),
                            propertyFacilityCompositeKey:
                              (updated[idx] && updated[idx].propertyFacilityCompositeKey) ||
                              facility.propertyFacilityCompositeKey ||
                              facility.propertyFacility?.compositeKey ||
                              null,
                            propertyId:
                              (updated[idx] && updated[idx].propertyId) ||
                              facility.propertyId ||
                              facility.propertyFacility?.property_id ||
                              property.id,
                            facilityId:
                              (updated[idx] && updated[idx].facilityId) ||
                              facility.facilityId ||
                              facility.id ||
                              null,
                            _remove: true,
                          };
                          updateEditValue('facilities', 'facilities', updated);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900"
                        title="Remove facility"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {markedForRemoval && (
                      <div className="absolute left-0 top-0 px-2 py-1 bg-red-600 text-white text-[10px]">
                        Marked for removal
                      </div>
                    )}
                    {isEditing ? (
                      <div className="p-3 space-y-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Facility ID</label>
                        <input
                          type="number"
                          value={editFacilityData?.facilityId ?? facility.facilityId ?? facility.id ?? ''}
                          onChange={(e) => {
                            const facilities = editValues['facilities']?.facilities || [];
                            const updated = [...facilities];
                            updated[idx] = { ...(updated[idx] || facility), facilityId: e.target.value };
                            updateEditValue('facilities', 'facilities', updated);
                          }}
                          className="w-full mb-2 rounded border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
                          placeholder="Enter facility ID"
                        />
                        <div className="text-[11px] text-gray-500 dark:text-zinc-400 mb-2">Ref: facility_id in facilities table</div>
                        <FileUpload
                          label={facility.name || editFacilityData?.name || 'Facility Image'}
                          accept="image/*"
                          category="image"
                          currentUrl={editFacilityData?.image_url || facility.image_url || ''}
                          onUploadComplete={(url) => {
                            const facilities = editValues['facilities']?.facilities || [];
                            const updatedFacilities = [...facilities];
                            updatedFacilities[idx] = { ...(updatedFacilities[idx] || facility), image_url: url };
                            updateEditValue('facilities', 'facilities', updatedFacilities);
                          }}
                        />
                      </div>
                    ) : displayImageUrl ? (
                      <div className="w-full h-32 bg-gray-100 dark:bg-zinc-900">
                        <img
                          src={displayImageUrl}
                          alt={facility.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="p-3 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                        <span className="text-black dark:text-white">{facility.name || 'Facility'}</span>
                </div>
                      <div className="text-[11px] text-gray-500 dark:text-zinc-500">ID: {facility.facilityId || facility.id || '-'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buildings */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Buildings"
              sectionId="buildings"
              onEdit={() => toggleEdit('buildings', {
                buildings: buildings.map((building: any) => ({
                  id: building.id,
                  name: building.name || '',
                  description: building.description || '',
                  completion_date: building.completion_date || '',
                  image_url: building.image_url || '',
                })),
              })}
              onAddItem={() => {
                if (!editingSections.has('buildings')) {
                  toggleEdit('buildings', {
                    buildings: [
                      ...buildings.map((building: any) => ({
                        id: building.id,
                        name: building.name || '',
                        description: building.description || '',
                        completion_date: building.completion_date || '',
                        image_url: building.image_url || '',
                      })),
                      { id: `temp-${Date.now()}-${Math.random()}`, name: '', description: '', completion_date: '', image_url: '', _isNew: true },
                    ],
                  });
                } else {
                  const currentBuildings = editValues['buildings']?.buildings || buildings.map((building: any) => ({
                    id: building.id,
                    name: building.name || '',
                    description: building.description || '',
                    completion_date: building.completion_date || '',
                    image_url: building.image_url || '',
                  }));
                  updateEditValue('buildings', 'buildings', [
                    ...currentBuildings,
                    { id: `temp-${Date.now()}-${Math.random()}`, name: '', description: '', completion_date: '', image_url: '', _isNew: true },
                  ]);
                }
              }}
              addLabel="Add Building"
              onSave={async () => {
                const values = editValues['buildings'] || {};
                const buildingUpdates = values.buildings || [];
                
                // Handle removed buildings first
                for (const buildingUpdate of buildingUpdates) {
                  if (buildingUpdate._remove && !buildingUpdate._isNew) {
                    // Delete existing building from database
                    const building = buildings.find((b: any) => b.id === buildingUpdate.id);
                    if (!building) continue;
                    
                    const oldImageUrl = (building.image_url || '').trim();
                    
                    // Delete image from R2 if it exists
                    if (oldImageUrl && oldImageUrl.startsWith('http')) {
                      try {
                        await deleteFromR2(oldImageUrl);
                      } catch (err) {
                        console.error('Error deleting building image from R2:', err);
                      }
                    }
                    
                    // Delete building from database
                    const { error: deleteError } = await baseClient
                      .from('property_buildings')
                      .delete()
                      .eq('id', building.id);
                    
                    if (deleteError) {
                      console.error('Error deleting building:', deleteError);
                      throw deleteError;
                    }
                  }
                }
                
                // Filter out removed buildings and empty new buildings
                const validBuildings = buildingUpdates.filter((b: any) => {
                  // Skip removed buildings (already handled above)
                  if (b._remove) return false;
                  
                  if (b._isNew) {
                    // Allow new buildings if they have at least a name or an image
                    return (b.name && b.name.trim() !== '') || (b.image_url && b.image_url.trim() !== '');
                  }
                  return true; // Keep all existing buildings for update
                });
                
                for (const buildingUpdate of validBuildings) {
                  if (buildingUpdate._isNew) {
                    // Insert new building - allow even if name is empty (might have image or description)
                    try {
                      const { error } = await baseClient
                        .from('property_buildings')
                        .insert({
                          property_id: property.id,
                          name: buildingUpdate.name && buildingUpdate.name.trim() !== '' ? buildingUpdate.name : null,
                          description: buildingUpdate.description && buildingUpdate.description.trim() !== '' ? buildingUpdate.description : null,
                          completion_date: buildingUpdate.completion_date && buildingUpdate.completion_date.trim() !== '' ? buildingUpdate.completion_date : null,
                          image_url: buildingUpdate.image_url && buildingUpdate.image_url.trim() !== '' ? buildingUpdate.image_url : null,
                        });
                      
                      if (error) {
                        console.error('Error inserting building:', error);
                        throw error;
                      }
                    } catch (err) {
                      console.error('Failed to insert building:', err);
                      throw err;
                    }
                  } else {
                    // Update existing building (skip if marked for removal, should have been filtered out)
                    if (buildingUpdate._remove) continue;
                    
                    const building = buildings.find((b: any) => b.id === buildingUpdate.id);
                    if (!building) continue;
                    
                    const oldImageUrl = (building.image_url || '').trim();
                    const newImageUrl = (buildingUpdate.image_url || '').trim();
                    
                    if (oldImageUrl !== newImageUrl) {
                      // Delete old image from R2 if it's an R2 URL
                      if (oldImageUrl && oldImageUrl.startsWith('http')) {
                        try {
                          await deleteFromR2(oldImageUrl);
                        } catch (err) {
                          console.error('Error deleting building image from R2:', err);
                        }
                      }
                    }
                    
                    const { error: updateError } = await baseClient
                      .from('property_buildings')
                      .update({
                        name: buildingUpdate.name !== undefined ? (buildingUpdate.name && buildingUpdate.name.trim() !== '' ? buildingUpdate.name : null) : building.name,
                        description: buildingUpdate.description !== undefined ? (buildingUpdate.description && buildingUpdate.description.trim() !== '' ? buildingUpdate.description : null) : building.description,
                        completion_date: buildingUpdate.completion_date !== undefined ? (buildingUpdate.completion_date && buildingUpdate.completion_date.trim() !== '' ? buildingUpdate.completion_date : null) : building.completion_date,
                        image_url: newImageUrl && newImageUrl.trim() !== '' ? newImageUrl : null,
                      })
                      .eq('id', building.id);
                    
                    if (updateError) {
                      console.error('Error updating building:', updateError);
                      throw updateError;
                    }
                  }
                }
                
                const refreshId = slug || property.slug || property.id.toString();
                await fetchPropertyDetails(refreshId);
              }}
            />
            {buildings.length === 0 && !editingSections.has('buildings') ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-zinc-400">N/A - No buildings added yet</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(editingSections.has('buildings') ? editValues['buildings']?.buildings || [] : buildings).map((building: any, index: number) => {
                    const isEditing = editingSections.has('buildings');
                    const isNew = building._isNew;
                    // For new buildings, use the building itself as editBuildingData since it's already in editValues
                    const editBuildingData = isEditing 
                      ? (editValues['buildings']?.buildings?.find((b: any) => b.id === building.id) || building)
                      : null;
                    const displayImageUrl = isEditing && editBuildingData ? editBuildingData.image_url : building.image_url;
                    const markedForRemoval = isEditing && editBuildingData?._remove;
                    
                    return (
                      <div key={building.id || `new-${index}`} className={`border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden relative ${markedForRemoval ? 'opacity-60 ring-1 ring-red-400' : ''}`}>
                        {isEditing && !isNew && (
                          <button
                            type="button"
                            onClick={() => {
                              const buildingsList = editValues['buildings']?.buildings || [];
                              const buildingIndex = buildingsList.findIndex((b: any) => b.id === building.id);
                              if (buildingIndex >= 0) {
                                buildingsList[buildingIndex] = { ...buildingsList[buildingIndex], _remove: true };
                                updateEditValue('buildings', 'buildings', [...buildingsList]);
                              }
                            }}
                            className="absolute top-2 right-2 p-1 rounded-full bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 z-10"
                            title="Remove building"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        {markedForRemoval && (
                          <div className="absolute left-0 top-0 px-2 py-1 bg-red-600 text-white text-[10px] z-10">
                            Marked for removal
                          </div>
                        )}
                        {isEditing ? (
                          <div className="p-4 space-y-3">
                            <div>
                              <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Building Name</label>
                              <input
                                type="text"
                                value={editBuildingData?.name ?? building.name ?? ''}
                                onChange={(e) => {
                                  const buildingsList = editValues['buildings']?.buildings || [];
                                  const buildingIndex = buildingsList.findIndex((b: any) => b.id === building.id);
                                  if (buildingIndex >= 0) {
                                    buildingsList[buildingIndex] = { ...buildingsList[buildingIndex], name: e.target.value };
                                    updateEditValue('buildings', 'buildings', [...buildingsList]);
                                  }
                                }}
                                placeholder="Building name"
                                className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Description</label>
                              <textarea
                                value={editBuildingData?.description ?? building.description ?? ''}
                                onChange={(e) => {
                                  const buildingsList = editValues['buildings']?.buildings || [];
                                  const buildingIndex = buildingsList.findIndex((b: any) => b.id === building.id);
                                  if (buildingIndex >= 0) {
                                    buildingsList[buildingIndex] = { ...buildingsList[buildingIndex], description: e.target.value };
                                    updateEditValue('buildings', 'buildings', [...buildingsList]);
                                  }
                                }}
                                placeholder="Description"
                                className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                                rows={3}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Completion Date</label>
                              <input
                                type="date"
                                value={editBuildingData?.completion_date ?? building.completion_date ?? ''}
                                onChange={(e) => {
                                  const buildingsList = editValues['buildings']?.buildings || [];
                                  const buildingIndex = buildingsList.findIndex((b: any) => b.id === building.id);
                                  if (buildingIndex >= 0) {
                                    buildingsList[buildingIndex] = { ...buildingsList[buildingIndex], completion_date: e.target.value };
                                    updateEditValue('buildings', 'buildings', [...buildingsList]);
                                  }
                                }}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                              />
                            </div>
                            <FileUpload
                              label="Building Image"
                              accept="image/*"
                              category="image"
                              currentUrl={editBuildingData?.image_url ?? displayImageUrl ?? ''}
                              onUploadComplete={(url) => {
                                const buildingsList = editValues['buildings']?.buildings || [];
                                const buildingIndex = buildingsList.findIndex((b: any) => b.id === building.id);
                                if (buildingIndex >= 0) {
                                  buildingsList[buildingIndex] = { ...buildingsList[buildingIndex], image_url: url };
                                  updateEditValue('buildings', 'buildings', [...buildingsList]);
                                }
                              }}
                            />
                            {isNew && (
                              <button
                                onClick={() => {
                                  const buildingsList = editValues['buildings']?.buildings || [];
                                  updateEditValue('buildings', 'buildings', buildingsList.filter((b: any) => b.id !== building.id));
                                }}
                                className="w-full px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {displayImageUrl ? (
                              <div className="w-full h-48 bg-gray-100 dark:bg-zinc-900">
                                <img
                                  src={displayImageUrl}
                                  alt={building.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : null}
                            <div className="p-4">
                  <h3 className="text-sm font-medium mb-1 text-black dark:text-white">{building.name}</h3>
                  {building.description && (
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mb-2">{building.description}</p>
                  )}
                  {building.completion_date && (
                    <p className="text-xs text-gray-500 dark:text-zinc-500">Completion: {new Date(building.completion_date).toLocaleDateString()}</p>
                  )}
                </div>
                          </>
                        )}
            </div>
                    );
                  })}
                </div>
                {editingSections.has('buildings') && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const currentBuildings = editValues['buildings']?.buildings || [];
                        updateEditValue('buildings', 'buildings', [
                          ...currentBuildings,
                          { id: `temp-${Date.now()}-${Math.random()}`, name: '', description: '', completion_date: '', image_url: '', _isNew: true },
                        ]);
                      }}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded text-sm hover:bg-blue-700 dark:hover:bg-blue-800"
                    >
                      + Add Another Building
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Location */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Location"
              sectionId="location"
              onEdit={() => toggleEdit('location', {
                area: property.area || '',
                city: property.city || '',
                country: property.country || '',
                coordinates: (property as any).coordinates || (property as any).coordinates_text || '',
                website: property.website || '',
              })}
              onSave={async () => {
                const values = editValues['location'] || {};
                const updates: any = {};
                if (values.area !== undefined) updates.area = values.area;
                if (values.city !== undefined) updates.city = values.city || null;
                if (values.country !== undefined) updates.country = values.country || null;
                if (values.coordinates !== undefined) updates.coordinates_text = values.coordinates || null;
                if (values.website !== undefined) updates.website = values.website || null;
                
                if (Object.keys(updates).length > 0) {
                  const { error } = await baseClient
                    .from('properties')
                    .update(updates)
                    .eq('id', property.id);
                  if (error) throw error;
                }
                
                await fetchPropertyDetails(slug || property.id.toString());
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              {editingSections.has('location') ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Area</label>
                    <input
                      type="text"
                      value={editValues['location']?.area || ''}
                      onChange={(e) => updateEditValue('location', 'area', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                        </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">City</label>
                    <input
                      type="text"
                      value={editValues['location']?.city || ''}
                      onChange={(e) => updateEditValue('location', 'city', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Country</label>
                    <input
                      type="text"
                      value={editValues['location']?.country || ''}
                      onChange={(e) => updateEditValue('location', 'country', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Coordinates</label>
                    <input
                      type="text"
                      value={editValues['location']?.coordinates || ''}
                      onChange={(e) => updateEditValue('location', 'coordinates', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm font-mono"
                      placeholder="lat, lng"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Website</label>
                    <input
                      type="url"
                      value={editValues['location']?.website || ''}
                      onChange={(e) => updateEditValue('location', 'website', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Location</p>
                    <p className="text-black dark:text-white">
                      {property.area || 'N/A'}
                      {property.city && `, ${property.city}`}
                      {property.country && `, ${property.country}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Coordinates</p>
                    <p className="text-black dark:text-white font-mono text-xs">{(property as any).coordinates || (property as any).coordinates_text || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Website</p>
                    {property.website ? (
                      <a 
                        href={property.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {property.website}
                      </a>
                    ) : (
                      <p className="text-black dark:text-white">N/A</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Nearby Locations */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Nearby Locations"
              sectionId="nearby"
              onEdit={() => toggleEdit('nearby', {
                mapPoints: mapPoints.map((p: any) => ({ id: p.id, name: p.name, distance_km: p.distance_km })),
              })}
              onSave={async () => {
                const values = editValues['nearby'] || {};
                
                if (values.mapPoints !== undefined) {
                  const currentPoints = mapPoints;
                  const newPoints = values.mapPoints.filter((p: any) => p.name && p.name.trim() !== '');
                  
                  // Delete removed points
                  for (const point of currentPoints) {
                    if (!newPoints.find((p: any) => p.id === point.id)) {
                      await baseClient
                        .from('property_map_points')
                        .delete()
                        .eq('id', point.id);
                    }
                  }

                  // Get default source_id for manual entries (usually the first active source)
                  const { data: defaultSource } = await baseClient
                    .from('data_sources')
                    .select('id')
                    .eq('active', true)
                    .order('id', { ascending: true })
                    .limit(1)
                    .single();
                  
                  const sourceId = defaultSource?.id || 1; // Fallback to 1 if no source found

                  // Update or insert points
                  for (const point of newPoints) {
                    if (point.id) {
                      // Update existing
                      await baseClient
                        .from('property_map_points')
                        .update({ name: point.name, distance_km: point.distance_km })
                        .eq('id', point.id);
                    } else {
                      // Insert new - source_id is required
                      await baseClient
                        .from('property_map_points')
                        .insert({ 
                          property_id: property.id, 
                          name: point.name, 
                          distance_km: point.distance_km,
                          source_id: sourceId
                        });
                    }
                  }
                }
                
                await fetchPropertyDetails(slug || property.id.toString());
              }}
            />
            {editingSections.has('nearby') ? (
              <div className="space-y-2">
                {(editValues['nearby']?.mapPoints || mapPoints).map((point: any, index: number) => (
                  <div key={point.id || index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={point.name || ''}
                      onChange={(e) => {
                        const points = editValues['nearby']?.mapPoints || mapPoints.map((p: any) => ({ id: p.id, name: p.name, distance_km: p.distance_km }));
                        points[index] = { ...point, name: e.target.value };
                        updateEditValue('nearby', 'mapPoints', points);
                      }}
                      placeholder="Location name"
                      className="flex-1 p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-xs"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={point.distance_km ?? ''}
                      onChange={(e) => {
                        const points = editValues['nearby']?.mapPoints || mapPoints.map((p: any) => ({ id: p.id, name: p.name, distance_km: p.distance_km }));
                        points[index] = { ...point, distance_km: e.target.value ? parseFloat(e.target.value) : null };
                        updateEditValue('nearby', 'mapPoints', points);
                      }}
                      placeholder="Distance (km)"
                      className="w-24 p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-xs"
                    />
                    <button
                      onClick={() => {
                        const points = editValues['nearby']?.mapPoints || mapPoints.map((p: any) => ({ id: p.id, name: p.name, distance_km: p.distance_km }));
                        const newPoints = points.filter((_: any, i: number) => i !== index);
                        updateEditValue('nearby', 'mapPoints', newPoints);
                      }}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                </div>
              ))}
                <button
                  onClick={() => {
                    const currentPoints = editValues['nearby']?.mapPoints || mapPoints.map((p: any) => ({ id: p.id, name: p.name, distance_km: p.distance_km }));
                    updateEditValue('nearby', 'mapPoints', [...currentPoints, { name: '', distance_km: null, _isNew: true }]);
                  }}
                  className="px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded text-xs hover:bg-blue-700 dark:hover:bg-blue-800"
                >
                  + Add Location
                </button>
            </div>
            ) : (
              <>
                {mapPoints.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {mapPoints.map((point) => (
                      <div key={point.id} className="flex justify-between text-xs py-1">
                  <span className="text-gray-600 dark:text-zinc-400">{point.name}</span>
                        {point.distance_km !== null && (
                  <span className="text-gray-500 dark:text-zinc-500">{point.distance_km} km</span>
                        )}
                </div>
              ))}
            </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-zinc-400">N/A - No locations added yet</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Payment Plans */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Payment Plans"
              sectionId="payment_plans"
              onEdit={() => toggleEdit('payment_plans', {
                paymentPlans: paymentPlans.map((plan: any) => ({
                  id: plan.id,
                  plan_name: plan.plan_name || '',
                  months_after_handover: plan.months_after_handover || 0,
                  payments: plan.payments || [],
                })),
              })}
              onSave={async () => {
                const values = editValues['payment_plans'] || {};
                
                if (values.paymentPlans !== undefined) {
                  const currentPlans = paymentPlans;
                  const newPlans = values.paymentPlans.filter((p: any) => p.plan_name && p.plan_name.trim() !== '');
                  
                  // Delete removed plans
                  for (const plan of currentPlans) {
                    if (!newPlans.find((p: any) => p.id === plan.id)) {
                      await baseClient
                        .from('property_payment_plans')
                        .delete()
                        .eq('id', plan.id);
                    }
                  }

                  // Update or insert plans
                  for (const plan of newPlans) {
                    // Convert _paymentStepsText to payments array if it exists, otherwise use existing payments
                    let paymentsJson: any[] = [];
                    if (plan._paymentStepsText !== undefined) {
                      // Convert textarea text to payments array
                      paymentsJson = plan._paymentStepsText.split('\n')
                        .map((step: string) => step.trim())
                        .filter((step: string) => step !== '')
                        .map((step: string, index: number) => ({
                          step: index + 1,
                          description: step,
                        }));
                    } else if (Array.isArray(plan.payments)) {
                      // Use existing payments array, ensuring proper format
                      paymentsJson = plan.payments.map((p: any, index: number) => ({
                        step: index + 1,
                        description: typeof p === 'string' ? p : (p.description || p.name || ''),
                        ...(typeof p === 'object' && !p.step ? {} : {}),
                      }));
                    }

                    if (plan.id) {
                      // Update existing
                      await baseClient
                        .from('property_payment_plans')
                        .update({ 
                          plan_name: plan.plan_name,
                          months_after_handover: plan.months_after_handover || 0,
                          payments: paymentsJson
                        })
                        .eq('id', plan.id);
                    } else {
                      // Insert new
                      await baseClient
                        .from('property_payment_plans')
                        .insert({ 
                          property_id: property.id,
                          plan_name: plan.plan_name,
                          months_after_handover: plan.months_after_handover || 0,
                          payments: paymentsJson
                        });
                    }
                  }
                }
                
                await fetchPropertyDetails(slug || property.id.toString());
              }}
              onAddItem={() => {
                if (!editingSections.has('payment_plans')) {
                  toggleEdit('payment_plans', {
                    paymentPlans: [
                      ...paymentPlans.map((plan: any) => ({
                        id: plan.id,
                        plan_name: plan.plan_name || '',
                        months_after_handover: plan.months_after_handover || 0,
                        payments: plan.payments || [],
                      })),
                      { plan_name: '', months_after_handover: 0, payments: [], _isNew: true },
                    ],
                  });
                } else {
                  const currentPlans = editValues['payment_plans']?.paymentPlans || paymentPlans.map((plan: any) => ({
                    id: plan.id,
                    plan_name: plan.plan_name || '',
                    months_after_handover: plan.months_after_handover || 0,
                    payments: plan.payments || [],
                  }));
                  updateEditValue('payment_plans', 'paymentPlans', [
                    ...currentPlans,
                    { plan_name: '', months_after_handover: 0, payments: [], _isNew: true },
                  ]);
                }
              }}
              addLabel="Add Payment Plan"
            />
            {editingSections.has('payment_plans') ? (
              <div className="space-y-4">
                {(editValues['payment_plans']?.paymentPlans || paymentPlans).map((plan: any, planIndex: number) => (
                  <div key={plan.id || planIndex} className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-black dark:text-white">Payment Plan {planIndex + 1}</h4>
                      <button
                        onClick={() => {
                          const currentPlans = editValues['payment_plans']?.paymentPlans || paymentPlans.map((p: any) => ({
                            id: p.id,
                            plan_name: p.plan_name || '',
                            months_after_handover: p.months_after_handover || 0,
                            payments: p.payments || [],
                          }));
                          const newPlans = currentPlans.filter((_: any, i: number) => i !== planIndex);
                          updateEditValue('payment_plans', 'paymentPlans', newPlans);
                        }}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Plan Name</label>
                        <input
                          type="text"
                          value={plan.plan_name || ''}
                          onChange={(e) => {
                            const currentPlans = editValues['payment_plans']?.paymentPlans || paymentPlans.map((p: any) => ({
                              id: p.id,
                              plan_name: p.plan_name || '',
                              months_after_handover: p.months_after_handover || 0,
                              payments: p.payments || [],
                            }));
                            currentPlans[planIndex] = { ...plan, plan_name: e.target.value };
                            updateEditValue('payment_plans', 'paymentPlans', currentPlans);
                          }}
                          className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                          placeholder="e.g., Standard Payment Plan"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Months After Handover</label>
                        <input
                          type="number"
                          value={plan.months_after_handover ?? ''}
                          onChange={(e) => {
                            const currentPlans = editValues['payment_plans']?.paymentPlans || paymentPlans.map((p: any) => ({
                              id: p.id,
                              plan_name: p.plan_name || '',
                              months_after_handover: p.months_after_handover || 0,
                              payments: p.payments || [],
                            }));
                            currentPlans[planIndex] = { ...plan, months_after_handover: e.target.value ? parseInt(e.target.value) : 0 };
                            updateEditValue('payment_plans', 'paymentPlans', currentPlans);
                          }}
                          className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Payment Steps (one per line)</label>
                        <textarea
                          value={plan._paymentStepsText !== undefined 
                            ? plan._paymentStepsText 
                            : (Array.isArray(plan.payments) 
                              ? plan.payments.map((p: any) => typeof p === 'string' ? p : (p.description || p.name || '')).join('\n') 
                              : '')}
                          onChange={(e) => {
                            const currentPlans = editValues['payment_plans']?.paymentPlans || paymentPlans.map((p: any) => ({
                              id: p.id,
                              plan_name: p.plan_name || '',
                              months_after_handover: p.months_after_handover || 0,
                              payments: p.payments || [],
                            }));
                            // Store raw text for editing, convert to payments array when saving
                            currentPlans[planIndex] = { 
                              ...plan, 
                              _paymentStepsText: e.target.value,
                              payments: e.target.value.split('\n')
                                .map((step, index) => ({
                                  step: index + 1,
                                  description: step.trim(),
                                }))
                                .filter(p => p.description !== '')
                            };
                            updateEditValue('payment_plans', 'paymentPlans', currentPlans);
                          }}
                          className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm min-h-[100px] resize-y font-mono text-xs"
                          placeholder="10% on booking&#10;20% on handover&#10;70% over 3 years"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {paymentPlans.length > 0 ? (
                  <div className="space-y-4">
                    {paymentPlans.map((plan: any) => (
                      <div key={plan.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                        <h3 className="text-sm font-medium mb-2 text-black dark:text-white">{plan.plan_name || plan.name}</h3>
                        {plan.months_after_handover !== null && plan.months_after_handover > 0 && (
                          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">{plan.months_after_handover} months after handover</p>
                        )}
                        {(() => {
                          // Display payments from either plan.payments or plan.values (values is derived from payments)
                          const paymentsToShow = plan.payments && Array.isArray(plan.payments) && plan.payments.length > 0
                            ? plan.payments
                            : (plan.values && plan.values.length > 0 ? plan.values.map((v: any) => ({
                                step: v.sequence,
                                description: v.name || v.value_raw
                              })) : []);
                          
                          if (paymentsToShow.length === 0) return null;
                          
                          return (
                            <div className="space-y-1">
                              {paymentsToShow.map((payment: any, index: number) => (
                                <div key={index} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                                  <span className="w-4 h-4 rounded-full border border-gray-300 dark:border-zinc-800 flex items-center justify-center text-[10px]">
                                    {payment.step || payment.sequence || index + 1}
                                  </span>
                                  {payment.description || payment.name || payment.value_raw}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-zinc-400">N/A - No payment plans added yet</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Developer Info */}
        {(
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Developer</h2>
            <div className="space-y-2 text-xs">
              {developer ? (
                <>
                  <p className="text-black dark:text-white font-medium">{developer.name}</p>
                  {developer.description && (
                    <p className="text-gray-600 dark:text-zinc-400">{developer.description}</p>
                  )}
                  {developer.email && (
                    <p className="text-gray-500 dark:text-zinc-500">Email: {developer.email}</p>
                  )}
                  {developer.website && (
                    <a href={developer.website} target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white">
                      Visit Website →
                    </a>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-zinc-400">N/A - No developer assigned</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PropertyDetailsPage;

