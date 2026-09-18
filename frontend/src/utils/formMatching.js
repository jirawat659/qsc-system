/**
 * Helper utility to determine whether a SurveyForm is applicable to a given Location.
 * Criteria:
 * 1. TargetingMode: If SPECIFIC_LOCATIONS, location.id must be in targetLocationIds.
 * 2. Location Type: Form's locationTypeId must match location's locationTypeId.
 * 3. Brand: If form has brands specified, location must have at least one matching brand.
 *    If form has no brands specified, it is considered a Global Form for that Location Type.
 */

export function isFormApplicableToLocation(form, location) {
  if (!form || !location) return false;

  // 1. Specific Locations check
  if (form.targetingMode === "SPECIFIC_LOCATIONS") {
    const targetIds = Array.isArray(form.targetLocationIds) ? form.targetLocationIds : [];
    if (!targetIds.map(Number).includes(Number(location.id))) {
      return false;
    }
  }

  // 2. Location Type check (e.g. Store, Plant, Warehouse, Cloud Kitchen, Headquarters)
  const formTypeId = form.locationTypeId;
  const locTypeId = location.locationTypeId || location.locationType?.id;
  if (formTypeId && locTypeId && Number(formTypeId) !== Number(locTypeId)) {
    return false;
  }

  // 3. Brand(s) check
  const formBrandIds = (form.brandIds && Array.isArray(form.brandIds) && form.brandIds.length > 0)
    ? form.brandIds.map(Number)
    : (form.brandId ? [Number(form.brandId)] : []);

  const formBrandNames = (form.brandNames && Array.isArray(form.brandNames) && form.brandNames.length > 0)
    ? form.brandNames.map(b => String(b).toLowerCase().trim())
    : (form.brandName ? [String(form.brandName).toLowerCase().trim()] : []);

  // Global form for this location type (no brand restriction)
  if (formBrandIds.length === 0 && formBrandNames.length === 0) {
    return true;
  }

  // Extract location's brands
  const locBrandIds = [];
  const locBrandNames = [];

  if (location.locationBrands && Array.isArray(location.locationBrands)) {
    location.locationBrands.forEach(lb => {
      const bId = lb.brandId || lb.brand?.id;
      if (bId) locBrandIds.push(Number(bId));
      const bName = lb.brand?.name || lb.brandName;
      if (bName) locBrandNames.push(String(bName).toLowerCase().trim());
      const bCode = lb.brand?.code;
      if (bCode) locBrandNames.push(String(bCode).toLowerCase().trim());
    });
  }

  if (location.brandId) locBrandIds.push(Number(location.brandId));
  if (location.brand?.id) locBrandIds.push(Number(location.brand.id));
  if (location.brand?.name) locBrandNames.push(String(location.brand.name).toLowerCase().trim());

  // Match by Brand ID
  if (locBrandIds.some(lId => formBrandIds.includes(lId))) {
    return true;
  }

  // Match by Brand Name / Code
  if (locBrandNames.some(lName => formBrandNames.includes(lName))) {
    return true;
  }

  return false;
}
