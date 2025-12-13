import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PropertyDetails } from '../../types/database.types';

const PropertyDetailsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [details, setDetails] = useState<PropertyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
      const propertyQuery = supabase
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
          ? supabase.from('partner_developers').select('*').eq('id', property.developer_id).single()
          : Promise.resolve({ data: null }),
        
        // Images
        supabase.from('property_images').select('*').eq('property_id', property.id).order('category'),
        
        // Unit blocks
        supabase.from('property_unit_blocks').select('*').eq('property_id', property.id),
        
        // Buildings
        supabase.from('property_buildings').select('*').eq('property_id', property.id),
        
        // Facilities
        supabase
          .from('property_facilities')
          .select('*, facilities(*)')
          .eq('property_id', property.id),
        
        // Map points
        supabase.from('property_map_points').select('*').eq('property_id', property.id),
        
        // Payment plans
        supabase.from('property_payment_plans').select('*').eq('property_id', property.id),
      ]);

      // Fetch payment plan values
      const paymentPlansWithValues = await Promise.all(
        (paymentPlans || []).map(async (plan) => {
          const { data: values } = await supabase
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

      // Set first image as selected
      if (images && images.length > 0) {
        setSelectedImage(images[0].image_url);
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
  const displayImages = images && images.length > 0 ? images : (property.cover_url ? [{ id: -1, image_url: property.cover_url, category: 'cover' }] : []);
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
        {/* Property Header */}
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

        {/* Images Gallery */}
        {hasImages && (
          <div className="mb-8">
            <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden mb-4">
              <img
                src={selectedImage || displayImages[0].image_url}
                alt={property.name}
                className="w-full h-96 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            {displayImages.length > 1 && (
              <div className="grid grid-cols-6 gap-2">
                {displayImages.slice(0, 6).map((img) => (
                  <button
                    key={img.id}
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
          </div>
        )}

        {/* Location & Contact */}
        <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
          <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Location & Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Location</p>
              <p className="text-black dark:text-white">
                {property.area}
                {property.city && `, ${property.city}`}
                {property.country && `, ${property.country}`}
              </p>
            </div>
            {property.coordinates && (
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Coordinates</p>
                <p className="text-black dark:text-white font-mono text-xs">{property.coordinates}</p>
              </div>
            )}
            {property.website && (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Website</p>
                <a 
                  href={property.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {property.website}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Details */}
        {(property.min_price || property.max_price || property.min_area || property.max_area) && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Pricing Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
            </div>
          </div>
        )}

        {/* Project Status */}
        {(property.sale_status || (property as any).permit_id) && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Project Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {property.sale_status && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Sale Status</p>
                  <p className="text-black dark:text-white">{property.sale_status}</p>
                </div>
              )}
              {(property as any).permit_id && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">RERA Number / Permit ID</p>
                  <p className="text-black dark:text-white font-mono">{(property as any).permit_id}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buyer Protection */}
        {(property.has_escrow || property.post_handover) && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Buyer Protection</h2>
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
          </div>
        )}

        {/* Parking Specifications */}
        {((property as any).parking || property.parking_specs) && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Parking Specifications</h2>
            <p className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-line">{(property as any).parking || property.parking_specs}</p>
          </div>
        )}

        {/* Media & Documents */}
        {(property.video_url || property.brochure_url || property.layouts_pdf) && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Media & Documents</h2>
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
          </div>
        )}

        {/* Overview */}
        {property.overview && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Overview</h2>
            <div 
              className="text-sm text-gray-700 dark:text-zinc-400 leading-relaxed prose prose-sm max-w-none dark:prose-invert
                prose-headings:text-black dark:prose-headings:text-white prose-headings:font-medium prose-headings:text-sm
                prose-p:text-gray-700 dark:prose-p:text-zinc-400 prose-p:leading-relaxed
                prose-ul:text-gray-700 dark:prose-ul:text-zinc-400 prose-ul:list-disc prose-ul:ml-4
                prose-li:text-gray-700 dark:prose-li:text-zinc-400 prose-li:marker:text-gray-500 dark:prose-li:marker:text-zinc-600
                prose-strong:text-black dark:prose-strong:text-white prose-strong:font-medium"
              dangerouslySetInnerHTML={{ 
                __html: property.overview
                  .replace(/#{5}\s+(.*?)(\n|$)/g, '<h5 class="font-medium text-white mt-4 mb-2">$1</h5>')
                  .replace(/#{4}\s+(.*?)(\n|$)/g, '<h4 class="font-medium text-white mt-4 mb-2">$1</h4>')
                  .replace(/#{3}\s+(.*?)(\n|$)/g, '<h3 class="font-medium text-white mt-4 mb-2">$1</h3>')
                  .replace(/#{2}\s+(.*?)(\n|$)/g, '<h2 class="font-medium text-white mt-4 mb-2">$1</h2>')
                  .replace(/#{1}\s+(.*?)(\n|$)/g, '<h1 class="font-medium text-white mt-4 mb-2">$1</h1>')
                  .replace(/\\\*/g, '•')
                  .replace(/\n\n/g, '</p><p class="mt-3">')
                  .replace(/\n/g, '<br/>')
                  .replace(/^/, '<p>')
                  .replace(/$/, '</p>')
              }}
            />
          </div>
        )}

        {/* Unit Types */}
        {unitBlocks.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Unit Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unitBlocks.map((unit) => (
                <div key={unit.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2 text-black dark:text-white">{unit.unit_bedrooms}</h3>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-zinc-400">
                    {unit.units_area_from_m2 && (
                      <p>Area: {unit.units_area_from_m2} - {unit.units_area_to_m2} m²</p>
                    )}
                    {unit.units_price_from && (
                      <p>Price: {formatPrice(unit.units_price_from)} - {formatPrice(unit.units_price_to)}</p>
                    )}
                    {unit.units_amount && <p>Units: {unit.units_amount}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Facilities */}
        {facilities.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Facilities & Amenities</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {facilities.map((facility) => (
                <div key={facility.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {facility.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buildings */}
        {buildings.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Buildings</h2>
            <div className="space-y-3">
              {buildings.map((building) => (
                <div key={building.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-1 text-black dark:text-white">{building.name}</h3>
                  {building.description && (
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mb-2">{building.description}</p>
                  )}
                  {building.completion_date && (
                    <p className="text-xs text-gray-500 dark:text-zinc-500">Completion: {new Date(building.completion_date).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Plans */}
        {paymentPlans.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Payment Plans</h2>
            <div className="space-y-4">
              {paymentPlans.map((plan) => (
                <div key={plan.id} className="border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2 text-black dark:text-white">{plan.name}</h3>
                  {plan.values.length > 0 && (
                    <div className="space-y-1">
                      {plan.values.map((value) => (
                        <div key={value.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                          <span className="w-4 h-4 rounded-full border border-gray-300 dark:border-zinc-800 flex items-center justify-center text-[10px]">
                            {value.sequence}
                          </span>
                          {value.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map Points */}
        {mapPoints.length > 0 && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
            <h2 className="text-sm font-medium mb-4 text-black dark:text-white">Nearby Locations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mapPoints.map((point) => (
                <div key={point.id} className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-zinc-400">{point.name}</span>
                  <span className="text-gray-500 dark:text-zinc-500">{point.distance_km} km</span>
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

        {/* Additional Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6">
          {property.service_charge && (
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Service Charge</p>
              <p className="text-sm text-black dark:text-white">{property.service_charge}</p>
            </div>
          )}
          {property.furnishing && (
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Furnishing</p>
              <p className="text-sm text-black dark:text-white">{property.furnishing}</p>
            </div>
          )}
          {property.completion_datetime && (
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Completion</p>
              <p className="text-sm text-black dark:text-white">{new Date(property.completion_datetime).toLocaleDateString()}</p>
            </div>
          )}
          {property.readiness !== null && (
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Readiness</p>
              <p className="text-sm text-black dark:text-white">{property.readiness}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailsPage;

