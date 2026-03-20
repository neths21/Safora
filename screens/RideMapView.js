import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

<<<<<<< HEAD
const RideMapView = ({ pickup, destination }) => {
=======
const RideMapView = ({ pickup, destination, routeLine, currentLocation }) => {
>>>>>>> f1501acb5f181edd6c028a68917f33a90c049a78
  if (!pickup || !destination) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#d81b60" />
        <Text>Loading map...</Text>
      </View>
    );
  }

<<<<<<< HEAD
=======
  const routeCoordsJS = JSON.stringify(routeLine || []);
  const currentLocJS = currentLocation
    ? `[${currentLocation.latitude}, ${currentLocation.longitude}]`
    : null;

>>>>>>> f1501acb5f181edd6c028a68917f33a90c049a78
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      // Pickup
      L.marker([${pickup.latitude}, ${pickup.longitude}]).addTo(map);

      // Destination
      L.marker([${destination.latitude}, ${destination.longitude}]).addTo(map);

      // ✅ ROUTE (REAL ROAD PATH)
      var route = ${routeCoordsJS};

      if (route.length > 0) {
        var latlngs = route.map(p => [p.latitude, p.longitude]);

        var polyline = L.polyline(latlngs, {
          color: '#d81b60',
          weight: 5
        }).addTo(map);

        map.fitBounds(polyline.getBounds());
      }

      // ✅ USER LOCATION
      var userMarker = null;

      function updateLocation(lat, lng) {
        if (userMarker) {
          userMarker.setLatLng([lat, lng]);
        } else {
          userMarker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
              iconSize: [30, 30]
            })
          }).addTo(map);
        }

        map.panTo([lat, lng]);
      }

      ${currentLocJS ? `updateLocation(${currentLocJS});` : ''}
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