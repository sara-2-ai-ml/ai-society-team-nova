import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getHealth } from '../services/api';

export default function HomeScreen() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    getHealth()
      .then((res) => setStatus(res.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Team Nova</Text>
      <Text>API: {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
});
