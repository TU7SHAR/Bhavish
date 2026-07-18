// Simple geocoding using OpenStreetMap Nominatim (free, no API key needed)
export async function geocodePlace(place) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "BhavishAI/1.0 (astrology report generator)",
        },
      }
    );

    const data = await response.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      return {
        latitude: lat,
        longitude: lon,
        displayName: data[0].display_name,
        // Determine timezone offset: use IST for India (most common case),
        // otherwise estimate from longitude (Local Mean Time).
        timezoneOffsetMinutes: isIndianCoordinates(lat, lon) ? 330 : null,
      };
    }

    // Fallback: some common Indian cities (all IST +5:30 = 330 minutes)
    const fallbackCities = {
      "mumbai": { latitude: 19.076, longitude: 72.8777 },
      "delhi": { latitude: 28.6139, longitude: 77.209 },
      "bangalore": { latitude: 12.9716, longitude: 77.5946 },
      "chennai": { latitude: 13.0827, longitude: 80.2707 },
      "kolkata": { latitude: 22.5726, longitude: 88.3639 },
      "hyderabad": { latitude: 17.385, longitude: 78.4867 },
      "pune": { latitude: 18.5204, longitude: 73.8567 },
      "chandigarh": { latitude: 30.7333, longitude: 76.7794 },
      "jaipur": { latitude: 26.9124, longitude: 75.7873 },
      "lucknow": { latitude: 26.8467, longitude: 80.9462 },
      "ahmedabad": { latitude: 23.0225, longitude: 72.5714 },
    };

    const lower = place.toLowerCase();
    for (const [city, coords] of Object.entries(fallbackCities)) {
      if (lower.includes(city)) return { ...coords, displayName: place, timezoneOffsetMinutes: 330 };
    }

    // Default to Delhi if nothing matches (IST)
    return { latitude: 28.6139, longitude: 77.209, displayName: place, timezoneOffsetMinutes: 330 };
  } catch (error) {
    console.error("Geocoding error:", error);
    // Default fallback (Delhi, IST)
    return { latitude: 28.6139, longitude: 77.209, displayName: place, timezoneOffsetMinutes: 330 };
  }
}

/**
 * Checks if coordinates fall within the Indian subcontinent bounding box.
 * Used to apply IST (+5:30) precisely for Indian locations rather than
 * falling back to longitude-based LMT estimation.
 */
function isIndianCoordinates(lat, lon) {
  // India bounding box (generous to include border areas):
  // Latitude: 6°N to 37°N, Longitude: 68°E to 97°E
  return lat >= 6 && lat <= 37 && lon >= 68 && lon <= 97;
}
