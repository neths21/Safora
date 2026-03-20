export const geocodeAddress = async (address) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
      {
        headers: {
          "User-Agent": "safora-app", // ✅ REQUIRED
          "Accept": "application/json",
        },
      }
    );

    const text = await res.text();

    // DEBUG (optional)
    console.log("Geocode raw response:", text);

    const data = JSON.parse(text);

    if (!data || data.length === 0) {
      throw new Error("No results found");
    }

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.log("Geocoding error:", err);
    throw err;
  }
};