import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
// Use base client since PropertyDetailsPage is already protected by DashboardAuth
// The authenticatedSupabase proxy causes "Session expired" errors unnecessarily
import { supabase as baseClient } from '../../lib/supabaseAuth';
import { PropertyDetails } from '../../types/database.types';
import FileUpload from '../property-entry/FileUpload';
import { uploadToR2, deleteFromR2, FileCategory } from '../../utils/r2Upload';

const PropertyDetailsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [details, setDetails] = useState<PropertyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);

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
      const isNumeric = !isNaN(Number(identifier));
      
      // Fetch property
      const propertyQuery = baseClient
        .from('properties')
        .select('*');
      
      if (isNumeric) {
        propertyQuery.eq('id', Number(identifier));
      } else {
        propertyQuery.eq('slug', identifier);
      }

      const { data: property, error: propertyError } = await propertyQuery.single();

      if (propertyError || !property) {
        throw new Error('Property not found');
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

      // Fetch payment plan values
      const paymentPlansWithValues = await Promise.all(
        (paymentPlans || []).map(async (plan) => {
          const { data: values } = await baseClient
            .from('payment_plan_values')
            .select('*')
            .eq('property_payment_plan_id', plan.id)
            .order('sequence');
          return { ...plan, values: values || [] };
        })
      );

      // Transform facilities data
      const facilitiesData = (propertyFacilities || []).map((pf: any) => ({
        ...pf.facilities,
        propertyFacility: {
          id: pf.id,
          property_id: pf.property_id,
          facility_id: pf.facility_id,
          image_url: pf.image_url,
          image_source: pf.image_source,
          created_at: pf.created_at,
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
    return `${(price / 1000000).toFixed(2)}M ${currency}`;
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

  const SectionHeader: React.FC<{
    title: string;
    sectionId: string;
    onEdit: () => void;
    onSave: () => Promise<void>;
    hasChanges?: boolean;
  }> = ({ title, sectionId, onEdit, onSave, hasChanges = false }) => {
    const isEditing = editingSections.has(sectionId);
    const isSaving = saving === sectionId;

    return (
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-black dark:text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => toggleEdit(sectionId)}
                disabled={isSaving}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                title="Cancel editing"
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
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
              title="Edit section"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
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
  const hasImages = displayImages.length > 0;

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
            <button className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-900 text-black dark:text-white rounded text-xs hover:bg-gray-300 dark:hover:bg-zinc-800">
              Edit
            </button>
            <button className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded text-xs hover:bg-gray-800 dark:hover:bg-zinc-200">
              Share
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Images Gallery - Hero Section */}
        {(hasImages || editingSections.has('images')) && (
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
          <div className="flex flex-wrap gap-6 text-sm">
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
            {developer && (
              <div>
                <span className="text-gray-600 dark:text-zinc-500">Developer: </span>
                <span className="text-black dark:text-white">{developer.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        {(property.overview || editingSections.has('overview')) && (
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
            ) : null}
          </div>
        )}

        {/* Key Highlights / Quick Facts */}
        {(property.service_charge || property.furnishing || property.status || property.sale_status || editingSections.has('highlights')) && (
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
                  {property.status && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Project Status</p>
                      <p className="text-black dark:text-white font-medium">{property.status}</p>
              </div>
            )}
                  {property.sale_status && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Sale Status</p>
                      <p className="text-black dark:text-white font-medium">{property.sale_status}</p>
              </div>
            )}
                  {property.service_charge && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Service Charge</p>
                      <p className="text-black dark:text-white font-medium">{property.service_charge}</p>
          </div>
                  )}
                  {property.furnishing && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Furnishing</p>
                      <p className="text-black dark:text-white font-medium">{property.furnishing}</p>
        </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Pricing Details */}
        {(property.min_price || property.max_price || property.min_area || property.max_area || editingSections.has('pricing')) && (
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
                if (values.min_price !== undefined) updates.min_price_aed = values.min_price ? Number(values.min_price) * 1000000 : null;
                if (values.max_price !== undefined) updates.max_price_aed = values.max_price ? Number(values.max_price) * 1000000 : null;
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
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Min Price (M)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editValues['pricing']?.min_price ? (editValues['pricing'].min_price / 1000000) : ''}
                      onChange={(e) => updateEditValue('pricing', 'min_price', e.target.value ? Number(e.target.value) * 1000000 : null)}
                      className="w-full p-2 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-black text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Max Price (M)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editValues['pricing']?.max_price ? (editValues['pricing'].max_price / 1000000) : ''}
                      onChange={(e) => updateEditValue('pricing', 'max_price', e.target.value ? Number(e.target.value) * 1000000 : null)}
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
              {property.min_price && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Min Price</p>
                  <p className="text-black dark:text-white font-medium">{formatPrice(property.min_price, property.price_currency)}</p>
                </div>
              )}
              {property.max_price && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Max Price</p>
                  <p className="text-black dark:text-white font-medium">{formatPrice(property.max_price, property.price_currency)}</p>
                </div>
              )}
              {property.min_area && property.max_area && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Area Range</p>
                  <p className="text-black dark:text-white font-medium">
                    {property.min_area} - {property.max_area} {property.area_unit || 'sqft'}
                  </p>
                </div>
              )}
              {property.price_currency && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Currency</p>
                  <p className="text-black dark:text-white font-medium">{property.price_currency}</p>
                </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Project Status & Timeline */}
        {((property as any).permit_id || property.completion_datetime || property.readiness !== null || editingSections.has('status_timeline')) && (
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
              {(property as any).permit_id && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">RERA Number / Permit ID</p>
                  <p className="text-black dark:text-white font-mono">{(property as any).permit_id}</p>
                </div>
              )}
                  {property.completion_datetime && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Expected Completion</p>
                      <p className="text-black dark:text-white">{new Date(property.completion_datetime).toLocaleDateString()}</p>
                    </div>
                  )}
                  {property.readiness !== null && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Construction Readiness</p>
                      <p className="text-black dark:text-white">{property.readiness}%</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Buyer Protection */}
        {(property.has_escrow || property.post_handover || editingSections.has('protection')) && (
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
        {((property as any).parking || editingSections.has('parking')) && (
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
            <p className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-line">{(property as any).parking}</p>
            )}
          </div>
        )}

        {/* Media & Documents */}
        {(property.video_url || property.brochure_url || property.layouts_pdf || editingSections.has('media')) && (
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
              {property.video_url && (
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
              )}
              {property.brochure_url && (
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
              )}
              {property.layouts_pdf && (
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
              )}
          </div>
        )}
          </div>
        )}

        {/* Unit Types */}
        {unitBlocks.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Unit Types"
              sectionId="unit_types"
              onEdit={() => toggleEdit('unit_types', {
                units: unitBlocks.map((unit: any) => ({
                  id: unit.id,
                  image_url: unit.typical_unit_image_url || unit.typical_image_url || '',
                })),
              })}
              onSave={async () => {
                const values = editValues['unit_types'] || {};
                const unitUpdates = values.units || [];
                
                for (const unitUpdate of unitUpdates) {
                  const unit = unitBlocks.find((u: any) => u.id === unitUpdate.id);
                  if (!unit) continue;
                  
                  const oldImageUrl = ((unit as any).typical_unit_image_url || (unit as any).typical_image_url || '').trim();
                  const newImageUrl = (unitUpdate.image_url || '').trim();
                  
                  if (oldImageUrl !== newImageUrl) {
                    // Delete old image from R2 if it's an R2 URL
                    if (oldImageUrl && oldImageUrl.startsWith('http')) {
                      try {
                        await deleteFromR2(oldImageUrl);
                      } catch (err) {
                        console.error('Error deleting unit image from R2:', err);
                      }
                    }
                    
                    await baseClient
                      .from('property_unit_blocks')
                      .update({
                        typical_unit_image_url: newImageUrl || null,
                        typical_image_url: newImageUrl || null,
                      })
                      .eq('id', unit.id);
                  }
                }
                
                const refreshId = slug || property.slug || property.id.toString();
                await fetchPropertyDetails(refreshId);
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unitBlocks.map((unit: any) => {
                const unitImageUrl = unit.typical_unit_image_url || unit.typical_image_url;
                const isEditing = editingSections.has('unit_types');
                const editUnitData = editValues['unit_types']?.units?.find((u: any) => u.id === unit.id);
                const displayImageUrl = isEditing && editUnitData ? editUnitData.image_url : unitImageUrl;
                
                return (
                  <div key={unit.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
                    {isEditing ? (
                      <div className="p-4">
                        <FileUpload
                          label={`${unit.unit_bedrooms} - Unit Image`}
                          accept="image/*"
                          category="image"
                          currentUrl={editUnitData?.image_url || ''}
                          onUploadComplete={(url) => {
                            const units = editValues['unit_types']?.units || [];
                            const updatedUnits = units.map((u: any) => 
                              u.id === unit.id ? { ...u, image_url: url } : u
                            );
                            updateEditValue('unit_types', 'units', updatedUnits);
                          }}
                        />
                      </div>
                    ) : displayImageUrl ? (
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
                        {unit.units_area_from_m2 && unit.units_area_to_m2 && (
                      <p>Area: {unit.units_area_from_m2} - {unit.units_area_to_m2} m²</p>
                    )}
                        {unit.units_area_from && unit.units_area_to && (
                          <p>Area: {unit.units_area_from} - {unit.units_area_to} {property.area_unit || 'sqft'}</p>
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Facilities & Amenities */}
        {facilities.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Facilities & Amenities"
              sectionId="facilities"
              onEdit={() => toggleEdit('facilities', {
                facilities: facilities.map((facility: any) => ({
                  propertyFacilityId: facility.propertyFacility?.id,
                  facilityId: facility.id,
                  image_url: facility.propertyFacility?.image_url || facility.image_url || '',
                })),
              })}
              onSave={async () => {
                const values = editValues['facilities'] || {};
                const facilityUpdates = values.facilities || [];
                
                for (const facilityUpdate of facilityUpdates) {
                  const facility = facilities.find((f: any) => f.id === facilityUpdate.facilityId);
                  if (!facility || !facility.propertyFacility?.id) continue;
                  
                  const oldImageUrl = (facility.propertyFacility?.image_url || facility.image_url || '').trim();
                  const newImageUrl = (facilityUpdate.image_url || '').trim();
                  
                  if (oldImageUrl !== newImageUrl) {
                    // Delete old image from R2 if it's an R2 URL
                    if (oldImageUrl && oldImageUrl.startsWith('http')) {
                      try {
                        await deleteFromR2(oldImageUrl);
                      } catch (err) {
                        console.error('Error deleting facility image from R2:', err);
                      }
                    }
                    
                    await baseClient
                      .from('property_facilities')
                      .update({ image_url: newImageUrl || null })
                      .eq('id', facility.propertyFacility.id);
                  }
                }
                
                const refreshId = slug || property.slug || property.id.toString();
                await fetchPropertyDetails(refreshId);
              }}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {facilities.map((facility: any) => {
                const facilityImageUrl = facility.propertyFacility?.image_url || facility.image_url;
                const isEditing = editingSections.has('facilities');
                const editFacilityData = editValues['facilities']?.facilities?.find((f: any) => f.facilityId === facility.id);
                const displayImageUrl = isEditing && editFacilityData ? editFacilityData.image_url : facilityImageUrl;
                
                return (
                  <div key={facility.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
                    {isEditing ? (
                      <div className="p-3">
                        <FileUpload
                          label={facility.name}
                          accept="image/*"
                          category="image"
                          currentUrl={editFacilityData?.image_url || ''}
                          onUploadComplete={(url) => {
                            const facilities = editValues['facilities']?.facilities || [];
                            const updatedFacilities = facilities.map((f: any) => 
                              f.facilityId === facility.id ? { ...f, image_url: url } : f
                            );
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
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                        <span className="text-black dark:text-white">{facility.name}</span>
                </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buildings */}
        {buildings.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Buildings"
              sectionId="buildings"
              onEdit={() => toggleEdit('buildings', {
                buildings: buildings.map((building: any) => ({
                  id: building.id,
                  image_url: building.image_url || '',
                })),
              })}
              onSave={async () => {
                const values = editValues['buildings'] || {};
                const buildingUpdates = values.buildings || [];
                
                for (const buildingUpdate of buildingUpdates) {
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
                    
                    await baseClient
                      .from('property_buildings')
                      .update({ image_url: newImageUrl || null })
                      .eq('id', building.id);
                  }
                }
                
                const refreshId = slug || property.slug || property.id.toString();
                await fetchPropertyDetails(refreshId);
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {buildings.map((building: any) => {
                const isEditing = editingSections.has('buildings');
                const editBuildingData = editValues['buildings']?.buildings?.find((b: any) => b.id === building.id);
                const displayImageUrl = isEditing && editBuildingData ? editBuildingData.image_url : building.image_url;
                
                return (
                  <div key={building.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
                    {isEditing ? (
                      <div className="p-4">
                        <FileUpload
                          label={`${building.name} - Building Image`}
                          accept="image/*"
                          category="image"
                          currentUrl={editBuildingData?.image_url || ''}
                          onUploadComplete={(url) => {
                            const buildings = editValues['buildings']?.buildings || [];
                            const updatedBuildings = buildings.map((b: any) => 
                              b.id === building.id ? { ...b, image_url: url } : b
                            );
                            updateEditValue('buildings', 'buildings', updatedBuildings);
                          }}
                        />
                      </div>
                    ) : displayImageUrl ? (
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Location & Nearby */}
        {(property.area || (property as any).coordinates || (property as any).coordinates_text || property.website || mapPoints.length > 0 || editingSections.has('location')) && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <SectionHeader
              title="Location & Nearby"
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
                
                const { error } = await baseClient
                  .from('properties')
                  .update(updates)
                  .eq('id', property.id);
                if (error) throw error;
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
                      {property.area}
                      {property.city && `, ${property.city}`}
                      {property.country && `, ${property.country}`}
                    </p>
                  </div>
                  {((property as any).coordinates || (property as any).coordinates_text) && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Coordinates</p>
                      <p className="text-black dark:text-white font-mono text-xs">{(property as any).coordinates || (property as any).coordinates_text}</p>
                    </div>
                  )}
                  {property.website && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Website</p>
                      <a 
                        href={property.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {property.website}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
            {mapPoints.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">Nearby Locations</p>
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
              </div>
            )}
          </div>
        )}

        {/* Payment Plans */}
        {paymentPlans.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Payment Plans</h2>
            <div className="space-y-4">
              {paymentPlans.map((plan: any) => (
                <div key={plan.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2 text-black dark:text-white">{plan.plan_name || plan.name}</h3>
                  {plan.months_after_handover !== null && plan.months_after_handover > 0 && (
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">{plan.months_after_handover} months after handover</p>
                  )}
                  {plan.values && plan.values.length > 0 && (
                    <div className="space-y-1">
                      {plan.values.map((value: any) => (
                        <div key={value.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                          <span className="w-4 h-4 rounded-full border border-gray-300 dark:border-zinc-800 flex items-center justify-center text-[10px]">
                            {value.sequence}
                          </span>
                          {value.name || value.value_raw}
                        </div>
                      ))}
                    </div>
                  )}
                  {plan.payments && Array.isArray(plan.payments) && plan.payments.length > 0 && (
                    <div className="space-y-1">
                      {plan.payments.map((payment: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                          <span className="w-4 h-4 rounded-full border border-gray-300 dark:border-zinc-800 flex items-center justify-center text-[10px]">
                            {payment.step || index + 1}
                          </span>
                          {payment.description || payment.name}
                </div>
              ))}
          </div>
        )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Developer Info */}
        {developer && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Developer</h2>
            <div className="space-y-2 text-xs">
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
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PropertyDetailsPage;

