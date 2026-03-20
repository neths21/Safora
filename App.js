import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { shareRideStarted, shareEmergencyAlert, shareRideComplete } from './services/shareService';

export default function App() {
  const [status, setStatus] = useState('Starting SMS test...');

  useEffect(() => {
    const runTest = async () => {
      try {
        // Test 1 — share ride started
        setStatus('Testing shareRideStarted...');
        await shareRideStarted('testUser123', 'Chennai Central');
        console.log('Test 1 PASSED — Ride started SMS');
        setStatus('Ride started SMS sent! Check your phone.');

        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Test 2 — share emergency alert
        setStatus('Testing shareEmergencyAlert...');
        await shareEmergencyAlert('testUser123', 12.9716, 77.5946);
        console.log('Test 2 PASSED — Emergency SMS');
        setStatus('Emergency SMS sent! Check your phone.');

        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Test 3 — share ride complete
        setStatus('Testing shareRideComplete...');
        await shareRideComplete('testUser123');
        console.log('Test 3 PASSED — Ride complete SMS');
        setStatus('All SMS tests passed!');

      } catch (error) {
        console.log('FAILED:', error.message);
        setStatus('Error: ' + error.message);
      }
    };

    runTest();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SAFORA SMS Test</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  status: { fontSize: 16, textAlign: 'center', color: '#666' },
});