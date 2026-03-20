import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

const RideMapView = ({ pickup, destination }) => {
  if (!pickup || !destination) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#d81b60" />
        <Text>Loading map...</Text>
      </View>
    );
  }

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

      // Pickup
      L.marker([${pickup.latitude}, ${pickup.longitude}])
        .addTo(map)
        .bindPopup("Pickup");

      // Destination
      L.marker([${destination.latitude}, ${destination.longitude}])
        .addTo(map)
        .bindPopup("Destination");

      // Line between them
      var latlngs = [
        [${pickup.latitude}, ${pickup.longitude}],
        [${destination.latitude}, ${destination.longitude}]
      ];

      L.polyline(latlngs, { color: '#d81b60', weight: 4 }).addTo(map);

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