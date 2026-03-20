/**
 * RideScreen.js — OSM + Leaflet (NO Google Maps)
 */

import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

import useLocationTracking from "../hooks/useLocationTracking";
import { fetchRoute } from "../services/routeService";
import { detectDeviation } from "../services/deviationService";
import { getActiveRideId } from "../services/rideService";

const DEVIATION_CHECK_INTERVAL_MS = 5000;

const RideMapView = ({ destination }) => {
  const { currentLocation, isTracking, error: locationError } = useLocationTracking();

  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [deviationDetected, setDeviationDetected] = useState(false);

  const routeCoordsRef = useRef([]);
  const deviationIntervalRef = useRef(null);

  // 🚀 Load route from OSRM
  useEffect(() => {
    const loadRoute = async () => {
      if (!currentLocation || !destination) return;

      setRouteLoading(true);
      try {
        const coords = await fetchRoute(currentLocation, destination);
        setRouteCoords(coords);
        routeCoordsRef.current = coords;
      } catch (err) {
        setRouteError("Failed to load route");
      } finally {
        setRouteLoading(false);
      }
    };

    loadRoute();
  }, [currentLocation, destination]);

  // 🚨 Deviation detection loop
  useEffect(() => {
    if (!isTracking || routeCoords.length === 0) return;

    const interval = setInterval(async () => {
      const userId = await getActiveRideId();

      const { deviated } = await detectDeviation(
        userId,
        currentLocation,
        routeCoordsRef.current
      );

      setDeviationDetected(deviated);
    }, DEVIATION_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isTracking, routeCoords]);

  // 🌍 Convert route to Leaflet format
  const leafletRoute = routeCoords
    .map(coord => `[${coord.latitude}, ${coord.longitude}]`)
    .join(",");

  if (!currentLocation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text>
          {locationError ? locationError : "Getting location..."}
        </Text>
      </View>
    );
  }

  // 🌍 Leaflet HTML
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
      var map = L.map('map').setView([${currentLocation.latitude}, ${currentLocation.longitude}], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      // User Marker
      L.marker([${currentLocation.latitude}, ${currentLocation.longitude}])
        .addTo(map)
        .bindPopup("You");

      // Destination
      ${destination ? `
        L.marker([${destination.latitude}, ${destination.longitude}])
          .addTo(map)
          .bindPopup("Destination");
      ` : ""}

      // Route
      ${routeCoords.length > 0 ? `
        var route = [${leafletRoute}];
        L.polyline(route, {
          color: "${deviationDetected ? "red" : "blue"}",
          weight: 5,
          dashArray: ${deviationDetected ? "'8,6'" : "null"}
        }).addTo(map);
      ` : ""}
    </script>
  </body>
  </html>
  `;

  return (
    <View style={styles.container}>
      <WebView source={{ html: mapHTML }} />
      
      {routeLoading && (
        <View style={styles.overlay}>
          <Text>Loading route...</Text>
        </View>
      )}

      {deviationDetected && (
        <View style={[styles.overlay, { backgroundColor: "red" }]}>
          <Text style={{ color: "white" }}>⚠ Off Route</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex:1, justifyContent:"center", alignItems:"center" },
  overlay: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "black",
    padding: 10,
    borderRadius: 10
  }
});

export default RideMapView;