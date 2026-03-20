import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";

import { startRide, stopRide } from "../services/rideService";
import RideMapView from "./RideMapView";
import { geocodeAddress } from "../services/geocodingService";

export default function RideScreen({ navigation, route }) {
  const { pickup, destination, vehicleNumber, startTime, startDate, userId } =
    route.params;

  const [elapsedTime, setElapsedTime] = useState(0);
  const [rideStarted, setRideStarted] = useState(false);

  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);

  // ⏱ Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 🚗 Start ride
  useEffect(() => {
    handleStartRide();
  }, []);

  const handleStartRide = async () => {
    try {
      await startRide(userId, destination);
      setRideStarted(true);
    } catch (error) {
      Alert.alert("Error", "Ride failed to start");
    }
  };

  // 📍 Convert addresses → coordinates
  useEffect(() => {
    const convertAddresses = async () => {
      try {
        const pickupC = await geocodeAddress(pickup);
        const destC = await geocodeAddress(destination);

        setPickupCoords(pickupC);
        setDestinationCoords(destC);
      } catch (e) {
        Alert.alert("Error", "Could not find location");
      }
    };

    convertAddresses();
  }, []);

  const handleEndRide = () => {
    Alert.alert("End Ride", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Ride",
        onPress: async () => {
          await stopRide(userId);

          navigation.navigate("Completion", {
            pickup,
            destination,
            vehicleNumber,
            userId,
            duration: formatTime(elapsedTime),
          });
        },
      },
    ]);
  };

  const handleSOS = () => {
    navigation.navigate("Emergency", {
      pickup,
      destination,
      vehicleNumber,
      userId,
    });
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <Text style={styles.status}>🟢 RIDE IN PROGRESS</Text>
        <Text style={styles.title}>🚗 Ride Tracker</Text>
        <Text style={styles.date}>{startDate}</Text>

        <View style={styles.mapContainer}>
          {pickupCoords && destinationCoords ? (
            <RideMapView
              pickup={pickupCoords}
              destination={destinationCoords}
            />
          ) : (
            <Text>Loading map...</Text>
          )}
        </View>

        <View style={styles.durationCard}>
          <Text style={styles.durationLabel}>DURATION</Text>
          <Text style={styles.duration}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.started}>Started at {startTime}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ride Details</Text>

          <Text style={styles.label}>📍 Pickup</Text>
          <Text style={styles.value}>{pickup}</Text>

          <Text style={styles.label}>🏁 Destination</Text>
          <Text style={styles.value}>{destination}</Text>

          <Text style={styles.label}>🚘 Vehicle</Text>
          <Text style={styles.vehicle}>{vehicleNumber}</Text>
        </View>

        <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
          <Text style={styles.sosText}>🚨 SOS EMERGENCY</Text>
          <Text style={styles.sosSub}>Tap for immediate help</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endBtn} onPress={handleEndRide}>
          <Text style={styles.endText}>✔ End Ride Safely</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f0f5" },
  container: { flex: 1, padding: 16 },

  status: { color: "green", fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  date: { color: "#888", marginBottom: 10 },

  mapContainer: {
    height: 200,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 12,
  },

  durationCard: {
    backgroundColor: "#d81b60",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  durationLabel: { color: "#fff", fontSize: 12 },
  duration: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  started: { color: "#fff", fontSize: 12 },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 15,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: "700", marginBottom: 8 },

  label: { color: "#888", marginTop: 6 },
  value: { fontSize: 14 },
  vehicle: { fontWeight: "bold", color: "#d81b60" },

  sosBtn: {
    backgroundColor: "#e53935",
    padding: 18,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  sosText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  sosSub: { color: "#fff", fontSize: 12 },

  endBtn: {
    borderWidth: 2,
    borderColor: "#d81b60",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
  },
  endText: { color: "#d81b60", fontWeight: "bold" },
});