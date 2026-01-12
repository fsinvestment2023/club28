import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Alert, TextInput, ActivityIndicator, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
// IMPORT THE NEW COMPONENT
import RazorpayCheckout from '../components/RazorpayCheckout';

const API_URL = "http://192.168.29.43:8000";

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState("INFO");
  const [transactions, setTransactions] = useState([]);
  const [history, setHistory] = useState([]);
  
  // EDIT STATE
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ email: "", gender: "", dob: "", play_location: "" });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // WITHDRAW STATE
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankDetails, setBankDetails] = useState({ bank: "", acc: "", ifsc: "" });

  // PAYMENT STATE
  const [payModal, setPayModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [])
  );

  const fetchProfileData = async () => {
    try {
      const tid = await AsyncStorage.getItem("team_id");
      if (!tid) return;
      const userRes = await axios.get(`${API_URL}/user/${tid}`);
      setUserData(userRes.data);
      setFormData({
        email: userRes.data.email || "",
        gender: userRes.data.gender || "",
        dob: userRes.data.dob || "",
        play_location: userRes.data.play_location || ""
      });
      const txnRes = await axios.get(`${API_URL}/user/${tid}/transactions`);
      setTransactions(txnRes.data);
      const histRes = await axios.get(`${API_URL}/user/${tid}/history`);
      setHistory(histRes.data);
    } catch (e) { console.log("Error fetching profile", e); } 
    finally { setLoading(false); }
  };

  // --- ADD MONEY LOGIC ---
  const initiateAddMoney = async () => {
    try {
        // Defaulting to ₹100 for testing. You can add an input for this later.
        const res = await axios.post(`${API_URL}/razorpay/create-order`, { amount: 100 }); 
        setOrderDetails({
            ...res.data, 
            description: "Wallet Recharge",
            contact: userData.phone,
            email: userData.email || "player@example.com"
        });
        setPayModal(true);
    } catch (e) {
        Alert.alert("Error", "Could not create payment order. Is Backend running?");
    }
  };

  const handlePaymentSuccess = async (data) => {
    setPayModal(false);
    try {
        const res = await axios.post(`${API_URL}/razorpay/verify-payment`, {
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_order_id: data.razorpay_order_id,
            razorpay_signature: data.razorpay_signature,
            team_id: userData.team_id,
            amount: 100 // Must match the order amount
        });
        Alert.alert("Success", `Wallet Updated! New Balance: ₹${res.data.new_balance}`);
        fetchProfileData(); 
    } catch (e) {
        Alert.alert("Failed", "Payment verification failed");
    }
  };

  const handleSaveProfile = async () => { try { await axios.post(`${API_URL}/user/update-profile`, { team_id: userData.team_id, ...formData }); Alert.alert("Success", "Profile Updated!"); setEditing(false); fetchProfileData(); } catch (e) { Alert.alert("Error", "Update failed"); } };
  const handleWithdraw = async () => { if (!withdrawAmount || !bankDetails.acc) return Alert.alert("Error", "Fill all details"); try { const bankString = `Bank: ${bankDetails.bank} | Acc: ${bankDetails.acc} | IFSC: ${bankDetails.ifsc}`; await axios.post(`${API_URL}/user/withdraw`, { team_id: userData.team_id, amount: parseInt(withdrawAmount), bank_details: bankString }); setWithdrawModal(false); Alert.alert("Success", "Request Sent!"); fetchProfileData(); } catch (e) { Alert.alert("Error", "Withdrawal Failed"); } };
  const handleLogout = async () => { await AsyncStorage.removeItem("team_id"); router.replace('/'); };
  const handleDateChange = (event, selectedDate) => { setShowDatePicker(false); if (selectedDate) { const d = selectedDate; setFormData({ ...formData, dob: `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}` }); } };
  const formatTextDate = (text) => { const cleaned = text.replace(/[^0-9]/g, ''); if (cleaned.length <= 2) return cleaned; if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`; return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`; };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb"/></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <View style={styles.blueHeader}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
            <TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={24} color="white" /></TouchableOpacity>
            <Text style={styles.headerTitle}>PROFILE</Text>
            <TouchableOpacity onPress={handleLogout}><Feather name="log-out" size={24} color="white" /></TouchableOpacity>
          </View>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <View style={styles.avatarBig}><Text style={styles.avatarTextBig}>{userData?.name?.charAt(0)}</Text></View>
            <View style={{marginLeft: 15}}>
                <Text style={styles.nameBig}>{userData?.name}</Text>
                <Text style={styles.idBig}>Team ID: {userData?.team_id}</Text>
                <View style={styles.walletTag}><Text style={styles.walletTagText}>₹{userData?.wallet_balance}</Text></View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.tabContainer}>
        {['INFO', 'WALLET', 'HISTORY'].map(tab => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]}>
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 100}}>
        {activeTab === "INFO" && (
            <View style={styles.card}>
                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                    <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
                    <TouchableOpacity onPress={() => editing ? handleSaveProfile() : setEditing(true)}>
                        <Text style={{color:'#2563eb', fontWeight:'bold'}}>{editing ? "SAVE" : "EDIT"}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.inputGroup}><Text style={styles.label}>Email</Text><TextInput style={[styles.input, editing && styles.inputEditable]} value={formData.email} onChangeText={t => setFormData({...formData, email: t})} editable={editing} placeholder="Enter Email"/></View>
                <View style={styles.inputGroup}><Text style={styles.label}>Gender</Text><TextInput style={[styles.input, editing && styles.inputEditable]} value={formData.gender} onChangeText={t => setFormData({...formData, gender: t})} editable={editing} placeholder="Male / Female"/></View>
                <View style={styles.inputGroup}><Text style={styles.label}>Date of Birth</Text><View style={{flexDirection:'row', alignItems:'center'}}><TextInput style={[styles.input, styles.dateInput, editing && styles.inputEditable]} value={formData.dob} onChangeText={t => setFormData({...formData, dob: formatTextDate(t)})} editable={editing} placeholder="DD / MM / YYYY" keyboardType="numeric" maxLength={10}/>{editing && (<TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.calendarBtn}><Feather name="calendar" size={22} color="#2563eb" /></TouchableOpacity>)}</View>{showDatePicker && (<DateTimePicker value={new Date()} mode="date" display="default" onChange={handleDateChange} maximumDate={new Date()}/>)}</View>
                <View style={styles.inputGroup}><Text style={styles.label}>Play Location</Text><TextInput style={[styles.input, editing && styles.inputEditable]} value={formData.play_location} onChangeText={t => setFormData({...formData, play_location: t})} editable={editing} placeholder="City / Club"/></View>
            </View>
        )}

        {activeTab === "WALLET" && (
            <>
                <View style={styles.greenCard}>
                    <Text style={styles.earningsLabel}>TOTAL BALANCE</Text>
                    <Text style={styles.earningsValue}>₹{userData?.wallet_balance}</Text>
                    <FontAwesome5 name="wallet" size={60} color="white" style={styles.bgIcon} />
                    <View style={{flexDirection:'row', marginTop: 20, gap: 10}}>
                        <TouchableOpacity style={styles.wBtnWhite} onPress={initiateAddMoney}>
                            <Text style={{color:'#10b981', fontWeight:'bold'}}>+ ADD</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.wBtnOutline} onPress={() => setWithdrawModal(true)}><Text style={{color:'white', fontWeight:'bold'}}>- WITHDRAW</Text></TouchableOpacity>
                    </View>
                </View>
                <Text style={[styles.sectionTitle, {marginTop:20, marginBottom:10}]}>TRANSACTIONS</Text>
                {transactions.length > 0 ? transactions.map((t, i) => (<View key={i} style={styles.txnRow}><View style={{flex:1}}><Text style={styles.txnTitle}>{t.description}</Text><Text style={styles.txnDate}>{new Date(t.date).toLocaleDateString()} • {t.mode}</Text></View><Text style={[styles.txnAmount, t.type === 'DEBIT' ? {color:'red'} : {color:'green'}]}>{t.type === 'DEBIT' ? '-' : '+'}₹{t.amount}</Text></View>)) : <Text style={styles.emptyText}>No transactions found.</Text>}
            </>
        )}

        {activeTab === "HISTORY" && (
            <>
                <Text style={[styles.sectionTitle, {marginBottom:10}]}>MATCH HISTORY</Text>
                {history.length > 0 ? history.map((m, i) => (<View key={i} style={styles.matchCard}><View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:5}}><Text style={{fontSize:10, fontWeight:'bold', color:'#999'}}>{m.date}</Text><Text style={{fontSize:10, fontWeight:'bold', color: m.status==='Official'?'green':'orange'}}>{m.status}</Text></View><View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}><Text style={styles.matchVs}>{m.t1} vs {m.t2}</Text><Text style={styles.matchScore}>{m.score || "-"}</Text></View></View>)) : <Text style={styles.emptyText}>No matches played yet.</Text>}
            </>
        )}
      </ScrollView>

      {/* RAZORPAY COMPONENT INTEGRATED */}
      <RazorpayCheckout 
        visible={payModal} 
        onClose={() => setPayModal(false)} 
        orderDetails={orderDetails} 
        onSuccess={handlePaymentSuccess} 
      />

      <Modal visible={withdrawModal} transparent animationType="slide"><View style={styles.modalBg}><View style={styles.modalCard}><Text style={styles.modalTitle}>WITHDRAW FUNDS</Text><Text style={{color:'#666', marginBottom:15}}>Available: ₹{userData?.wallet_balance}</Text><TextInput style={styles.modalInput} placeholder="Amount (₹)" keyboardType="number-pad" value={withdrawAmount} onChangeText={setWithdrawAmount} /><TextInput style={styles.modalInput} placeholder="Bank Name" value={bankDetails.bank} onChangeText={t=>setBankDetails({...bankDetails, bank:t})} /><TextInput style={styles.modalInput} placeholder="Account Number" keyboardType="number-pad" value={bankDetails.acc} onChangeText={t=>setBankDetails({...bankDetails, acc:t})} /><TextInput style={styles.modalInput} placeholder="IFSC Code" value={bankDetails.ifsc} onChangeText={t=>setBankDetails({...bankDetails, ifsc:t})} /><View style={{flexDirection:'row', gap:10, marginTop:10}}><TouchableOpacity style={styles.cancelBtn} onPress={() => setWithdrawModal(false)}><Text style={{fontWeight:'bold', color:'#666'}}>CANCEL</Text></TouchableOpacity><TouchableOpacity style={styles.submitBtn} onPress={handleWithdraw}><Text style={{fontWeight:'bold', color:'white'}}>CONFIRM</Text></TouchableOpacity></View></View></View></Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={{alignItems:'center'}} onPress={() => router.push('/')}><Feather name="home" size={24} color="#9ca3af" /><Text style={styles.navLabel}>Home</Text></TouchableOpacity>
        <TouchableOpacity style={{alignItems:'center'}} onPress={() => router.push('/compete')}><FontAwesome5 name="trophy" size={22} color="#9ca3af" /><Text style={styles.navLabel}>Compete</Text></TouchableOpacity>
        <TouchableOpacity style={{alignItems:'center'}}><Feather name="user" size={24} color="#2563eb" /><Text style={[styles.navLabel, {color:'#2563eb'}]}>Profile</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {flex:1, justifyContent:'center', alignItems:'center'},
  blueHeader: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '900', fontStyle: 'italic', letterSpacing:1 },
  avatarBig: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  avatarTextBig: { color: '#2563eb', fontWeight: 'bold', fontSize: 30, textAlign: 'center', includeFontPadding: false },
  nameBig: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  idBig: { color: '#bfdbfe', fontSize: 14, fontWeight: 'bold' },
  walletTag: { backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:10, paddingVertical:4, borderRadius:8, alignSelf:'flex-start', marginTop:5 },
  walletTagText: { color:'white', fontWeight:'bold', fontSize:12 },
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 20, marginTop: -25, borderRadius: 15, padding: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 5 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeTabBtn: { backgroundColor: '#eff6ff' },
  tabText: { fontSize: 12, fontWeight: 'bold', color: '#9ca3af' },
  activeTabText: { color: '#2563eb' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 20, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#1f2937', fontStyle:'italic' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af', marginBottom: 5, textTransform:'uppercase' },
  input: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, color: '#333', fontWeight:'bold' },
  inputEditable: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2563eb' },
  dateInput: { flex: 1, letterSpacing: 2 },
  calendarBtn: { padding: 10, marginLeft: 5, backgroundColor: '#eff6ff', borderRadius: 10 },
  greenCard: { backgroundColor: '#10b981', borderRadius: 20, padding: 25, position: 'relative', overflow: 'hidden' },
  earningsLabel: { color: 'white', fontSize: 10, fontWeight: 'bold', opacity: 0.9 },
  earningsValue: { color: 'white', fontSize: 36, fontWeight: '900', marginTop: 5 },
  bgIcon: { position: 'absolute', right: -10, bottom: -15, opacity: 0.2 },
  wBtnWhite: { backgroundColor:'white', paddingHorizontal:20, paddingVertical:10, borderRadius:10 },
  wBtnOutline: { borderWidth:1, borderColor:'white', paddingHorizontal:20, paddingVertical:10, borderRadius:10 },
  txnRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'white', padding:15, borderRadius:15, marginBottom:10 },
  txnTitle: { fontWeight:'bold', color:'#333', fontSize:12 },
  txnDate: { fontSize:10, color:'#999', marginTop:2 },
  txnAmount: { fontWeight:'900', fontSize:14 },
  matchCard: { backgroundColor:'white', padding:15, borderRadius:15, marginBottom:10 },
  matchVs: { fontWeight:'bold', fontSize:14, color:'#333' },
  matchScore: { fontWeight:'900', fontSize:16, color:'#2563eb' },
  emptyText: { textAlign:'center', color:'#ccc', marginTop:20, fontStyle:'italic' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: 'white', width: '85%', padding: 25, borderRadius: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 5 },
  modalInput: { backgroundColor: '#f3f4f6', width: '100%', padding: 12, borderRadius: 10, marginBottom: 10, fontWeight:'bold' },
  submitBtn: { backgroundColor: '#2563eb', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10, flex:1, alignItems:'center' },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, flex:1, alignItems:'center' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#f3f4f6', position:'absolute', bottom:0, width:'100%' },
  navLabel: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af', marginTop: 4 }
});