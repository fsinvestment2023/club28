import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '../config';

export default function FindMatchScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("PUBLIC"); 
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [userTeamId, setUserTeamId] = useState("");
  
  // HOST MATCH STATE
  const [showHostModal, setShowHostModal] = useState(false);
  const [formData, setFormData] = useState({
      sport: "Padel", type: "PUBLIC", date: new Date(), time: new Date(), 
      venue: "", slots: "4", cost: "0", description: "", is_flexible: false
  });
  const [showPicker, setShowPicker] = useState({ date: false, time: false });
  const [creating, setCreating] = useState(false);

  // INVITE STATE
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedPlayerForInvite, setSelectedPlayerForInvite] = useState<any>(null);
  const [myHostedMatches, setMyHostedMatches] = useState<any[]>([]);

  // PROFILE MODAL STATE
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<any>(null);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
        const tid = await AsyncStorage.getItem("team_id");
        if (!tid) return;
        setUserTeamId(tid);
        const userRes = await axios.get(`${API_URL}/user/${tid}`);
        const userId = userRes.data.id;

        if (activeTab === "PLAYERS") {
            // Explicitly fetch user list for the directory
            console.log("Fetching players...");
            const res = await axios.get(`${API_URL}/user/list`);
            // Filter out self so you don't invite yourself
            const others = res.data.filter((p:any) => p.team_id !== tid);
            setPlayersList(others);
        } else {
            let url = `${API_URL}/match/list?type=PUBLIC`;
            if (activeTab === "PRIVATE") url = `${API_URL}/match/list?type=PRIVATE`;
            if (activeTab === "HOST") url = `${API_URL}/match/my-hosted/${tid}`;
            if (activeTab === "UPCOMING") url = `${API_URL}/match/list?user_id=${userId}`;
            const res = await axios.get(url);
            setMatches(res.data);
        }
    } catch (e: any) { 
        console.log("Load Error:", e);
        if (activeTab === "PLAYERS") {
            Alert.alert("Connection Error", "Could not load players list. Please try again.");
        }
    } finally { setLoading(false); }
  };

  const handleInviteClick = async (player: any) => {
      try {
          const res = await axios.get(`${API_URL}/match/my-hosted/${userTeamId}`);
          // Allow inviting to OPEN matches only
          const validMatches = res.data.filter((m: any) => m.status === 'OPEN');
          
          if (validMatches.length === 0) {
              Alert.alert("No Matches", "You have no open hosted matches. Host a match first to invite players.");
              return;
          }
          setMyHostedMatches(validMatches);
          setSelectedPlayerForInvite(player);
          setShowInviteModal(true);
      } catch (e) { Alert.alert("Error", "Could not fetch your matches"); }
  };

  const sendInvite = async (matchId: number) => {
      try {
          await axios.post(`${API_URL}/match/invite`, { match_id: matchId, target_team_id: selectedPlayerForInvite.team_id });
          Alert.alert("Success", `Invite sent to ${selectedPlayerForInvite.name}`);
          setShowInviteModal(false);
      } catch (e) { Alert.alert("Error", "Player already invited or joined this match."); }
  };

  const handleViewProfile = (player: any) => {
      setViewingProfile(player);
      setShowProfileModal(true);
  };

  const handleCreateMatch = async () => {
      if (!formData.venue || !formData.slots) return Alert.alert("Error", "Fill all details");
      setCreating(true);
      try {
          const dateStr = formData.date.toISOString().split('T')[0];
          const timeStr = formData.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await axios.post(`${API_URL}/match/create`, {
              host_team_id: userTeamId, type: formData.type, sport: formData.sport, date: dateStr, time: timeStr, venue: formData.venue,
              total_slots: parseInt(formData.slots), total_cost: parseInt(formData.cost), is_flexible: formData.is_flexible,
              join_mode: formData.type === "PRIVATE" ? "REQUEST" : "OPEN", description: formData.description
          });
          Alert.alert("Success", "Match Hosted! Platform fee deducted.");
          setShowHostModal(false);
          setActiveTab("HOST");
      } catch (e: any) { Alert.alert("Error", e.response?.data?.detail || "Could not create match"); } 
      finally { setCreating(false); }
  };

  const onDateChange = (event: any, selectedDate?: Date) => { setShowPicker({ ...showPicker, date: false }); if (selectedDate) setFormData({ ...formData, date: selectedDate }); };
  const onTimeChange = (event: any, selectedDate?: Date) => { setShowPicker({ ...showPicker, time: false }); if (selectedDate) setFormData({ ...formData, time: selectedDate }); };

  const renderMatchCard = (m: any) => (
      <TouchableOpacity key={m.id} style={styles.card} onPress={() => router.push(`/pickup/${m.id}`)}>
          <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8}}>
              <Text style={styles.sportBadge}>{m.sport}</Text>
              <Text style={[styles.statusBadge, m.status === 'OPEN' ? {backgroundColor:'#dcfce7', color:'#166534'} : {backgroundColor:'#f3f4f6', color:'#666'}]}>{m.status}</Text>
          </View>
          <Text style={styles.venue}>{m.venue}</Text>
          <Text style={styles.dateTime}>{m.date} @ {m.time}</Text>
          <View style={styles.divider}/>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
              <View><Text style={styles.hostLabel}>HOSTED BY</Text><Text style={styles.hostName}>{m.host_name} {activeTab === "HOST" ? "(You)" : ""}</Text></View>
              {activeTab === "UPCOMING" ? (
                  <View style={{alignItems:'flex-end'}}><Text style={styles.hostLabel}>YOUR STATUS</Text><Text style={{fontWeight:'bold', color:'#2563eb'}}>{m.player_status}</Text></View>
              ) : (
                  <View style={{alignItems:'flex-end'}}><Text style={styles.hostLabel}>SLOTS</Text><Text style={styles.slots}>{m.filled || (m.total_slots - m.slots_open)} / {m.total}</Text></View>
              )}
          </View>
      </TouchableOpacity>
  );

  return (
    <View style={{flex:1, backgroundColor:'#F3F4F6'}}>
        <SafeAreaView style={styles.header} edges={['top', 'left', 'right']}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={24} color="white"/></TouchableOpacity>
                <Text style={styles.headerTitle}>FIND A MATCH</Text>
                <TouchableOpacity onPress={() => setShowHostModal(true)}><Feather name="plus-circle" size={24} color="white"/></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                {['PUBLIC', 'PRIVATE', 'HOST', 'UPCOMING', 'PLAYERS'].map(t => (
                    <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.activeTab]}><Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>{t}</Text></TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{padding: 20}}>
            {loading ? <ActivityIndicator color="#2563eb" size="large" style={{marginTop:50}}/> : (
                activeTab === "PLAYERS" ? (
                    playersList.length > 0 ? playersList.map(p => (
                        <TouchableOpacity key={p.id} style={styles.playerCard} onPress={() => handleViewProfile(p)}>
                            <View style={{flexDirection:'row', alignItems:'center', flex:1}}>
                                <View style={styles.avatar}><Text style={styles.avatarText}>{p.name ? p.name.charAt(0) : "?"}</Text></View>
                                <View>
                                    <Text style={styles.playerName}>{p.name}</Text>
                                    <Text style={styles.playerSub}>{p.team_id}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.inviteBtn} onPress={(e) => { e.stopPropagation(); handleInviteClick(p); }}>
                                <Text style={styles.inviteText}>INVITE</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )) : (
                        <View style={{alignItems:'center', marginTop:50}}>
                            <Text style={styles.emptyText}>No players found.</Text>
                            <TouchableOpacity onPress={loadData} style={{marginTop:10}}><Text style={{color:'#2563eb', fontWeight:'bold'}}>Retry</Text></TouchableOpacity>
                        </View>
                    )
                ) : matches.length > 0 ? matches.map(renderMatchCard) : (
                    <View style={{alignItems:'center', marginTop:100, opacity:0.5}}>
                        <Feather name="search" size={50} color="#9ca3af"/>
                        <Text style={{marginTop:10, fontWeight:'bold', color:'#9ca3af'}}>No matches found.</Text>
                    </View>
                )
            )}
        </ScrollView>

        {/* HOST MATCH MODAL */}
        <Modal visible={showHostModal} animationType="slide" transparent>
            <View style={styles.modalBg}><View style={styles.modalCard}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}><Text style={styles.modalTitle}>HOST A MATCH</Text><TouchableOpacity onPress={() => setShowHostModal(false)}><Feather name="x" size={24} color="#333"/></TouchableOpacity></View>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={styles.label}>Match Type</Text>
                    <View style={{flexDirection:'row', marginBottom:15}}>
                        <TouchableOpacity onPress={()=>setFormData({...formData, type:'PUBLIC'})} style={[styles.typeBtn, formData.type==='PUBLIC' && styles.activeTypeBtn]}><Text style={[styles.typeText, formData.type==='PUBLIC' && {color:'white'}]}>PUBLIC</Text></TouchableOpacity>
                        <TouchableOpacity onPress={()=>setFormData({...formData, type:'PRIVATE'})} style={[styles.typeBtn, formData.type==='PRIVATE' && styles.activeTypeBtn]}><Text style={[styles.typeText, formData.type==='PRIVATE' && {color:'white'}]}>PRIVATE</Text></TouchableOpacity>
                    </View>
                    <Text style={styles.label}>Venue</Text><TextInput style={styles.input} placeholder="Court Name" value={formData.venue} onChangeText={t => setFormData({...formData, venue:t})}/>
                    <View style={{flexDirection:'row', gap:10}}><View style={{flex:1}}><Text style={styles.label}>Date</Text><TouchableOpacity onPress={()=>setShowPicker({...showPicker, date:true})} style={styles.input}><Text>{formData.date.toDateString()}</Text></TouchableOpacity></View><View style={{flex:1}}><Text style={styles.label}>Time</Text><TouchableOpacity onPress={()=>setShowPicker({...showPicker, time:true})} style={styles.input}><Text>{formData.time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text></TouchableOpacity></View></View>
                    <View style={{flexDirection:'row', gap:10}}><View style={{flex:1}}><Text style={styles.label}>Total Slots</Text><TextInput style={styles.input} keyboardType="number-pad" value={formData.slots} onChangeText={t => setFormData({...formData, slots:t})}/></View><View style={{flex:1}}><Text style={styles.label}>Total Cost (₹)</Text><TextInput style={styles.input} keyboardType="number-pad" value={formData.cost} onChangeText={t => setFormData({...formData, cost:t})}/></View></View>
                    <Text style={styles.label}>Description</Text><TextInput style={styles.input} placeholder="Level, Gender, etc." value={formData.description} onChangeText={t => setFormData({...formData, description:t})}/>
                    <Text style={{fontSize:10, color:'#666', marginBottom:20, fontStyle:'italic'}}>* Platform Fee of ₹100 applies to host.</Text>
                    <TouchableOpacity style={styles.createBtn} onPress={handleCreateMatch} disabled={creating}>{creating ? <ActivityIndicator color="white"/> : <Text style={styles.createBtnText}>PAY ₹100 & HOST</Text>}</TouchableOpacity>
                </ScrollView>
            </View></View>
            {showPicker.date && <DateTimePicker value={formData.date} mode="date" onChange={onDateChange}/>}
            {showPicker.time && <DateTimePicker value={formData.time} mode="time" onChange={onTimeChange}/>}
        </Modal>

        {/* INVITE SELECTION MODAL */}
        <Modal visible={showInviteModal} animationType="slide" transparent>
            <View style={styles.modalBg}><View style={[styles.modalCard, {maxHeight: '50%'}]}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}><Text style={styles.modalTitle}>INVITE {selectedPlayerForInvite?.name}</Text><TouchableOpacity onPress={() => setShowInviteModal(false)}><Feather name="x" size={24} color="#333"/></TouchableOpacity></View>
                <Text style={{marginBottom:10, color:'#666'}}>Select one of your hosted matches:</Text>
                <ScrollView>{myHostedMatches.map(m => (<TouchableOpacity key={m.id} onPress={() => sendInvite(m.id)} style={styles.inviteMatchRow}><Text style={{fontWeight:'bold'}}>{m.sport} Match</Text><Text style={{fontSize:12, color:'#666'}}>{m.date} @ {m.venue}</Text></TouchableOpacity>))}</ScrollView>
            </View></View>
        </Modal>

        {/* PROFILE VIEW MODAL */}
        <Modal visible={showProfileModal} animationType="slide" transparent>
            <View style={styles.modalBg}>
                <View style={styles.modalCard}>
                    <View style={{alignItems:'center', marginBottom:20}}>
                        <View style={{width:80, height:80, borderRadius:40, backgroundColor:'#2563eb', alignItems:'center', justifyContent:'center', marginBottom:15}}>
                            <Text style={{color:'white', fontSize:32, fontWeight:'bold'}}>{viewingProfile?.name ? viewingProfile.name.charAt(0) : "?"}</Text>
                        </View>
                        <Text style={{fontSize:22, fontWeight:'bold', color:'#1f2937'}}>{viewingProfile?.name}</Text>
                        <Text style={{fontSize:14, color:'#2563eb', fontWeight:'bold', marginTop:2}}>{viewingProfile?.team_id}</Text>
                    </View>
                    <View style={styles.divider}/>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:10}}>
                        <Text style={{color:'#666', fontWeight:'bold'}}>Location</Text>
                        <Text style={{color:'#333', fontWeight:'bold'}}>{viewingProfile?.play_location || "-"}</Text>
                    </View>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:10}}>
                        <Text style={{color:'#666', fontWeight:'bold'}}>Gender</Text>
                        <Text style={{color:'#333', fontWeight:'bold'}}>{viewingProfile?.gender || "-"}</Text>
                    </View>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:10}}>
                        <Text style={{color:'#666', fontWeight:'bold'}}>Matches Played</Text>
                        <Text style={{color:'#2563eb', fontWeight:'black', fontSize:16}}>{viewingProfile?.matches_played || 0}</Text>
                    </View>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:10}}>
                        <Text style={{color:'#666', fontWeight:'bold'}}>Joined</Text>
                        <Text style={{color:'#333', fontWeight:'bold'}}>{viewingProfile?.joined_at || "-"}</Text>
                    </View>
                    <TouchableOpacity style={[styles.createBtn, {marginTop:20}]} onPress={() => setShowProfileModal(false)}>
                        <Text style={styles.createBtnText}>CLOSE</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingBottom: 15 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
  tabScroll: { marginTop: 20, paddingBottom: 5 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 15, alignItems: 'center', borderRadius: 20, marginRight: 5, backgroundColor: 'rgba(0,0,0,0.1)' },
  activeTab: { backgroundColor: 'white' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 'bold' },
  activeTabText: { color: '#2563eb' },
  card: { backgroundColor: 'white', borderRadius: 15, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sportBadge: { backgroundColor: '#fefce8', color: '#854d0e', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  statusBadge: { fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  venue: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginTop: 5 },
  dateTime: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },
  hostLabel: { fontSize: 9, color: '#9ca3af', fontWeight: 'bold' },
  hostName: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  slots: { fontSize: 14, fontWeight: '900', color: '#1f2937' },
  
  playerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 10, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#2563eb', fontWeight: 'bold', fontSize: 16 },
  playerName: { fontWeight: 'bold', color: '#333' },
  playerSub: { fontSize: 10, color: '#9ca3af' },
  inviteBtn: { backgroundColor: '#000', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  inviteText: { color: 'white', fontWeight: 'bold', fontSize: 10 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 50 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1f2937' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, fontWeight: 'bold', color: '#333' },
  createBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  createBtnText: { color: 'white', fontWeight: 'bold' },
  typeBtn: { flex: 1, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginRight: 5 },
  activeTypeBtn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeText: { fontSize: 12, fontWeight: 'bold', color: '#6b7280' },
  inviteMatchRow: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }
});








