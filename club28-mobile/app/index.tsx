import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Alert, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, RefreshControl, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { useRouter, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// --- IMPORT API_URL FROM CONFIG ---
import { API_URL } from '../config';
import RazorpayCheckout from '../components/RazorpayCheckout';

// --- NOTIFICATION HANDLER CONFIG ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- HELPER: REGISTER FOR PUSH NOTIFICATIONS ---
async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        if (!projectId) return null; 
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        return token;
    } catch (e) {
        return null;
    }
  } else {
    return null; 
  }
}

const ActionCircle = ({ icon, label, onPress }: any) => (
    <TouchableOpacity style={{alignItems:'center'}} onPress={onPress}>
        <View style={styles.circle}>
            <Feather name={icon} size={22} color="#2563eb" />
        </View>
        <Text style={styles.circleLabel}>{label}</Text>
    </TouchableOpacity>
);

export default function App() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mode, setMode] = useState("LOGIN"); 
  
  // Auth Inputs
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveredTeamId, setRecoveredTeamId] = useState("");

  // Dashboard Data
  const [wallet, setWallet] = useState(0);
  const [userData, setUserData] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]); 
  const [notifications, setNotifications] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("PERSONAL");

  // Payment
  const [payModal, setPayModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [requestToPay, setRequestToPay] = useState<any>(null);

  // Event Selection & Matches
  const [selectedRegIndex, setSelectedRegIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [standings, setStandings] = useState<any[]>([]);
  const [myMatches, setMyMatches] = useState<any[]>([]); 
  const [eventTab, setEventTab] = useState("SCHEDULE"); 
  const [groupTab, setGroupTab] = useState("A");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);

  // Notification Listener Refs
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => { checkLoginStatus(); }, []);

  // --- AUTOMATIC TOKEN REGISTRATION ---
  useEffect(() => {
    if (isLoggedIn && teamId) {
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                axios.post(`${API_URL}/user/update-push-token`, {
                    team_id: teamId,
                    token: token
                }).catch(err => console.log("Token update failed", err));
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            fetchDashboardData(teamId);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log("User tapped notification", response);
        });

        return () => {
            notificationListener.current && notificationListener.current.remove();
            responseListener.current && responseListener.current.remove();
        };
    }
  }, [isLoggedIn, teamId]);

  useEffect(() => {
    if(isLoggedIn && teamId) {
        fetchDashboardData(teamId);
    }
  }, [selectedRegIndex, isLoggedIn, teamId]);

  const checkLoginStatus = async () => {
    try {
      const savedTeamId = await AsyncStorage.getItem("team_id");
      if (savedTeamId) {
        setTeamId(savedTeamId);
        setIsLoggedIn(true);
      }
    } catch (error) { console.log(error); } 
    finally { setCheckingAuth(false); }
  };

  const fetchDashboardData = async (tid: string) => {
    try {
      const userRes = await axios.get(`${API_URL}/user/${tid}`);
      setUserData(userRes.data);
      setWallet(userRes.data.wallet_balance);
      setRegistrations(userRes.data.registrations || []);
      setPendingRequests(userRes.data.pending_requests || []); 

      let active = null;
      if (userRes.data.registrations?.length > 0) {
        const safeIndex = selectedRegIndex < userRes.data.registrations.length ? selectedRegIndex : 0;
        if (selectedRegIndex >= userRes.data.registrations.length) setSelectedRegIndex(0);
        active = userRes.data.registrations[safeIndex];
        
        const stdRes = await axios.get(`${API_URL}/standings`, {
          params: { tournament: active.tournament, city: active.city, level: active.level }
        });
        setStandings(stdRes.data);

        const scoreRes = await axios.get(`${API_URL}/scores`);
        const allMatches = scoreRes.data;
        const mine = allMatches.filter((m: any) => 
          (m.t1.includes(tid) || m.t2.includes(tid)) && m.category === active.tournament
        );
        mine.sort((a: any, b: any) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime());
        setMyMatches(mine);
      } else {
          setStandings([]);
          setMyMatches([]);
          setTransactions([]); 
          setNotifications([]);
      }

      if (active) {
          setNotifications([]); 
          setTransactions([]);
          const notifParams = { tournament: active.tournament, city: active.city };
          const notifRes = await axios.get(`${API_URL}/user/${tid}/notifications`, { params: notifParams });
          setNotifications(notifRes.data);
          const txnParams = { tournament: active.tournament };
          const txnRes = await axios.get(`${API_URL}/user/${tid}/transactions`, { params: txnParams });
          setTransactions(txnRes.data);
      }
    } catch (e) { console.log("Fetch Error", e); }
  };

  const handlePayRequest = async (request: any) => { if (userData.wallet_balance < request.amount_due) { setRequestToPay(request); try { const res = await axios.post(`${API_URL}/razorpay/create-order`, { amount: request.amount_due - userData.wallet_balance }); setOrderDetails({ ...res.data, description: "Join Request Fee", contact: userData.phone, email: userData.email }); setPayModal(true); } catch(e) { Alert.alert("Error", "Payment Init Failed"); } } else { confirmJoinRequest(request); } };
  const confirmJoinRequest = async (request: any) => { try { await axios.post(`${API_URL}/confirm-partner`, { reg_id: request.reg_id, payment_mode: "WALLET" }); Alert.alert("Success", "You have joined the team!"); onRefresh(); } catch(e: any) { Alert.alert("Error", e.response?.data?.detail || "Could not join."); } };
  const handlePaymentSuccess = async (data: any) => { setPayModal(false); try { await axios.post(`${API_URL}/razorpay/verify-payment`, { razorpay_payment_id: data.razorpay_payment_id, razorpay_order_id: data.razorpay_order_id, razorpay_signature: data.razorpay_signature, team_id: userData.team_id, amount: orderDetails ? (orderDetails as any).amount / 100 : 0 }); const userRes = await axios.get(`${API_URL}/user/${userData.team_id}`); setUserData(userRes.data); if(requestToPay) confirmJoinRequest(requestToPay); } catch(e) { Alert.alert("Error", "Verification Failed"); } };
  const onRefresh = async () => { setRefreshing(true); await fetchDashboardData(teamId); setRefreshing(false); };
  const switchEvent = (index: number) => { setTransactions([]); setNotifications([]); setSelectedRegIndex(index); setShowDropdown(false); };
  const formatDateHeader = (dateStr: string) => { const parts = dateStr.split('-'); const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase(); };
  const openScoreModal = (match: any) => { setSelectedMatch(match); setScoreInput(""); setModalVisible(true); };
  const submitScore = async () => { if(!scoreInput) return Alert.alert("Error", "Enter score"); setSubmittingScore(true); try { await axios.post(`${API_URL}/submit-score`, { match_id: selectedMatch.id, score: scoreInput, submitted_by_team: teamId }); setModalVisible(false); onRefresh(); Alert.alert("Sent", "Score sent for verification."); } catch(e) { Alert.alert("Error", "Failed to submit score."); } finally { setSubmittingScore(false); } };
  const verifyScore = async (matchId: number, action: string) => { try { await axios.post(`${API_URL}/verify-score`, { match_id: matchId, action: action }); onRefresh(); } catch(e) { Alert.alert("Error", "Action failed"); } };
  const handleLogin = async () => { if (!teamId || !password) return Alert.alert("Error", "Enter Team ID & Password"); setLoading(true); try { const res = await axios.post(`${API_URL}/login`, { team_id: teamId.toUpperCase(), password }); if (res.data.status === "success") { await AsyncStorage.setItem("team_id", teamId.toUpperCase()); setIsLoggedIn(true); } } catch (error) { Alert.alert("Login Failed", "Invalid ID or Password"); } setLoading(false); };
  const handleRegister = async () => { if (!name || !password) return Alert.alert("Error", "Fill all fields"); setLoading(true); try { const res = await axios.post(`${API_URL}/register`, { phone, name, password }); Alert.alert("Success!", `Your Team ID is: ${res.data.user.team_id}`, [{ text: "OK", onPress: () => { setTeamId(res.data.user.team_id); setMode("LOGIN"); } }]); } catch (error) { Alert.alert("Error", "Registration failed."); } setLoading(false); };
  const sendOtp = async (nextMode: string) => { setMode(nextMode); };
  const handleLogout = async () => { await AsyncStorage.removeItem("team_id"); setIsLoggedIn(false); setTeamId(""); setPassword(""); setUserData(null); };
  const handleCheckPhone = async () => { if (!phone) return Alert.alert("Error", "Enter phone number"); setLoading(true); try { const res = await axios.post(`${API_URL}/check-phone`, { phone }); if (res.data.status === "exists") { setRecoveredTeamId(res.data.team_id); setMode("FORGOT_OTP"); } } catch (e) { Alert.alert("Error", "Phone number not found"); } setLoading(false); };
  const handleVerifyForgotOtp = () => { if (otp === "1234") { setMode("FORGOT_FINAL"); } else { Alert.alert("Error", "Invalid OTP"); } };
  const handleResetPassword = async () => { if (!password) return Alert.alert("Error", "Enter new password"); setLoading(true); try { await axios.post(`${API_URL}/reset-password`, { phone, new_password: password }); Alert.alert("Success", "Password Updated! Please Login."); setTeamId(recoveredTeamId); setMode("LOGIN"); } catch (e) { Alert.alert("Error", "Reset Failed"); } setLoading(false); };

  if (checkingAuth) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb"/></View>;

  if (!isLoggedIn) {
    // ... (Login/Register/Forgot UI - same as before) ...
    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1, backgroundColor:'#2563eb'}}>
            <SafeAreaView style={styles.loginContainer}>
                <View style={{padding: 30, width:'100%', alignItems:'center'}}>
                    <Text style={styles.loginTitle}>RAKETA</Text>
                    <Text style={{color:'white', opacity:0.8, marginBottom: 40, fontWeight:'bold'}}>CLUB 28 ACCESS</Text>
                    {mode === "LOGIN" && (<View style={styles.glassCard}><Text style={styles.cardTitle}>Player Login</Text><TextInput style={styles.input} placeholder="Team ID" value={teamId} onChangeText={setTeamId} autoCapitalize="characters" placeholderTextColor="#aaa"/><TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#aaa"/><TouchableOpacity style={styles.mainBtn} onPress={handleLogin} disabled={loading}>{loading ? <ActivityIndicator color="#2563eb"/> : <Text style={styles.btnText}>LOGIN</Text>}</TouchableOpacity><View style={styles.row}><TouchableOpacity onPress={() => setMode("REG_PHONE")}><Text style={styles.linkText}>Create Account</Text></TouchableOpacity><TouchableOpacity onPress={() => setMode("FORGOT_PHONE")}><Text style={styles.linkText}>Forgot?</Text></TouchableOpacity></View></View>)}
                    {mode === "REG_PHONE" && (<View style={styles.glassCard}><Text style={styles.cardTitle}>Create Account</Text><TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/><TouchableOpacity style={styles.mainBtn} onPress={() => sendOtp("REG_OTP")}><Text style={styles.btnText}>GET OTP</Text></TouchableOpacity><TouchableOpacity onPress={() => setMode("LOGIN")} style={{marginTop:15}}><Text style={styles.linkText}>Cancel</Text></TouchableOpacity></View>)}
                    {mode === "REG_OTP" && (<View style={styles.glassCard}><Text style={styles.cardTitle}>Enter OTP</Text><TextInput style={styles.input} placeholder="1234" value={otp} onChangeText={setOtp} keyboardType="number-pad"/><TouchableOpacity style={styles.mainBtn} onPress={() => setMode("REG_FINAL")}><Text style={styles.btnText}>VERIFY</Text></TouchableOpacity></View>)}
                    {mode === "REG_FINAL" && (<View style={styles.glassCard}><Text style={styles.cardTitle}>Finish</Text><TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName}/><TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry/><TouchableOpacity style={styles.mainBtn} onPress={handleRegister}><Text style={styles.btnText}>REGISTER</Text></TouchableOpacity></View>)}
                    {mode === "FORGOT_PHONE" && (<View style={styles.glassCard}><Text style={styles.cardTitle}>Forgot Password</Text><TextInput style={styles.input} placeholder="Enter Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/><TouchableOpacity style={styles.mainBtn} onPress={handleCheckPhone} disabled={loading}>{loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>GET OTP</Text>}</TouchableOpacity><TouchableOpacity onPress={() => setMode("LOGIN")} style={{marginTop:15}}><Text style={styles.linkText}>Back to Login</Text></TouchableOpacity></View>)}
                    {mode === "FORGOT_OTP" && (<View style={styles.glassCard}><Text style={styles.cardTitle}>Verify OTP</Text><TextInput style={styles.input} placeholder="Enter OTP (1234)" value={otp} onChangeText={setOtp} keyboardType="number-pad"/><TouchableOpacity style={styles.mainBtn} onPress={handleVerifyForgotOtp}><Text style={styles.btnText}>VERIFY</Text></TouchableOpacity></View>)}
                    {mode === "FORGOT_FINAL" && (<View style={styles.glassCard}><Text style={styles.cardTitle}>Reset Password</Text><Text style={{textAlign:'center', marginBottom:15, color:'#666', fontWeight:'bold'}}>Resetting for Team ID: <Text style={{color:'#2563eb', fontSize:16}}>{recoveredTeamId}</Text></Text><TextInput style={styles.input} placeholder="New Password" value={password} onChangeText={setPassword} secureTextEntry/><TouchableOpacity style={styles.mainBtn} onPress={handleResetPassword} disabled={loading}>{loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>RESET & LOGIN</Text>}</TouchableOpacity></View>)}
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
  }

  const activeEvent = registrations.length > 0 ? registrations[selectedRegIndex] : null;
  const eventPrizeTxns = activeEvent ? transactions.filter(t => t.mode === 'PRIZE') : [];
  const eventWinnings = eventPrizeTxns.reduce((sum, t) => sum + t.amount, 0);
  const myStats = standings.find(s => s.team_id === teamId);
  const myRank = myStats ? standings.findIndex(s => s.team_id === teamId) + 1 : "-";
  const filteredStandings = standings.filter(s => (s.group || "A") === groupTab);
  const groupedMatches: Record<string, any[]> = {}; 
  myMatches.forEach(m => { if(!groupedMatches[m.date]) groupedMatches[m.date] = []; groupedMatches[m.date].push(m); });

  return (
    <View style={{flex:1, backgroundColor:'#F3F4F6'}}>
      <StatusBar barStyle="light-content" backgroundColor="#2563eb" />
      
      <View style={[styles.blueHeader, {zIndex: 2000}]}>
        <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerTopRow}>
                <Text style={styles.headerLogo}>RAKETA</Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={{marginRight: 15}} onPress={() => setShowNotifModal(true)}>
                         <Feather name="bell" size={20} color="white" />
                         {notifications.length > 0 && <View style={styles.badge} />}
                    </TouchableOpacity>
                </View>
            </View>
            <View style={[styles.userRow, {zIndex: 3000}]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{userData?.name?.charAt(0) || "P"}</Text></View>
                <View>
                    <Text style={styles.userName}>{userData?.name || "Player"}</Text>
                    <Text style={styles.userId}>{teamId}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDropdown(!showDropdown)} style={styles.eventDropdownBtn}>
                    <Text style={styles.eventDropdownText} numberOfLines={1}>{activeEvent ? activeEvent.tournament.toUpperCase() : "MY EVENTS"}</Text>
                    <Feather name="chevron-down" size={14} color="white" />
                </TouchableOpacity>
            </View>
            {showDropdown && (<View style={styles.dropdownMenu}><Text style={styles.dropdownHeader}>SWITCH EVENT</Text>{registrations.map((reg, idx) => (<TouchableOpacity key={idx} style={styles.dropdownItem} onPress={() => switchEvent(idx)}><View style={{flexDirection:'row', alignItems:'center', flex:1}}><Text style={[styles.dropdownItemText, selectedRegIndex === idx && {color:'#2563eb', fontWeight:'bold'}]} numberOfLines={1}>{reg.tournament} ({reg.city})</Text></View>{selectedRegIndex === idx && <Feather name="check" size={14} color="#2563eb" />}</TouchableOpacity>))}<View style={styles.dropdownDivider} /><TouchableOpacity style={styles.dropdownItem} onPress={handleLogout}><Text style={{color:'red', fontWeight:'bold', fontSize:12}}>LOGOUT</Text><Feather name="log-out" size={14} color="red" /></TouchableOpacity></View>)}
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 100}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} scrollEnabled={!showDropdown}>
        
        <View style={styles.summaryCard}>
            <View style={styles.statBox}><Text style={styles.statLabel}>WALLET</Text><Text style={styles.statValue}>₹{wallet}</Text></View>
            <View style={[styles.statBox, {borderLeftWidth:1, borderColor:'#f0f0f0'}]}><Text style={styles.statLabel}>MATCHES</Text><Text style={styles.statValue}>{activeEvent ? (myStats?.played || 0) : "-"}</Text></View>
        </View>

        <View style={styles.actionGrid}>
            <ActionCircle icon="calendar" label="Book Court" onPress={() => Alert.alert("Coming Soon")} />
            <ActionCircle icon="book-open" label="Learn" onPress={() => Alert.alert("Coming Soon")} />
            <TouchableOpacity style={{alignItems:'center'}} onPress={() => router.push('/compete')}><View style={[styles.circle, {backgroundColor:'#2563eb'}]}><FontAwesome5 name="trophy" size={20} color="white" /></View><Text style={styles.circleLabel}>Compete</Text></TouchableOpacity>
            <ActionCircle icon="search" label="Find Match" onPress={() => Alert.alert("Coming Soon")} />
        </View>

        {pendingRequests.length > 0 && pendingRequests.map((req, i) => (
            <View key={i} style={styles.pendingCard}>
                <Text style={styles.pendingTitle}>PENDING REQUESTS</Text>
                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                    <View>
                        <Text style={styles.pendingEvent}>{req.tournament_name || "Tournament"} <Text style={{color:'#f97316'}}></Text></Text>
                        <Text style={styles.pendingSub}>Invited by {req.inviter_code}</Text>
                    </View>
                    <TouchableOpacity style={styles.pendingBtn} onPress={() => handlePayRequest(req)}>
                        <Text style={styles.pendingBtnText}>Pay ₹{req.amount_due} & Join</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ))}

        {activeEvent ? (
            <View style={{marginHorizontal: 20, marginTop: 10, marginBottom: 20}}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom: 10}}><MaterialCommunityIcons name="pulse" size={20} color="#10b981" style={{marginRight:5}} /><Text style={styles.sectionTitle}>ONGOING EVENT ({activeEvent.city.toUpperCase()})</Text></View>
                <View style={styles.webEventCard}>
                    <View style={styles.webEventHeader}>
                        <View><Text style={styles.webEventLabel}>TOURNAMENT</Text><Text style={styles.webEventTitle}>{activeEvent.tournament.toUpperCase()} <Text style={{color:'#fbbf24', fontSize:14}}>({activeEvent.level.toUpperCase()})</Text></Text></View>
                        <View style={{alignItems:'flex-end'}}><Text style={styles.webEventLabel}>MY RANK</Text><Text style={styles.webEventRank}>#{myRank}</Text></View>
                    </View>
                    <View style={styles.webStatsRow}><View style={styles.webStatItem}><Text style={styles.webStatLabel}>PLAYED</Text><Text style={styles.webStatValue}>{myStats?.played || 0}</Text></View><View style={styles.webStatItem}><Text style={styles.webStatLabel}>WON</Text><Text style={[styles.webStatValue, {color:'#10b981'}]}>{myStats?.gamesWon || 0}</Text></View><View style={styles.webStatItem}><Text style={styles.webStatLabel}>POINTS</Text><Text style={[styles.webStatValue, {color:'#2563eb'}]}>{myStats?.points || 0}</Text></View></View>
                    <View style={styles.webTabRow}><TouchableOpacity onPress={() => setEventTab("SCHEDULE")} style={{flex:1}}><Text style={[styles.webTab, eventTab === "SCHEDULE" && {color:'#2563eb', borderBottomWidth:2, borderColor:'#2563eb'}]}>SCHEDULE</Text></TouchableOpacity><TouchableOpacity onPress={() => setEventTab("LEADERBOARD")} style={{flex:1}}><Text style={[styles.webTab, eventTab === "LEADERBOARD" && {color:'#2563eb', borderBottomWidth:2, borderColor:'#2563eb'}]}>LEADERBOARD</Text></TouchableOpacity></View>
                    <View style={{minHeight: 150}}>{eventTab === "SCHEDULE" ? (Object.keys(groupedMatches).length > 0 ? (Object.entries(groupedMatches).map(([date, matches]) => (<View key={date}><View style={styles.dateHeader}><Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text></View>{matches.map((m, idx) => (<View key={idx} style={styles.matchRow}><View style={styles.matchTimeBox}><Text style={styles.matchTime}>{m.time}</Text><Text style={styles.matchStage}>{m.stage || "GRP"}</Text></View><View style={{flex:1, paddingHorizontal:10}}><Text style={[styles.teamName, m.t1.includes(teamId) && {color:'#2563eb'}]}>{m.t1}</Text><Text style={styles.vs}>vs</Text><Text style={[styles.teamName, m.t2.includes(teamId) && {color:'#2563eb'}]}>{m.t2}</Text></View><View>{m.status === "Official" ? (<Text style={styles.officialScore}>{m.score}</Text>) : m.status === "Pending Verification" ? (m.submitted_by_team === teamId ? (<Text style={styles.waitingText}>Waiting...</Text>) : (<View style={{flexDirection:'row', gap:5}}><TouchableOpacity onPress={()=>verifyScore(m.id, "APPROVE")} style={[styles.actionBtn, {backgroundColor:'#dcfce7'}]}><Text style={{color:'green'}}>✓</Text></TouchableOpacity><TouchableOpacity onPress={()=>verifyScore(m.id, "DENY")} style={[styles.actionBtn, {backgroundColor:'#fee2e2'}]}><Text style={{color:'red'}}>X</Text></TouchableOpacity></View>)) : (<TouchableOpacity onPress={() => openScoreModal(m)} style={styles.scoreBtn}><Text style={styles.scoreBtnText}>+ SCORE</Text></TouchableOpacity>)}</View></View>))}</View>))) : (<View style={{alignItems:'center', marginTop:40}}><Text style={{color:'#d1d5db', fontWeight:'bold', fontSize:12}}>No scheduled matches.</Text></View>)) : (<View style={{padding:15}}><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>{['A','B','C','D'].map(g => (<TouchableOpacity key={g} onPress={() => setGroupTab(g)} style={[styles.groupBtn, groupTab === g && styles.activeGroupBtn]}><Text style={[styles.groupText, groupTab === g && {color:'white'}]}>Group {g}</Text></TouchableOpacity>))}</ScrollView><View style={{flexDirection:'row', marginBottom:8, paddingHorizontal:5}}><Text style={{flex:0.8, fontSize:9, color:'#aaa', fontWeight:'bold'}}>RK</Text><Text style={{flex:3, fontSize:9, color:'#aaa', fontWeight:'bold'}}>TEAM</Text><Text style={{flex:1, fontSize:9, color:'#aaa', fontWeight:'bold', textAlign:'center'}}>MAT</Text><Text style={{flex:1, fontSize:9, color:'#aaa', fontWeight:'bold', textAlign:'center'}}>GMS</Text><Text style={{flex:1, fontSize:9, color:'#aaa', fontWeight:'bold', textAlign:'center'}}>PTS</Text></View>{filteredStandings.length > 0 ? filteredStandings.map((p, idx) => (<View key={idx} style={[styles.leaderRow, p.team_id === teamId && styles.myRow]}><Text style={{flex:0.8, fontWeight:'900', color:'#555'}}>#{idx+1}</Text><Text style={{flex:3, fontWeight:'bold', color:'#333', fontSize:12}} numberOfLines={1}>{p.name}</Text><Text style={{flex:1, fontWeight:'bold', color:'#666', textAlign:'center', fontSize:12}}>{p.played}</Text><Text style={{flex:1, fontWeight:'bold', color:'#666', textAlign:'center', fontSize:12}}>{p.totalGamePoints}</Text><Text style={{flex:1, fontWeight:'900', color:'#2563eb', textAlign:'center', fontSize:12}}>{p.points}</Text></View>)) : <Text style={{textAlign:'center', color:'#ccc', marginTop:20}}>No players in Group {groupTab}</Text>}</View>)}</View>
                </View>
            </View>
        ) : (
            <View style={styles.heroCard}><FontAwesome5 name="trophy" size={30} color="#ddd" style={{marginBottom:10}} /><Text style={styles.heroText}>Not registered for any active event.</Text><TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/compete')}><Text style={styles.heroBtnText}>FIND A LEAGUE</Text></TouchableOpacity></View>
        )}

        <View style={styles.updatesSection}><View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}><Feather name="bell" size={16} color="#2563eb" style={{marginRight:5}} /><Text style={styles.sectionTitle}>LATEST UPDATES</Text></View><View style={styles.updateCard}><View style={styles.tabRow}>{['PERSONAL', 'EVENT', 'COMMUNITY'].map(tab => (<TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]}><Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text></TouchableOpacity>))}</View><View style={styles.divider} />{notifications.filter(n => n.tab === activeTab).length > 0 ? notifications.filter(n => n.tab === activeTab).map((n, i) => (<View key={i} style={styles.notifItem}><View style={{flex:1}}><Text style={styles.notifTitle}>{n.title}</Text><Text style={styles.notifMsg}>{n.message}</Text></View><Text style={styles.notifTime}>{n.sub_text}</Text></View>)) : <Text style={styles.emptyState}>NO NEW UPDATES</Text>}</View></View>
        
        <View style={styles.updatesSection}><View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}><Feather name="trending-up" size={16} color="#10b981" style={{marginRight:5}} /><Text style={styles.sectionTitle}>EARNINGS TRACKER</Text></View>
            <View style={styles.greenCard}>
                <Text style={styles.earningsLabel}>{activeEvent ? activeEvent.tournament.toUpperCase() : "EVENT"} WINNINGS</Text>
                <Text style={styles.earningsValue}>₹{eventWinnings}</Text>
                <FontAwesome5 name="trophy" size={80} color="white" style={styles.bgIcon} />
            </View>
            <View style={{marginTop: 5}}>
                {eventPrizeTxns.length > 0 ? eventPrizeTxns.map((txn, i) => (
                    <View key={i} style={styles.prizeTxnRow}>
                        <View><Text style={styles.prizeTxnTitle}>{txn.description}</Text><Text style={styles.prizeTxnDate}>{new Date(txn.date).toLocaleDateString()}</Text></View>
                        <Text style={styles.prizeTxnAmount}>+₹{txn.amount}</Text>
                    </View>
                )) : <Text style={{color:'#999', fontSize:10, textAlign:'center', marginTop:10}}>No winnings yet.</Text>}
            </View>
        </View>
      </ScrollView>

      <RazorpayCheckout visible={payModal} onClose={() => setPayModal(false)} orderDetails={orderDetails} onSuccess={handlePaymentSuccess} />

      <Modal visible={showNotifModal} transparent animationType="fade"><View style={styles.modalBg}><View style={[styles.modalCard, {height:'60%'}]}><View style={{flexDirection:'row', justifyContent:'space-between', width:'100%', marginBottom:10}}><Text style={styles.modalTitle}>NOTIFICATIONS</Text><TouchableOpacity onPress={() => setShowNotifModal(false)}><Feather name="x" size={24} color="#333"/></TouchableOpacity></View><ScrollView style={{width:'100%'}}>{notifications.length > 0 ? notifications.map((n, i) => (<View key={i} style={[styles.notifItem, {borderBottomWidth:1, borderBottomColor:'#eee'}]}><View style={{flex:1}}><Text style={styles.notifTitle}>{n.title}</Text><Text style={styles.notifMsg}>{n.message}</Text></View><Text style={styles.notifTime}>{n.sub_text}</Text></View>)) : <Text style={{textAlign:'center', marginTop:50, color:'#999'}}>No notifications.</Text>}</ScrollView></View></View></Modal>
      
      {/* KEYBOARD FIX */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
            <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>ENTER SCORE</Text>
                <Text style={styles.modalSub}>{selectedMatch?.t1} vs {selectedMatch?.t2}</Text>
                <TextInput style={styles.scoreInput} placeholder="e.g. 6-4, 6-2" value={scoreInput} onChangeText={setScoreInput} autoFocus/>
                <View style={{flexDirection:'row', gap:10}}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={{color:'#666', fontWeight:'bold'}}>CANCEL</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.submitBtn} onPress={submitScore} disabled={submittingScore}>{submittingScore ? <ActivityIndicator color="white"/> : <Text style={{color:'white', fontWeight:'bold'}}>SUBMIT</Text>}</TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={{alignItems:'center'}}><Feather name="home" size={24} color="#2563eb" /><Text style={[styles.navLabel, {color:'#2563eb'}]}>Home</Text></TouchableOpacity>
        <TouchableOpacity style={{alignItems:'center'}} onPress={() => router.push('/compete')}><FontAwesome5 name="trophy" size={22} color="#9ca3af" /><Text style={styles.navLabel}>Compete</Text></TouchableOpacity>
        <TouchableOpacity style={{alignItems:'center'}} onPress={() => router.push('/profile')}><Feather name="user" size={24} color="#9ca3af" /><Text style={styles.navLabel}>Profile</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loginContainer: { flex: 1, alignItems:'center', justifyContent:'center', width:'100%' },
  loginTitle: { fontSize: 32, fontWeight:'900', color:'white', fontStyle:'italic', marginBottom: 5 },
  glassCard: { backgroundColor:'white', padding:25, borderRadius:20, width:'100%', shadowColor:'#000', shadowOpacity:0.2, shadowRadius:10, elevation:5 },
  cardTitle: { fontSize: 20, fontWeight:'bold', marginBottom: 20, color:'#333' },
  input: { backgroundColor: '#f3f4f6', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
  mainBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  linkText: { color: '#666', fontSize: 14, fontWeight:'600' },
  blueHeader: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTopRow: { flexDirection: 'row', justifyContent:'space-between', alignItems:'center', marginTop: 10, marginBottom: 20 },
  headerLogo: { color: 'white', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  avatarText: { color: '#2563eb', fontWeight: 'bold', fontSize: 20 },
  userName: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  userId: { color: '#bfdbfe', fontSize: 12, fontWeight: 'bold' },
  eventDropdownBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  eventDropdownText: { color: 'white', fontWeight: 'bold', fontSize: 10, marginRight: 5, maxWidth: 100 },
  dropdownMenu: { position: 'absolute', top: 90, right: 20, backgroundColor: 'white', borderRadius: 10, padding: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 10, width: 200, zIndex: 9999 },
  dropdownHeader: { fontSize: 10, fontWeight: '900', color: '#999', marginBottom: 5 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  dropdownItemText: { fontSize: 12, color: '#333', fontWeight: 'bold' },
  dropdownDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 5 },
  summaryCard: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 20, marginTop: 20, padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#9ca3af', fontWeight: 'bold', marginBottom: 5 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#1f2937' },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginTop: 25, marginBottom: 10 },
  circle: { width: 55, height: 55, borderRadius: 30, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2 },
  circleLabel: { fontSize: 10, fontWeight: 'bold', color: '#4b5563' },
  pendingCard: { backgroundColor: '#fff7ed', marginHorizontal: 20, marginBottom: 15, padding: 15, borderRadius: 15, borderLeftWidth: 5, borderLeftColor: '#f97316' },
  pendingTitle: { fontSize: 10, fontWeight: '900', color: '#ea580c', marginBottom: 8 },
  pendingEvent: { fontSize: 14, fontWeight: '900', color: '#333', fontStyle: 'italic' },
  pendingSub: { fontSize: 10, color: '#666', marginTop: 2 },
  pendingBtn: { backgroundColor: '#f97316', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  pendingBtnText: { color: 'white', fontWeight: 'bold', fontSize: 10 },
  webEventCard: { backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  webEventHeader: { backgroundColor: '#2563eb', padding: 20, flexDirection: 'row', justifyContent: 'space-between' },
  webEventLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  webEventTitle: { color: 'white', fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
  webEventRank: { color: 'white', fontSize: 24, fontWeight: '900' },
  webStatsRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  webStatItem: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f3f4f6' },
  webStatLabel: { fontSize: 10, color: '#9ca3af', fontWeight: 'bold', marginBottom: 5 },
  webStatValue: { fontSize: 18, fontWeight: '900', color: '#1f2937' },
  webTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  webTab: { flex: 1, textAlign: 'center', paddingVertical: 15, fontSize: 10, fontWeight: '900', color: '#9ca3af', letterSpacing: 1 },
  dateHeader: { backgroundColor: '#f3f4f6', paddingHorizontal: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  dateHeaderText: { fontSize: 11, fontWeight: '900', color: '#6b7280', textTransform: 'uppercase' },
  matchRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  matchTimeBox: { alignItems: 'center', marginRight: 10, width: 40 },
  matchTime: { fontSize: 12, fontWeight: '900', color: '#333' },
  matchStage: { fontSize: 8, fontWeight: 'bold', color: '#2563eb', backgroundColor: '#eff6ff', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginTop: 2, textTransform: 'uppercase' },
  teamName: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  vs: { fontSize: 10, color: '#999', marginVertical: 1 },
  scoreBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  scoreBtnText: { color: '#2563eb', fontSize: 10, fontWeight: 'bold' },
  officialScore: { fontSize: 14, fontWeight: '900', color: '#10b981' },
  waitingText: { fontSize: 10, fontStyle: 'italic', color: '#999' },
  actionBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: 'white', width: '80%', padding: 25, borderRadius: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 5 },
  modalSub: { color: '#666', marginBottom: 20 },
  scoreInput: { backgroundColor: '#f3f4f6', width: '100%', padding: 15, borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  submitBtn: { backgroundColor: '#2563eb', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  groupBtn: { marginRight: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor:'#f3f4f6' },
  activeGroupBtn: { backgroundColor: '#2563eb' },
  groupText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  leaderRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', alignItems:'center' },
  myRow: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 5, marginLeft:-5, marginRight:-5 },
  heroCard: { backgroundColor: 'white', margin: 20, padding: 30, borderRadius: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#e5e7eb' },
  heroText: { color: '#9ca3af', fontWeight: 'bold', fontSize: 12, marginBottom: 15 },
  heroBtn: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, shadowColor:'#2563eb', shadowOpacity:0.3, shadowRadius:5 },
  heroBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  updatesSection: { paddingHorizontal: 20, marginTop: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '900', fontStyle: 'italic', color: '#1f2937' },
  updateCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, marginTop: 5, minHeight: 120 },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  tabBtn: { paddingBottom: 5 },
  activeTabBtn: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af' },
  activeTabText: { color: '#2563eb' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 20 },
  emptyState: { textAlign: 'center', color: '#d1d5db', fontSize: 12, fontWeight: 'bold', marginTop: 10 },
  notifItem: { flexDirection:'row', justifyContent:'space-between', marginBottom: 15, borderBottomWidth:1, borderBottomColor:'#f3f4f6', paddingBottom:10 },
  notifTitle: { fontWeight:'bold', color:'#333', fontSize:12 },
  notifMsg: { color:'#666', fontSize:11, marginTop:2 },
  notifTime: { fontSize:9, fontWeight:'bold', color:'#9ca3af' },
  greenCard: { backgroundColor: '#10b981', borderRadius: 20, padding: 25, marginTop: 5, position: 'relative', overflow: 'hidden' },
  earningsLabel: { color: 'white', fontSize: 10, fontWeight: 'bold', opacity: 0.9 },
  earningsValue: { color: 'white', fontSize: 32, fontWeight: '900', marginTop: 5 },
  bgIcon: { position: 'absolute', right: -10, bottom: -15, opacity: 0.2 },
  prizeTxnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  prizeTxnTitle: { fontSize: 12, fontWeight: '900', color: '#333' },
  prizeTxnDate: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af', marginTop: 2 },
  prizeTxnAmount: { fontSize: 14, fontWeight: '900', color: '#10b981' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#f3f4f6', position:'absolute', bottom:0, width:'100%' },
  navLabel: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af', marginTop: 4 }
});