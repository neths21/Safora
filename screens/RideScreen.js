/**
 * RideScreen.js — MAP SECTION (Person 2's responsibility)
 *
 * Renders:
 *   - Live user location marker
 *   - Route polyline from current location → destination
 *   - Deviation detection running in the background
 *
 * Integrates:
 *   - useLocationTracking() hook
 *   - routeService (OSRM)
 *   - deviationService
 *
 * NOTE: UI/styling outside map scope is handled by Person 1.
 *       This file exports only the map-related portion as <RideMapView>.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import useLocationTracking from "../hooks/useLocationTracking";
import { fetchRoute } from "../services/routeService";
import { detectDeviation } from "../services/deviationService";
import { getActiveRideId } from "../services/rideService"; // Teammate's function

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// How often to run deviation checks (ms)
const DEVIATION_CHECK_INTERVAL_MS = 5000;

// Default map delta (zoom level)
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = 0.01;

// ─────────────────────────────────────────────
// RideMapView Component
// ─────────────────────────────────────────────

/**
 * RideMapView
 * The map component for an active ride. Plug this into the full RideScreen layout.
 *
 * @param {{ destination: { latitude: number, longitude: number } }} props
 */
const RideMapView = ({ destination }) => {
  // Location tracking from custom hook
  const { currentLocation, isTracking, error: locationError } = useLocationTracking();

  // Route polyline state
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Deviation status
  const [deviationDetected, setDeviationDetected] = useState(false);

  // Refs
  const mapRef = useRef(null);
  const deviationIntervalRef = useRef(null);
  const routeCoordsRef = useRef([]); // Keep latest coords accessible inside interval

  // ─── Fetch Route ───────────────────────────

  /**
   * loadRoute
   * Called once we have a valid currentLocation and destination.
   * Fetches the driving route from OSRM and stores it in state.
   */
  const loadRoute = useCallback(async () => {
    if (!currentLocation || !destination) return;

    setRouteLoading(true);
    setRouteError(null);

    try {
      const coords = await fetchRoute(currentLocation, destination);
      setRouteCoords(coords);
      routeCoordsRef.current = coords;
      console.log("[RideMapView] Route loaded:", coords.length, "waypoints");
    } catch (err) {
      console.error("[RideMapView] Route fetch failed:", err);
      setRouteError("Could not load route. Check connection.");
    } finally {
      setRouteLoading(false);
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, destination]);

  // Fetch route when location first becomes available
  useEffect(() => {
    if (currentLocation && destination && routeCoords.length === 0) {
      loadRoute();
    }
  }, [currentLocation, destination]);

  // ─── Deviation Detection Loop ──────────────

  /**
   * Start deviation detection interval once route is loaded and tracking is active.
   * Cleans up on unmount or when ride ends.
   */
  useEffect(() => {
    if (!isTracking || routeCoords.length === 0) return;

    const runDeviationCheck = async () => {
      if (!currentLocation || routeCoordsRef.current.length === 0) return;

      try {
        const userId = await getActiveRideId();
        const { deviated, distanceFromRoute } = await detectDeviation(
          userId,
          currentLocation,
          routeCoordsRef.current
        );

        setDeviationDetected(deviated);

        if (deviated) {
          console.warn(
            `[RideMapView] ⚠️ Off-route by ${distanceFromRoute.toFixed(0)}m`
          );
        }
      } catch (err) {
        console.error("[RideMapView] Deviation check error:", err);
      }
    };

    // Start interval
    deviationIntervalRef.current = setInterval(
      runDeviationCheck,
      DEVIATION_CHECK_INTERVAL_MS
    );

    // Cleanup on tracking stop or unmount
    return () => {
      clearInterval(deviationIntervalRef.current);
      deviationIntervalRef.current = null;
    };
  }, [isTracking, routeCoords.length]);

  // Keep routeCoordsRef in sync
  useEffect(() => {
    routeCoordsRef.current = routeCoords;
  }, [routeCoords]);

  // ─── Camera: Follow user ───────────────────

  /**
   * Animate map camera to follow the user's current position.
   */
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        },
        500 // animation duration ms
      );
    }
  }, [currentLocation]);

  // ─── Render ────────────────────────────────

  // Show loader until we have a location
  if (!currentLocation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={styles.statusText}>
          {locationError ? `Location error: ${locationError}` : "Acquiring GPS..."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}           // OpenStreetMap via default provider
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        showsUserLocation={false}             // We render our own marker
        showsMyLocationButton={false}
      >
        {/* ── User Location Marker ── */}
        <Marker
          coordinate={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }}
          title="You"
          description={isTracking ? "Tracking active" : "Tracking paused"}
          pinColor={deviationDetected ? "#E53935" : "#1565C0"} // Red if deviated, blue otherwise
        />

        {/* ── Destination Marker ── */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Destination"
            pinColor="#2E7D32"
          />
        )}

        {/* ── Route Polyline ── */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={deviationDetected ? "#E53935" : "#1565C0"}
            strokeWidth={4}
            lineDashPattern={deviationDetected ? [8, 4] : undefined} // Dashed if deviated
          />
        )}
      </MapView>

      {/* ── Overlay Indicators ── */}

      {/* Route loading spinner */}
      {routeLoading && (
        <View style={styles.overlayBadge}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.overlayText}>Loading route…</Text>
        </View>
      )}

      {/* Route error */}
      {routeError && (
        <View style={[styles.overlayBadge, styles.errorBadge]}>
          <Text style={styles.overlayText}>{routeError}</Text>
        </View>
      )}

      {/* Deviation warning */}
      {deviationDetected && (
        <View style={[styles.overlayBadge, styles.deviationBadge]}>
          <Text style={styles.overlayText}>⚠️ Off Route — SOS Sent</Text>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    color: "#555",
  },
  overlayBadge: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  errorBadge: {
    backgroundColor: "rgba(183,28,28,0.85)",
  },
  deviationBadge: {
    backgroundColor: "rgba(183,28,28,0.92)",
  },
  overlayText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});

export default RideMapView;