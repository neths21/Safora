import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

const RideMapView = ({ pickup, destination, routeLine, currentLocation }) => {
  if (!pickup || !destination) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#d81b60" />
        <Text>Loading map...</Text>
      </View>
    );
  }

  // ✅ Convert routeLine → Leaflet format
  const routeCoords = routeLine
    ? routeLine.map(p => `[${p.latitude}, ${p.longitude}]`).join(",")
    : "";

  const userMarker = currentLocation
    ? `
      var userMarker = L.marker([${currentLocation.latitude}, ${currentLocation.longitude}], {
        icon: L.icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
          iconSize: [30, 30]
        })
      }).addTo(map).bindPopup("You");
    `
    : "";

  const mapHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <style>
      html, body, #map { height:100%; margin:0; }
    </style>
  </head>

  <body>
    <div id="map"></div>

    <script>
      var map = L.map('map').setView([${pickup.latitude}, ${pickup.longitude}], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      // Pickup marker
      L.marker([${pickup.latitude}, ${pickup.longitude}])
        .addTo(map)
        .bindPopup("Pickup");

      // Destination marker
      L.marker([${destination.latitude}, ${destination.longitude}])
        .addTo(map)
        .bindPopup("Destination");

      // ✅ REAL ROUTE
      var route = [${routeCoords}];
      if (route.length > 0) {
        var polyline = L.polyline(route, {
          color: '#d81b60',
          weight: 5
        }).addTo(map);

        map.fitBounds(polyline.getBounds());
      }

      // ✅ USER MARKER
      ${userMarker}

    </script>
  </body>
  </html>
  `;

  return (
    <View style={styles.container}>
      <WebView source={{ html: mapHTML }} style={{ flex: 1 }} />
    </View>
  );
};

export default RideMapView;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});