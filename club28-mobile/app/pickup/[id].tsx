import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

export default function PickupDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [userTeamId, setUserTeamId] = useState("");
  const [inviteId, setInviteId] = useState("");

  useEffect(() => { loadDetails(); }, []);

  const loadDetails = async () => {
    try {
        const tid = await AsyncStorage.getItem("team_id");
        setUserTeamId(tid || "");
        
        const res = await axios.get(`${API_URL}/match/details/${id}`);
        setMatch(res.data.match);
        setPlayers(res.data.players);
    } catch (e) {
        Alert.alert("Error", "Could not load match");
        router.back();
    } finally { setLoading(false); }
  };

  const handleJoin = async () => {
      try {
          if (match.type === "PUBLIC") {
              Alert.alert("Confirm Payment", `Pay ₹${match.cost_per} to join?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Pay & Join", onPress: processJoin }
              ]);
          } else {
              processJoin();
          }
      } catch (e) { console.log(e); }
  };

  const processJoin = async () => {
      try {
          await axios.post(`${API_URL}/match/join`, { match_id: match.id, user_team_id: userTeamId });
          Alert.alert("Success", match.type === "PUBLIC" ? "Joined & Paid!" : "Request Sent!");
          loadDetails();
      } catch (e: any) {
          Alert.alert("Error", e.response?.data?.detail || "Failed to join");
      }
  };

  const handleInvite = async () => {
      if (!inviteId) return;
      try {
          await axios.post(`${API_URL}/match/invite`, { match_id: match.id, target_team_id: inviteId.toUpperCase() });
          Alert.alert("Sent", `Invite sent to ${inviteId.toUpperCase()}`);
          setInviteId("");
      } catch (e) { Alert.alert("Error", "Player not found or already invited"); }
  };

  const handleResponse = async (playerId: number, action: string) => {
      try {
          await axios.post(`${API_URL}/match/respond-request`, { match_id: match.id, player_id: playerId, action });
          loadDetails();
      } catch (e) { Alert.alert("Error", "Action failed"); }
  };

  if (loading || !match) return <View style={styles.center}><ActivityIndicator color="#2563eb"/></View>;

  const isHost = players.find(p => p.team_id === userTeamId && p.payment === "HOST");
  const myStatus = players.find(p => p.team_id === userTeamId)?.status;

  return (
    <View style={{flex:1, backgroundColor:'#F3F4F6'}}>
        <View style={styles.header}>
            <SafeAreaView edges={['top', 'left', 'right']}>
                <TouchableOpacity onPress={() => router.back()} style={{marginBottom:10, width:40}}>
                    <Feather name="arrow-left" size={24} color="white"/>
                </TouchableOpacity>
                
                {/* FIXED: Added fallback string to prevent .toUpperCase() crash */}
                <Text style={styles.headerTitle}>{(match.sport || "MATCH").toUpperCase()} MATCH</Text>
                
                <Text style={styles.headerSub}>{match.date} • {match.venue}</Text>
            </SafeAreaView>
        </View>

        <ScrollView contentContainerStyle={{padding:20, paddingBottom:100}}>
            
            {/* NEW: Payment Breakdown Section */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>PAYMENT BREAKDOWN</Text>
                <View style={styles.costRow}>
                    <View style={styles.costBox}>
                        <Text style={styles.costLabel}>TOTAL COST</Text>
                        <Text style={styles.costValue}>₹{match.total_cost || 0}</Text>
                    </View>
                    <Feather name="divide" size={20} color="#9ca3af" />
                    <View style={styles.costBox}>
                        <Text style={styles.costLabel}>SLOTS</Text>
                        <Text style={styles.costValue}>{match.slots}</Text>
                    </View>
                    <Feather name="chevrons-right" size={20} color="#9ca3af" />
                    <View style={[styles.costBox, {borderColor: '#2563eb', backgroundColor:'#eff6ff'}]}>
                        <Text style={[styles.costLabel, {color:'#2563eb'}]}>PER PERSON</Text>
                        <Text style={[styles.costValue, {color:'#2563eb'}]}>₹{match.cost_per}</Text>
                    </View>
                </View>

                <View style={styles.divider}/>

                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                    <View>
                        <Text style={styles.label}>TIME</Text>
                        <Text style={styles.value}>{match.time}</Text>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                        <Text style={styles.label}>TYPE</Text>
                        <Text style={styles.value}>{match.type}</Text>
                    </View>
                </View>
                <View style={{marginTop:15}}>
                    <Text style={styles.label}>DESCRIPTION</Text>
                    <Text style={styles.text}>{match.description || "No description provided."}</Text>
                </View>
                {match.status === "COMPLETED" && <View style={styles.completedBanner}><Text style={{color:'white', fontWeight:'bold', fontSize:12}}>MATCH COMPLETED</Text></View>}
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>PLAYERS ({players.filter(p=>p.status==="CONFIRMED").length}/{match.slots})</Text>
                {players.map((p, i) => (
                    <View key={i} style={styles.playerRow}>
                        <View>
                            <Text style={styles.playerName}>{p.name} {p.team_id === userTeamId ? "(You)" : ""}</Text>
                            <Text style={styles.playerSub}>{p.status} • {p.payment === "PAID_PLATFORM" ? "PAID" : p.payment}</Text>
                        </View>
                        {isHost && p.status === "REQUESTED" && (
                            <View style={{flexDirection:'row', gap:10}}>
                                <TouchableOpacity onPress={()=>handleResponse(p.id, "ACCEPT")}><Feather name="check-circle" size={20} color="green"/></TouchableOpacity>
                                <TouchableOpacity onPress={()=>handleResponse(p.id, "REJECT")}><Feather name="x-circle" size={20} color="red"/></TouchableOpacity>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {isHost && match.status !== "COMPLETED" && (
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>MANUAL INVITE</Text>
                    <View style={{flexDirection:'row', gap:10, marginTop:10}}>
                        <TextInput style={styles.input} placeholder="Team ID (e.g. SA25)" value={inviteId} onChangeText={setInviteId} autoCapitalize="characters"/>
                        <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite}><Text style={{color:'white', fontWeight:'bold'}}>SEND</Text></TouchableOpacity>
                    </View>
                </View>
            )}
        </ScrollView>

        {!isHost && !myStatus && match.status === "OPEN" && (
            <View style={styles.footer}>
                <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
                    <Text style={styles.joinText}>{match.join_mode === 'REQUEST' ? 'REQUEST TO JOIN' : `REGISTER & PAY ₹${match.cost_per}`}</Text>
                </TouchableOpacity>
            </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {flex:1, justifyContent:'center', alignItems:'center'},
  header: { backgroundColor: '#2563eb', padding: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  headerSub: { color: '#bfdbfe', fontWeight: 'bold', fontSize: 12, marginTop: 5 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 20, marginBottom: 15, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af', marginBottom: 5 },
  value: { fontSize: 16, fontWeight: '900', color: '#333' },
  text: { fontSize: 14, color: '#4b5563', fontWeight:'500' },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#1f2937', marginBottom: 10 },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  playerName: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  playerSub: { fontSize: 10, color: '#9ca3af', fontWeight: 'bold', marginTop: 2 },
  input: { flex: 1, backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, fontWeight: 'bold' },
  inviteBtn: { backgroundColor: 'black', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 10 },
  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee' },
  joinBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 15, alignItems: 'center' },
  joinText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  completedBanner: { marginTop: 15, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' },
  
  // Cost Breakdown Styles
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  costBox: { alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#f3f4f6', flex: 1, marginHorizontal: 2 },
  costLabel: { fontSize: 8, fontWeight: 'bold', color: '#9ca3af', marginBottom: 2 },
  costValue: { fontSize: 14, fontWeight: '900', color: '#333' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 15 }
});