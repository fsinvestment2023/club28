import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import axios from 'axios';

// Your Mac's IP (We keep this hardcoded for stability)
const API_URL = "http://192.168.29.43:8000";

export default function Dashboard() {
  const [serverStatus, setServerStatus] = useState("Checking...");

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await axios.get(`${API_URL}/`);
      setServerStatus("Online ✅");
    } catch (error) {
      // If we get a 404, it's still technically "Online" but path missing
      if (error.response && error.response.status === 404) {
         setServerStatus("Online (No Root) ⚠️");
      } else {
         setServerStatus("Offline ❌");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CLUB 28</Text>
          <Text style={styles.statusText}>{serverStatus}</Text>
        </View>

        <ScrollView style={styles.content}>
          
          {/* HERO SECTION */}
          <View style={styles.card}>
            <Text style={styles.cardIcon}>🏆</Text>
            <Text style={styles.cardText}>Not registered for any active event.</Text>
            <TouchableOpacity style={styles.blueButton} onPress={() => Alert.alert("Coming Soon", "Leagues feature coming soon!")}>
              <Text style={styles.buttonText}>FIND A LEAGUE</Text>
            </TouchableOpacity>
          </View>

          {/* UPDATES SECTION */}
          <Text style={styles.sectionTitle}>🔔 LATEST UPDATES</Text>
          <View style={styles.whiteCard}>
             <View style={styles.tabRow}>
               <Text style={[styles.tabText, styles.activeTab]}>PERSONAL</Text>
               <Text style={styles.tabText}>EVENT</Text>
               <Text style={styles.tabText}>COMMUNITY</Text>
             </View>
             <View style={styles.divider} />
             <Text style={styles.emptyState}>NO NEW UPDATES</Text>
          </View>

          {/* EARNINGS SECTION */}
          <Text style={styles.sectionTitle}>📈 EARNINGS TRACKER</Text>
          <View style={styles.greenCard}>
            <Text style={styles.earningsTitle}>TOTAL WINNINGS</Text>
            <Text style={styles.earningsAmount}>₹0</Text>
            <Text style={styles.earningsIcon}>🏆</Text>
          </View>

        </ScrollView>

        {/* BOTTOM NAV BAR */}
        <View style={styles.bottomNav}>
          <Text style={styles.navItem}>🏠 Home</Text>
          <Text style={styles.navItem}>⚔️ Compete</Text>
          <Text style={styles.navItem}>👤 Profile</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a1a', fontStyle: 'italic' },
  statusText: { fontSize: 12, color: 'gray' },
  content: { padding: 20 },
  
  // Cards
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 30, alignItems: 'center', marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardIcon: { fontSize: 40, marginBottom: 10 },
  cardText: { color: 'gray', marginBottom: 20 },
  blueButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },

  // Updates
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginBottom: 10, marginTop: 10, fontStyle: 'italic' },
  whiteCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 25, minHeight: 150 },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  tabText: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  activeTab: { color: '#2563eb', borderBottomWidth: 2, borderBottomColor: '#2563eb', paddingBottom: 5 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginBottom: 20 },
  emptyState: { textAlign: 'center', color: '#d1d5db', marginTop: 20 },

  // Earnings
  greenCard: { backgroundColor: '#10b981', borderRadius: 15, padding: 25, marginBottom: 50, position: 'relative', overflow: 'hidden' },
  earningsTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold', opacity: 0.9 },
  earningsAmount: { color: '#fff', fontSize: 36, fontWeight: '900', marginTop: 5 },
  earningsIcon: { position: 'absolute', right: -10, bottom: -10, fontSize: 80, opacity: 0.2 },

  // Bottom Nav
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  navItem: { fontSize: 12, color: '#4b5563', fontWeight: '600' }
});