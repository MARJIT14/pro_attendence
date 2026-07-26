/**
 * Geo-fence configuration loaded from environment variables.
 * All coordinates use the Haversine formula for distance calculation.
 * Supports dynamic teacher location override (from DB) per session.
 */

const geoConfig = {
  classroom: {
    lat: parseFloat(process.env.GEO_LATITUDE) || 27.7172,
    lng: parseFloat(process.env.GEO_LONGITUDE) || 85.3240,
    radiusMeters: parseFloat(process.env.GEO_RADIUS_METERS) || 50,
  },
};

/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if a student's GPS location is within the classroom geo-fence.
 * Accepts optional teacherLocation (from DB) to override env defaults.
 *
 * @param {number} studentLat
 * @param {number} studentLng
 * @param {Object} [teacherLocation] - { lat, lng } from teacher's saved location
 * @returns {{ allowed: boolean, distance: number, maxDistance: number, center: { lat: number, lng: number } }}
 */
function checkGeoFence(studentLat, studentLng, teacherLocation) {
  // Use teacher's dynamic location if available, otherwise fall back to env defaults
  const lat = teacherLocation?.lat ?? geoConfig.classroom.lat;
  const lng = teacherLocation?.lng ?? geoConfig.classroom.lng;
  const radiusMeters = geoConfig.classroom.radiusMeters;

  const distance = haversineDistance(lat, lng, studentLat, studentLng);
  return {
    allowed: distance <= radiusMeters,
    distance: Math.round(distance),
    maxDistance: radiusMeters,
    center: { lat, lng },
  };
}

module.exports = { geoConfig, checkGeoFence };
