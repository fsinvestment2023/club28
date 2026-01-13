import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- IMPORT API_URL FROM CONFIG (Two levels back) ---
import { API_URL } from '../../config';
import RazorpayCheckout from '../../components/RazorpayCheckout';

export default function RegistrationScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedLevel, setSelectedLevel] = useState<any>(null);
  const [partnerId, setPartnerId] = useState("");
  const [joining, setJoining] = useState(false);

  // PAYMENT STATE
  const [payModal, setPayModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const tid = await AsyncStorage.getItem("team_id");
      if(tid) {
        const userRes = await axios.get(`${API_URL}/user/${tid}`);
        setUser(userRes.data);
      }
      const res = await axios.get(`${API_URL}/tournaments`);
      const found = res.data.find((t: any) => t.id.toString() === id);
      setTournament(found);
      if (found && found.settings) {
        const cats = JSON.parse(found.settings);
        if (cats.length > 0) setSelectedLevel(cats[0]);
      }
    } catch (error) { console.log("Error loading data", error); } 
    finally { setLoading(false); }
  };

  const handleJoin = async (scope = 'INDIVIDUAL') => {
    if (!selectedLevel) return Alert.alert("Select a Level");
    if (tournament.format === "Doubles" && !partnerId) return Alert.alert("Partner Required", "Enter Partner Team ID");
    
    // ✅ FIXED FEE CALCULATION
    const isDoublesSplit = tournament.format === "Doubles" && scope === 'INDIVIDUAL';
    
    // IF SPLIT: Pay Base Fee (500)
    // IF TEAM: Pay Base Fee * 2 (1000)
    const feeToPay = isDoublesSplit ? parseInt(selectedLevel.fee) : (parseInt(selectedLevel.fee) * 2);

    // CHECK BALANCE
    if (user.wallet_balance < feeToPay) {
        const shortfall = feeToPay - user.wallet_balance;
        Alert.alert("Low Balance", `Add ₹${shortfall} to continue?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Add & Pay", onPress: () => initiateTopUp(shortfall) }
        ]);
        return;
    }

    setJoining(true);
    try {
      const payload = {
        phone: user.phone,
        tournament_name: tournament.name,
        city: tournament.city,
        sport: tournament.sport,
        level: selectedLevel.name,
        partner_team_id: partnerId.toUpperCase(),
        payment_mode: "WALLET",
        payment_scope: scope
      };
      const res = await axios.post(`${API_URL}/join-tournament`, payload);
      
      if (res.data.status === "pending_partner") {
        Alert.alert("Registered!", `We notified ${partnerId.toUpperCase()}. They must confirm payment.`, [{ text: "Close", onPress: () => router.push('/') }]);
      } else if (res.data.status === "joined") {
        Alert.alert("Success!", "Registration Complete!", [{ text: "OK", onPress: () => router.push('/') }]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.detail || "Join Failed");
    } finally {
      setJoining(false);
    }
  };

  const initiateTopUp = async (amount: number) => {
    try {
        const res = await axios.post(`${API_URL}/razorpay/create-order`, { amount: amount });
        setOrderDetails({
            ...res.data,
            description: `Entry Fee Top-up`,
            contact: user.phone,
            email: user.email || "player@example.com"
        });
        setPayModal(true);
    } catch (e) { Alert.alert("Error", "Payment Init Failed"); }
  };

  const handlePaymentSuccess = async (data: any) => {
    setPayModal(false);
    try {
        await axios.post(`${API_URL}/razorpay/verify-payment`, {
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_order_id: data.razorpay_order_id,
            razorpay_signature: data.razorpay_signature,
            team_id: user.team_id,
            amount: orderDetails ? (orderDetails as any).amount / 100 : 0
        });
        const userRes = await axios.get(`${API_URL}/user/${user.team_id}`);
        setUser(userRes.data);
        Alert.alert("Balance Updated", "Please click Pay again.");
    } catch (e) { Alert.alert("Failed", "Payment verification failed"); }
  };

  if (loading || !tournament) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb"/></View>;

  const categories = JSON.parse(tournament.settings || "[]");
  const schedule = JSON.parse(tournament.schedule || "[]");
  const isDoubles = tournament.format === "Doubles";
  const prizes = selectedLevel ? [
    { rank: '1ST PLACE', amount: selectedLevel.p1, icon: '🥇' },
    { rank: '2ND PLACE', amount: selectedLevel.p2, icon: '🥈' },
    { rank: '3RD PLACE', amount: selectedLevel.p3, icon: '🥉' },
    { rank: 'PER MATCH WIN', amount: selectedLevel.per_match, icon: '💰' }
  ] : [];

  return (
    <View style={{flex: 1, backgroundColor: '#F3F4F6'}}>
      <View style={styles.blueHeader}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <TouchableOpacity onPress={() => router.back()} style={{marginBottom:10, width: 40}}>
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tournament.name}</Text>
          <Text style={styles.headerSub}>{tournament.city} • {tournament.sport} • {tournament.format.toUpperCase()}</Text>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 180}}>
        <View style={styles.card}>
            <Text style={styles.sectionTitle}>SELECT LEVEL</Text>
            {categories.map((cat: any, idx: number) => (
                <TouchableOpacity key={idx} style={[styles.levelBtn, selectedLevel?.name === cat.name && styles.activeLevel]} onPress={() => setSelectedLevel(cat)}>
                    <View><Text style={[styles.levelTitle, selectedLevel?.name === cat.name && {color:'#2563eb'}]}>{cat.name}</Text><Text style={{fontSize:10, color:'#999'}}>Entry Fee</Text></View>
                    <Text style={[styles.price, selectedLevel?.name === cat.name && {color:'#2563eb'}]}>₹{cat.fee}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <View style={styles.card}>
            <View style={{flexDirection:'row', alignItems:'center', marginBottom:15}}><Feather name="calendar" size={18} color="#2563eb" style={{marginRight:8}} /><Text style={styles.sectionTitle}>SCHEDULE & VENUE</Text></View>
            {schedule.length > 0 ? (<View style={styles.scheduleBox}>{schedule.map((row: any, idx: number) => (<View key={idx} style={styles.scheduleRow}><Text style={styles.schLabel}>{row.label}</Text><Text style={styles.schValue}>{row.value}</Text></View>))}</View>) : (<Text style={{color:'#ccc', fontStyle:'italic', marginBottom:10}}>Schedule coming soon.</Text>)}
            {tournament.venue && (<View style={{flexDirection:'row', marginTop: 10, alignItems:'center'}}><Feather name="map-pin" size={14} color="#666" style={{marginRight: 5}}/><Text style={{color:'#444', fontWeight:'bold'}}>{tournament.venue}</Text></View>)}
        </View>

        {selectedLevel && (
            <View style={styles.card}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom:15}}><FontAwesome5 name="trophy" size={16} color="#fbbf24" style={{marginRight:8}} /><Text style={styles.sectionTitle}>PRIZE POOL ({selectedLevel.name})</Text></View>
                <View style={{gap: 10}}>{prizes.map((p, i) => (p.amount > 0 && (<View key={i} style={styles.prizeRow}><View style={{flexDirection:'row', alignItems:'center'}}><Text style={{fontSize:18, marginRight: 10}}>{p.icon}</Text><Text style={styles.prizeRank}>{p.rank}</Text></View><Text style={styles.prizeAmount}>₹{p.amount}</Text></View>)))}</View>
            </View>
        )}

        {isDoubles && (<View style={styles.card}><Text style={styles.sectionTitle}>DOUBLES PARTNER</Text><TextInput style={styles.input} placeholder="Partner Team ID (e.g. SA25)" value={partnerId} onChangeText={setPartnerId} autoCapitalize="characters"/></View>)}
      </ScrollView>

      <RazorpayCheckout visible={payModal} onClose={() => setPayModal(false)} orderDetails={orderDetails} onSuccess={handlePaymentSuccess} />

      <View style={styles.footer}>
        {isDoubles ? (
            <View style={{width:'100%'}}>
                <TouchableOpacity style={styles.payShareBtn} onPress={() => handleJoin('INDIVIDUAL')} disabled={joining}>
                    <Text style={styles.payShareText}>PAY MY SHARE (₹{selectedLevel?.fee || 0})</Text>
                </TouchableOpacity>
                <Text style={styles.warningText}>ⓘ No refund if partner doesn't join.</Text>
                <TouchableOpacity style={styles.payFullBtn} onPress={() => handleJoin('TEAM')} disabled={joining}>
                    <Text style={styles.payFullText}>PAY FULL TEAM (₹{selectedLevel?.fee ? selectedLevel.fee * 2 : 0})</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', width:'100%'}}>
                <View><Text style={{fontSize:10, fontWeight:'bold', color:'#999'}}>TOTAL ENTRY FEE</Text><Text style={{fontSize:24, fontWeight:'900', color:'#1f2937'}}>₹{selectedLevel?.fee || 0}</Text></View>
                <TouchableOpacity style={styles.payBtn} onPress={() => handleJoin('INDIVIDUAL')} disabled={joining}>
                    {joining ? <ActivityIndicator color="white"/> : <Text style={styles.payText}>PAY ENTRY</Text>}
                </TouchableOpacity>
            </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {flex:1, justifyContent:'center', alignItems:'center'},
  blueHeader: { backgroundColor: '#2563eb', padding: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '900', fontStyle: 'italic', textTransform:'uppercase' },
  headerSub: { color: '#bfdbfe', fontWeight: 'bold', fontSize: 12, marginTop: 5, textTransform:'uppercase' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 20, marginBottom: 15, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#1f2937', marginBottom: 10, fontStyle:'italic' },
  scheduleBox: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 10, marginBottom: 5 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
  schLabel: { fontSize: 12, fontWeight: 'bold', color: '#9ca3af', flex: 1 },
  schValue: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  prizeRow: { flexDirection: 'row', justifyContent:'space-between', alignItems:'center', backgroundColor: '#f9fafb', padding: 12, borderRadius: 12 },
  prizeRank: { fontSize: 12, fontWeight: '900', color: '#6b7280', textTransform:'uppercase' },
  prizeAmount: { fontSize: 16, fontWeight: '900', color: '#2563eb' },
  levelBtn: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding: 15, borderWidth: 1, borderColor: '#f3f4f6', borderRadius: 12, marginBottom: 10 },
  activeLevel: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  levelTitle: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  price: { fontWeight: '900', fontSize: 16, color: '#333' },
  input: { backgroundColor: '#f3f4f6', padding: 15, borderRadius: 10, fontWeight:'bold', fontSize: 16 },
  
  footer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'white', padding: 20, borderTopWidth: 1, borderColor: '#f3f4f6' },
  payBtn: { backgroundColor: '#2563eb', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  payText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  
  payShareBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginBottom: 5 },
  payShareText: { color: 'white', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase' },
  payFullBtn: { backgroundColor: 'black', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  payFullText: { color: 'white', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase' },
  warningText: { textAlign: 'center', fontSize: 10, color: '#666', fontStyle: 'italic' }
});