import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';

// --- IMPORT API_URL FROM CONFIG ---
import { API_URL } from '../config';

export default function CompeteScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSport, setSelectedSport] = useState("All");

  useFocusEffect(
    useCallback(() => {
      fetchTournaments();
    }, [])
  );

  const fetchTournaments = async () => {
    try {
      const res = await axios.get(`${API_URL}/tournaments`);
      const data = res.data;
      setTournaments(data);

      if (data.length > 0) {
        const allCities = [...new Set(data.map((t: any) => t.city.trim().toUpperCase()))];
        setCities(allCities as any);
        if (!allCities.includes(selectedCity) && allCities.length > 0) setSelectedCity(allCities[0]);
      }
    } catch (error) {
      console.log("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTournaments();
    setRefreshing(false);
  };

  const cityFiltered = tournaments.filter((t: any) => t.city.trim().toUpperCase() === selectedCity);
  const availableSports = ["All", ...new Set(cityFiltered.map((t: any) => t.sport))];
  const finalList = selectedSport === "All" ? cityFiltered : cityFiltered.filter((t: any) => t.sport === selectedSport);

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <View style={styles.blueHeader}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 10}}>
            <TouchableOpacity onPress={() => router.back()} style={{marginRight: 10}}>
              <Feather name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
            <View>
                <Text style={styles.headerTitle}>EVENTS</Text>
                <Text style={styles.headerSubtitle}>SELECT A LEAGUE</Text>
            </View>
          </View>
          
          {!loading && tournaments.length > 0 && (
            <View style={{marginTop: 5}}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                {cities.map(city => (
                  <TouchableOpacity 
                    key={city} 
                    onPress={() => { setSelectedCity(city); setSelectedSport("All"); }}
                    style={[styles.cityPill, selectedCity === city ? styles.cityActive : styles.cityInactive]}
                  >
                    <Text style={[styles.cityText, selectedCity === city ? {color:'#2563eb'} : {color:'#bfdbfe'}]}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {availableSports.map((sport: any) => (
                  <TouchableOpacity 
                    key={sport} 
                    onPress={() => setSelectedSport(sport)}
                    style={[styles.sportPill, selectedSport === sport ? styles.sportActive : styles.sportInactive]}
                  >
                    <Text style={[styles.sportText, selectedSport === sport ? {color:'#1e3a8a'} : {color:'#bfdbfe'}]}>{sport}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{marginTop: 50}} />
        ) : tournaments.length === 0 ? (
          <View style={{alignItems:'center', marginTop: 100, opacity:0.6}}>
             <Feather name="calendar" size={50} color="#cbd5e1" style={{marginBottom:15}}/>
             <Text style={{color:'#94a3b8', fontWeight:'bold', fontSize: 16}}>No active tournaments.</Text>
             <Text style={{color:'#cbd5e1', fontSize: 12, marginTop: 5}}>Check back later for new leagues.</Text>
          </View>
        ) : finalList.length === 0 ? (
           <Text style={{textAlign:'center', color:'#9ca3af', marginTop:20}}>No events found.</Text>
        ) : (
          finalList.map((t: any) => (
            <TouchableOpacity 
                key={t.id} 
                style={styles.card} 
                onPress={() => router.push(`/tournament/${t.id}`)} 
                activeOpacity={0.9}
            >
              <View style={{flex:1}}>
                <View style={{flexDirection:'row', marginBottom:5}}>
                  <Text style={styles.badgeBlue}>{t.type}</Text>
                  <Text style={styles.badgeYellow}>{t.sport}</Text>
                </View>
                <Text style={styles.cardTitle}>{t.name}</Text>
                <Text style={styles.cardSub}> {t.city} • Starts from ₹{t.fee}</Text>
              </View>
              <View style={styles.arrowBox}>
                <Feather name="chevron-right" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* BOTTOM NAV - FIXED ICON */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={{alignItems:'center'}} onPress={() => router.push('/')}>
            <Feather name="home" size={24} color="#9ca3af" />
            <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{alignItems:'center'}}>
            <FontAwesome5 name="trophy" size={22} color="#2563eb" />
            <Text style={[styles.navLabel, {color:'#2563eb'}]}>Compete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{alignItems:'center'}} onPress={() => router.push('/profile')}>
            <Feather name="user" size={24} color="#9ca3af" />
            <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blueHeader: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingBottom: 15, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  headerSubtitle: { color: '#bfdbfe', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginTop: 2 },
  cityPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, marginRight: 8 },
  cityActive: { backgroundColor: 'white' },
  cityInactive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  cityText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  sportPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  sportActive: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  sportInactive: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'transparent' },
  sportText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 20, marginBottom: 15, flexDirection:'row', alignItems:'center', shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#1f2937', fontStyle:'italic' },
  cardSub: { fontSize: 11, color: '#9ca3af', fontWeight: 'bold', marginTop: 4 },
  badgeBlue: { backgroundColor: '#eff6ff', color: '#2563eb', fontSize: 8, fontWeight:'bold', paddingHorizontal: 6, paddingVertical:2, borderRadius: 4, overflow:'hidden', marginRight: 5, textTransform:'uppercase' },
  badgeYellow: { backgroundColor: '#fefce8', color: '#a16207', fontSize: 8, fontWeight:'bold', paddingHorizontal: 6, paddingVertical:2, borderRadius: 4, overflow:'hidden', textTransform:'uppercase' },
  arrowBox: { backgroundColor: '#f9fafb', padding: 8, borderRadius: 50 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#f3f4f6', position:'absolute', bottom:0, width:'100%' },
  navLabel: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af', marginTop: 4 }
});