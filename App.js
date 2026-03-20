import { useEffect } from 'react';
import * as Location from 'expo-location';
import RideMapView from './screens/RideScreen';

export default function App() {
  useEffect(() => {
    const requestBackgroundPermission = async () => {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Background location permission denied.');
      }
    };
    requestBackgroundPermission();
  }, []);

  return (
    <RideMapView
      destination={{ latitude: 13.0827, longitude: 80.2707 }}
    />
  );
}