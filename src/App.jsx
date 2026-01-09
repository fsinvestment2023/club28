import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Trophy, User, ChevronRight, Search, Bell, Home as HomeIcon, CheckCircle, LogOut, Activity, ChevronDown, ArrowLeft, MapPin, Calendar, Wallet, FileText, Save, UserPlus, CreditCard, AlertCircle, RefreshCw, ArrowUpRight, Info } from 'lucide-react';
import Dashboard from './Dashboard.jsx'; 

// --- SHARED COMPONENTS ---
const BottomNav = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/register')) return null;
  const isActive = (path) => location.pathname === path;
  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 py-3 px-6 flex justify-between items-center z-50 max-w-md mx-auto left-0 right-0">
      <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-blue-600' : 'text-gray-400'}`}><HomeIcon size={24} /><span className="text-[10px] font-bold">Home</span></Link>
      <Link to="/compete" className={`flex flex-col items-center gap-1 ${isActive('/compete') ? 'text-blue-600' : 'text-gray-400'}`}><Trophy size={24} /><span className="text-[10px] font-bold">Compete</span></Link>
      <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile') ? 'text-blue-600' : 'text-gray-400'}`}><User size={24} /><span className="text-[10px] font-bold">Profile</span></Link>
    </div>
  );
};

// --- UPDATED SCHEDULE COMPONENT (Fixed Layout) ---
const CompactScheduleList = ({ matches, myTeamID, onAction }) => {
    if (matches.length === 0) return <div className="p-8 text-center text-xs text-gray-400">No matches found.</div>;
    
    // Helper for systematic colors
    const getStageStyle = (stage) => {
        const s = (stage || "").toLowerCase();
        if (s.includes("final") && !s.includes("semi") && !s.includes("quarter")) return "bg-yellow-100 text-yellow-800 border-yellow-200"; // Finals
        if (s.includes("semi")) return "bg-purple-100 text-purple-700 border-purple-200";
        if (s.includes("quarter")) return "bg-blue-100 text-blue-700 border-blue-200";
        if (s.includes("3rd")) return "bg-orange-100 text-orange-800 border-orange-200";
        return "bg-gray-100 text-gray-500 border-gray-200"; // Group Stage
    };

    const byDate = matches.reduce((acc, m) => { if (!acc[m.date]) acc[m.date] = []; acc[m.date].push(m); return acc; }, {});
    
    return (
        <div className="divide-y divide-gray-100">
            {Object.entries(byDate).map(([date, dayMatches]) => {
                const byTime = dayMatches.reduce((acc, m) => { if (!acc[m.time]) acc[m.time] = []; acc[m.time].push(m); return acc; }, {});
                return (
                    <div key={date} className="bg-white">
                        <div className="bg-gray-50 px-4 py-2 border-y border-gray-100 flex justify-between items-center"><span className="font-black text-xs text-gray-800 uppercase">{new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="text-[9px] font-bold text-gray-400">{dayMatches.length} Games</span></div>
                        <div className="divide-y divide-gray-50">{Object.entries(byTime).map(([time, timeMatches], idx) => (
                                <div key={idx} className="flex p-3 hover:bg-blue-50 transition-colors">
                                    {/* Time Column: Fixed width, never shrinks */}
                                    <div className="w-10 pr-2 border-r border-gray-100 flex flex-col justify-center flex-shrink-0"><span className="text-xs font-black text-gray-900">{time.replace(":00 ", "")}</span><span className="text-[8px] font-bold text-gray-400 uppercase">{time.slice(-2)}</span></div>
                                    
                                    {/* Content Column: Grows but allowed to shrink (min-w-0) */}
                                    <div className="flex-1 grid grid-cols-1 gap-2 pl-3 min-w-0">{timeMatches.map((m, mIdx) => (
                                            <div key={mIdx} className="flex items-center justify-between w-full gap-2">
                                                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                                    
                                                    {/* STAGE LABEL: Fixed width, never shrinks */}
                                                    <div className="flex-shrink-0">
                                                        <span className={`text-[6px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wide ${getStageStyle(m.stage)}`}>
                                                            {m.stage === "Group Stage" ? "GRP" : m.stage.substring(0, 4)}
                                                        </span>
                                                    </div>

                                                    {/* TEAMS: Allowed to truncate */}
                                                    <div className="text-xs flex-1 truncate">
                                                        {m.t1 === "TBD" ? (
                                                            <div className="text-[9px] text-gray-400 italic font-bold">Waiting...</div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 truncate">
                                                                <span className={`truncate ${m.t1.includes(myTeamID) ? "font-black text-blue-600" : "font-bold text-gray-700"}`}>{m.t1}</span>
                                                                <span className="text-[8px] text-gray-300 font-bold flex-shrink-0">vs</span>
                                                                <span className={`truncate ${m.t2.includes(myTeamID) ? "font-black text-blue-600" : "font-bold text-gray-700"}`}>{m.t2}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* ACTION BUTTONS: Fixed width, never shrinks */}
                                                {onAction && m.t1 !== "TBD" && <div className="flex-shrink-0 ml-1">{onAction(m)}</div>}
                                            </div>))}</div></div>))}</div></div>);})
            }</div>
    );
};

// --- AUTH PAGES ---
const LoginPage = ({ onLogin }) => {
  const [mode, setMode] = useState("LOGIN"); const [phone, setPhone] = useState(""); const [otp, setOtp] = useState(""); const [name, setName] = useState(""); const [password, setPassword] = useState(""); const [teamId, setTeamId] = useState(""); const [loading, setLoading] = useState(false); const API_URL = "http://127.0.0.1:8000";
  const handleSendOtp = async (nextMode) => { if(phone.length < 10) return alert("Enter valid phone"); setLoading(true); try { await fetch(`${API_URL}/send-otp`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({phone})}); alert("OTP Sent: 1234"); setMode(nextMode); } catch(e) { alert("Server Error"); } setLoading(false); };
  const handleVerifyOtp = (nextMode) => { if(otp !== "1234") return alert("Wrong OTP (Hint: 1234)"); setMode(nextMode); };
  const handleRegister = async () => { if(!name || !password) return alert("Fill all fields"); setLoading(true); try { const res = await fetch(`${API_URL}/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone, name, password }) }); const data = await res.json(); if(res.ok) { alert(`Registration Success! Team ID: ${data.user.team_id}`); setTeamId(data.user.team_id); setMode("LOGIN"); } else { alert(data.detail); } } catch(e) { alert("Registration Error"); } setLoading(false); };
  const handleSignIn = async () => { setLoading(true); try { const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ team_id: teamId, password }) }); const data = await res.json(); if(res.ok) onLogin({ ...data.user, registrations: data.registrations }); else alert(data.detail); } catch (e) { alert("Login Failed: Is backend running?"); } setLoading(false); };
  return (
    <div className="min-h-screen bg-blue-600 p-8 text-white flex flex-col justify-center"><h1 className="text-4xl font-black mb-8 text-center italic">PLAYTOMIC</h1>
        {mode === "LOGIN" && (<div className="space-y-4"><h2 className="font-bold text-xl mb-4">Player Login</h2><input placeholder="Team ID (e.g. SA99)" value={teamId} onChange={e=>setTeamId(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl text-white font-bold placeholder:text-blue-200 outline-none"/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl text-white font-bold placeholder:text-blue-200 outline-none"/><button onClick={handleSignIn} disabled={loading} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black uppercase">Login</button><div className="flex justify-between text-sm font-bold text-blue-200 mt-4"><button onClick={() => setMode("REGISTER_PHONE")}>Create Account</button></div></div>)}
        {mode === "REGISTER_PHONE" && (<div><h2 className="font-bold text-xl mb-4">Register - Step 1</h2><input placeholder="Phone Number" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><button onClick={() => handleSendOtp("REGISTER_OTP")} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Get OTP</button><button onClick={() => setMode("LOGIN")} className="w-full mt-4 text-blue-200 font-bold text-sm">Cancel</button></div>)}
        {mode === "REGISTER_OTP" && (<div><h2 className="font-bold text-xl mb-4">Verify OTP</h2><p className="text-sm mb-4 opacity-80">Sent to {phone}</p><input placeholder="Enter 1234" value={otp} onChange={e=>setOtp(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none text-center tracking-widest"/><button onClick={() => handleVerifyOtp("REGISTER_FINAL")} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Verify</button></div>)}
        {mode === "REGISTER_FINAL" && (<div><h2 className="font-bold text-xl mb-4">Complete Profile</h2><input placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><input type="password" placeholder="Create Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><button onClick={handleRegister} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Finish Setup</button></div>)}
    </div>
  );
};

const TournamentRegistration = ({ onRegister }) => {
    const navigate = useNavigate(); const { id } = useParams(); const [tournament, setTournament] = useState(null); const [categories, setCategories] = useState([]); const [selectedCat, setSelectedCat] = useState(null); const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState([]);
    const [partnerId, setPartnerId] = useState("");
    
    useEffect(() => { const loadData = async () => { const tRes = await fetch('http://127.0.0.1:8000/tournaments'); const tData = await tRes.json(); const found = tData.find(t => t.id.toString() === id); setTournament(found); if (found) { const cats = JSON.parse(found.settings || "[]"); setCategories(cats); if (cats.length > 0) setSelectedCat(cats[0]); try { setSchedule(JSON.parse(found.schedule || "[]")); } catch {} } }; loadData(); }, [id]);
    
    const handlePayment = async (mode, scope) => {
        setLoading(true); 
        const user = JSON.parse(localStorage.getItem("user"));
        
        if (tournament.format === "Doubles" && !partnerId) {
            alert("This is a Doubles Event. Please enter your Partner's Team ID.");
            setLoading(false);
            return;
        }

        try { 
            const response = await fetch('http://127.0.0.1:8000/join-tournament', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    phone: user.phone, 
                    tournament_name: tournament.name, 
                    city: tournament.city, 
                    sport: tournament.sport, 
                    level: selectedCat.name,
                    partner_team_id: partnerId,
                    payment_mode: mode,
                    payment_scope: scope 
                }) 
            });
            const data = await response.json(); 
            if (!response.ok) { 
                const errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
                throw new Error(errorMsg || "Payment Failed"); 
            }
            
            if (data.status === "pending_partner") {
                alert(`Registered! We notified ${partnerId}. They must confirm payment.`);
            } else {
                const updatedUser = { ...user, wallet_balance: data.user.wallet_balance, registrations: data.registrations };
                localStorage.setItem("user", JSON.stringify(updatedUser)); 
                onRegister(updatedUser); 
                alert(`Success! Team Registered.`); 
            }
            navigate('/');
        } catch (error) { 
            console.error("Registration Error:", error);
            alert("Registration Failed: " + error.message); 
        } finally { 
            setLoading(false); 
        }
    };

    if (!tournament || !selectedCat) return <div className="p-10 text-center text-gray-500">Loading Event...</div>;
    
    // UPDATED: Changed label to "Per Match Win"
    const prizes = [ 
        { rank: '1st', amount: selectedCat.p1, icon: '🥇' }, 
        { rank: '2nd', amount: selectedCat.p2, icon: '🥈' }, 
        { rank: '3rd', amount: selectedCat.p3, icon: '🥉' },
        { rank: 'Per Match Win', amount: selectedCat.per_match || 0, icon: '💰' } 
    ];
    
    const perPersonFee = selectedCat.fee;
    const teamFee = selectedCat.fee * 2;
    const isDoubles = tournament.format === "Doubles";

    return (
        <div className="bg-white min-h-screen pb-40"><div className="bg-blue-600 p-6 pt-12 pb-12 text-white rounded-b-[40px] shadow-lg"><button onClick={() => navigate('/compete')} className="mb-6 bg-white/20 p-2 rounded-full"><ArrowLeft size={24}/></button><h1 className="text-3xl font-black italic uppercase mb-2">{tournament.name}</h1><p className="text-blue-100 font-bold text-xs uppercase tracking-widest flex items-center gap-1"><MapPin size={12}/> {tournament.city} • {tournament.sport} <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] ml-2">{tournament.format || "Singles"}</span></p></div>
        
        <div className="p-6 -mt-8">
            
            {/* UPDATED: Added About Event Section */}
            {tournament.about && (
                <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100 mb-6">
                    <div className="flex items-center gap-2 mb-4"><Info className="text-blue-600" size={20}/><h3 className="font-black text-blue-900 text-lg italic uppercase">About Event</h3></div>
                    <p className="text-sm text-gray-600 leading-relaxed font-medium">{tournament.about}</p>
                </div>
            )}

            <div className="bg-white p-6 rounded-[30px] shadow-xl border border-gray-100 mb-6"><h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-gray-400">Select Level</h3><div className="space-y-3">{categories.map((cat, idx) => (<button key={idx} onClick={() => setSelectedCat(cat)} className={`w-full p-4 rounded-xl flex justify-between items-center transition-all ${selectedCat.name === cat.name ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 transform scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><div className="text-left"><span className="font-bold text-sm block">{cat.name}</span><span className="text-[10px] font-bold opacity-70">Per Person: ₹{cat.fee}</span></div>{selectedCat.name === cat.name && <CheckCircle size={18}/>}</button>))}</div></div>
            
            {isDoubles && (
                <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100 mb-6">
                    <div className="flex items-center gap-2 mb-4"><UserPlus className="text-blue-600" size={20}/><h3 className="font-black text-blue-900 text-lg italic uppercase">Doubles Partner</h3></div>
                    <input 
                        value={partnerId} 
                        onChange={(e) => setPartnerId(e.target.value.toUpperCase())}
                        placeholder="Enter Partner's Team ID (e.g. SA25)" 
                        className="w-full p-4 bg-gray-50 rounded-xl font-bold border border-gray-200 outline-none focus:border-blue-500 transition-all uppercase"
                    />
                </div>
            )}

            <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100 mb-6">
                <div className="flex items-center gap-2 mb-4"><Calendar className="text-blue-600" size={20}/><h3 className="font-black text-blue-900 text-lg italic uppercase">Schedule & Venue</h3></div>
                {schedule.length > 0 && (<div className="mb-6 bg-gray-50 rounded-xl p-4">{schedule.map((row, idx) => (<div key={idx} className="flex justify-between text-sm py-2 border-b border-gray-200 last:border-0"><span className="font-bold text-gray-500 w-1/3">{row.label}</span><span className="font-black text-gray-800 text-right flex-1">{row.value}</span></div>))}</div>)}
                {tournament.venue && (<div className="flex items-start gap-3"><MapPin className="text-gray-400 mt-1" size={16} /><p className="text-xs font-bold text-gray-600 leading-relaxed">{tournament.venue}</p></div>)}
            </div>
            
            <div className="bg-blue-50 p-6 rounded-[30px] border border-blue-100 mb-24"><div className="flex items-center gap-3 mb-6"><Trophy className="text-yellow-500" size={24} fill="currentColor"/><div><span className="block font-black text-lg text-blue-900 uppercase italic">Prize Pool</span><span className="text-[10px] font-bold text-blue-400 uppercase">{selectedCat.name} Only</span></div></div><div className="space-y-3">{prizes.map((p, i) => (<div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm"><span className="font-bold text-gray-500 text-xs uppercase flex items-center gap-2"><span className="text-lg">{p.icon}</span> {p.rank} Place</span><span className="font-black text-lg text-blue-600">₹{p.amount}</span></div>))}</div></div>
        </div>
        
        {/* PAYMENT OPTIONS */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-6 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
            {isDoubles ? (
                <>
                <div className="mb-4">
                     <button onClick={() => handlePayment("WALLET", "INDIVIDUAL")} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-xs shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all mb-2">Pay My Share (₹{perPersonFee})</button>
                     <p className="text-[9px] text-gray-400 text-center font-bold flex items-center justify-center gap-1"><AlertCircle size={10}/> No refund if partner doesn't join.</p>
                </div>
                <button onClick={() => handlePayment("WALLET", "TEAM")} className="w-full bg-black text-white font-black py-4 rounded-xl uppercase text-xs shadow-lg flex items-center justify-center gap-2 hover:bg-gray-800 transition-all">Pay Full Team (₹{teamFee})</button>
                </>
            ) : (
                <button onClick={() => handlePayment("WALLET", "INDIVIDUAL")} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-xs shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">Pay Entry (₹{perPersonFee})</button>
            )}
            
            <div className="text-center mt-3"><p className="text-[10px] text-green-600 font-bold uppercase bg-green-50 px-2 py-1 rounded inline-block">Wallet: ₹{JSON.parse(localStorage.getItem("user"))?.wallet_balance || 0}</p></div>
        </div>
    </div>
    );
};

const CompetePage = () => {
    const [tournaments, setTournaments] = useState([]);
    const [filteredTournaments, setFilteredTournaments] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState("MUMBAI"); 
    const [selectedSport, setSelectedSport] = useState("All");
    const navigate = useNavigate();
    
    useEffect(() => { 
        fetch('http://127.0.0.1:8000/tournaments').then(res => res.json()).then(data => {
            setTournaments(data);
            const allCities = data.map(t => (t.city || "Mumbai").trim().toUpperCase());
            const uniqueCities = [...new Set(allCities)];
            setCities(uniqueCities);
            if(uniqueCities.length > 0) setSelectedCity(uniqueCities[0]);
        }); 
    }, []);

    useEffect(() => {
        let filtered = tournaments;
        if(selectedCity) { filtered = filtered.filter(t => (t.city || "Mumbai").trim().toUpperCase() === selectedCity); }
        if(selectedSport && selectedSport !== "All") { filtered = filtered.filter(t => (t.sport || "Padel") === selectedSport); }
        setFilteredTournaments(filtered);
    }, [selectedCity, selectedSport, tournaments]);

    const availableSports = ["All", ...new Set(tournaments.filter(t => (t.city || "Mumbai").trim().toUpperCase() === selectedCity).map(t => t.sport || "Padel"))];

    return (
        <div className="pb-24 bg-gray-50 min-h-screen font-sans">
            <div className="bg-blue-600 p-6 pt-12 pb-12 text-white rounded-b-[40px] shadow-lg mb-[-20px]"><h1 className="text-3xl font-black italic uppercase">Events</h1><p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-4">Select a League to Join</p><div className="bg-white/20 p-1 rounded-xl flex overflow-x-auto no-scrollbar gap-2 mb-4">{cities.map(city => (<button key={city} onClick={() => { setSelectedCity(city); setSelectedSport("All"); }} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase whitespace-nowrap transition-all ${selectedCity === city ? 'bg-white text-blue-600 shadow-md' : 'text-blue-100 hover:bg-white/10'}`}>{city}</button>))}</div><div className="flex overflow-x-auto no-scrollbar gap-2">{availableSports.map(sport => (<button key={sport} onClick={() => setSelectedSport(sport)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap transition-all ${selectedSport === sport ? 'bg-yellow-400 text-blue-900 border-yellow-400' : 'bg-blue-700 text-blue-200 border-blue-500'}`}>{sport}</button>))}</div></div>
            <div className="p-6 space-y-4 pt-10">{filteredTournaments.length > 0 ? (filteredTournaments.map(t => (<div key={t.id} onClick={() => navigate(`/register/${t.id}`)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-all active:scale-95"><div><span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block mr-2">{t.type}</span><span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block">{t.sport || "Padel"}</span><h3 className="font-bold text-gray-800 text-lg">{t.name}</h3><p className="text-gray-400 text-xs font-bold flex items-center gap-1"><MapPin size={10}/> {t.city || "Mumbai"} • Starts from ₹{t.fee}</p></div><div className="bg-gray-50 p-2 rounded-full text-gray-400"><ChevronRight size={20}/></div></div>))) : (<div className="text-center text-gray-400 mt-10 text-xs font-bold">No events found.</div>)}</div>
        </div>
    );
};

const OngoingEvents = ({ category, city, level, myTeamID }) => {
    const [activeTab, setActiveTab] = useState("SCHEDULE"); const [activeGroup, setActiveGroup] = useState('A'); const [schedule, setSchedule] = useState([]); const [standings, setStandings] = useState([]); const [scores, setScores] = useState({}); const [selectedMatch, setSelectedMatch] = useState(null); const [scoreInput, setScoreInput] = useState("");
    const fetchData = async () => { try { const safeLevel = level || ""; const encodedLevel = encodeURIComponent(safeLevel); const [schRes, scoreRes, rankRes] = await Promise.all([ fetch('http://127.0.0.1:8000/generate-test-season'), fetch('http://127.0.0.1:8000/scores'), fetch(`http://127.0.0.1:8000/standings?tournament=${category}&city=${city}&level=${encodedLevel}`) ]); const schData = await schRes.json(); const scoreData = await scoreRes.json(); const rankData = await rankRes.json(); const allMatches = schData.full_schedule?.schedule || []; const myMatches = allMatches.filter(m => m.category === category && m.city === city).sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time)); setSchedule(myMatches); setStandings(rankData); const scoreMap = {}; scoreData.forEach(s => scoreMap[s.id] = s); setScores(scoreMap); } catch(err) { console.log(err); } };
    useEffect(() => { fetchData(); const interval = setInterval(fetchData, 5000); return () => clearInterval(interval); }, [category, city, level]);
    const handleScoreSubmit = async () => { if(!selectedMatch) return; await fetch('http://127.0.0.1:8000/submit-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: selectedMatch.id, category: category, t1_name: selectedMatch.t1, t2_name: selectedMatch.t2, score: scoreInput, submitted_by_team: myTeamID }) }); alert("Score sent! Opponent must verify."); setSelectedMatch(null); setScoreInput(""); fetchData(); };
    const handleVerify = async (matchId, action) => { await fetch('http://127.0.0.1:8000/verify-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId, action: action }) }); alert(action === "APPROVE" ? "Score Verified!" : "Score Rejected"); fetchData(); };
    const filteredStandings = standings.filter(t => t.group === activeGroup).sort((a, b) => b.points - a.points);
    const getRankIcon = (index) => { if (index < 2) return <div className="bg-green-100 text-green-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">Q</div>; return <span className="font-bold text-gray-400 text-xs w-5 text-center">{index + 1}</span>; };
    const renderMatchAction = (match) => { const scoreEntry = scores[match.id]; 
        const iAmInT1 = match.t1.includes(myTeamID); const iAmInT2 = match.t2.includes(myTeamID);
        if (!iAmInT1 && !iAmInT2) return null; 
        if (!scoreEntry || !scoreEntry.score) return <button onClick={() => setSelectedMatch(match)} className="bg-blue-50 text-blue-600 text-[8px] font-bold px-2 py-1 rounded border border-blue-100">+ Score</button>; 
        if (scoreEntry.status === "Official") return <span className="text-green-600 text-[9px] font-black">{scoreEntry.score}</span>; 
        if (scoreEntry.status === "Disputed") return <span className="text-red-500 text-[9px] font-black">⚠ Disputed</span>; 
        const myTeamString = iAmInT1 ? match.t1 : match.t2;
        if (myTeamString.includes(scoreEntry.submitted_by_team)) { return <span className="text-gray-400 text-[8px] font-bold italic">Waiting...</span>; }
        return (<div className="flex gap-1 items-center"><span className="text-xs font-black mr-1">{scoreEntry.score}</span><button onClick={() => handleVerify(match.id, "DENY")} className="text-red-500 text-[8px] font-bold border border-red-100 px-1 rounded">X</button><button onClick={() => handleVerify(match.id, "APPROVE")} className="text-green-600 text-[8px] font-bold border border-green-100 px-1 rounded">✓</button></div>); 
    };

    return (
        <div className="mt-8 mb-24 px-6"><div className="flex items-center gap-2 mb-4"><Activity className="text-green-500 animate-pulse" size={20}/><h2 className="text-lg font-black italic uppercase">Ongoing Event ({city})</h2></div><div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"><div className="bg-blue-600 p-4 flex justify-between items-center text-white"><div><p className="text-[10px] font-bold opacity-80 uppercase">Tournament</p><h3 className="font-black text-lg italic">{category} <span className="text-sm font-black text-yellow-300 ml-1">({level ? level.toUpperCase() : "..."})</span></h3></div><div className="text-right"><p className="text-[10px] font-bold opacity-80 uppercase">My Rank</p><p className="font-black text-2xl">#{standings.findIndex(t => t.name.includes(myTeamID)) + 1 || "-"}</p></div></div><div className="flex border-b border-gray-100 divide-x divide-gray-100"><div className="flex-1 p-3 text-center"><p className="text-[9px] text-gray-400 font-bold uppercase">Played</p><p className="font-black text-lg">{standings.find(t => t.name.includes(myTeamID))?.played || 0}</p></div><div className="flex-1 p-3 text-center"><p className="text-[9px] text-gray-400 font-bold uppercase">Won</p><p className="font-black text-lg text-green-600">{standings.find(t => t.name.includes(myTeamID))?.gamesWon || 0}</p></div><div className="flex-1 p-3 text-center"><p className="text-[9px] text-gray-400 font-bold uppercase">Points</p><p className="font-black text-lg text-blue-600">{standings.find(t => t.name.includes(myTeamID))?.points || 0}</p></div></div><div className="flex border-b border-gray-100"><button onClick={() => setActiveTab("SCHEDULE")} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === "SCHEDULE" ? "bg-gray-50 text-blue-600" : "text-gray-400"}`}>Schedule</button><button onClick={() => setActiveTab("STANDINGS")} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === "STANDINGS" ? "bg-gray-50 text-blue-600" : "text-gray-400"}`}>Leaderboard</button></div><div className="max-h-96 overflow-y-auto">{activeTab === "SCHEDULE" ? ( <CompactScheduleList matches={schedule} myTeamID={myTeamID} onAction={renderMatchAction} /> ) : (<div className="pb-4"><div className="flex justify-center p-3 bg-gray-50 border-b border-gray-100"><div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">{['A', 'B', 'C', 'D'].map((group) => (<button key={group} onClick={() => setActiveGroup(group)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeGroup === group ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>Group {group}</button>))}</div></div>
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase"><div className="col-span-2 text-center">Rank</div><div className="col-span-4">Team</div><div className="col-span-2 text-center">Matches</div><div className="col-span-2 text-center">Games</div><div className="col-span-2 text-center">Pts</div></div>
        <div className="divide-y divide-gray-50">{filteredStandings.length > 0 ? (filteredStandings.map((t, i) => (<div key={i} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${i < 2 ? "bg-green-50 border-l-4 border-green-500" : (t.name.includes(myTeamID) ? "bg-blue-50" : "hover:bg-gray-50")}`}><div className="col-span-2 flex justify-center">{getRankIcon(i)}</div><div className="col-span-4 font-bold text-gray-700 text-xs truncate">{t.name}</div><div className="col-span-2 text-center text-gray-500 font-bold text-xs">{t.played}</div><div className="col-span-2 text-center text-green-600 font-bold text-xs">{t.totalGamePoints}</div><div className="col-span-2 text-center font-black text-blue-600 text-xs">{t.points}</div></div>))) : (<div className="p-6 text-center text-gray-400 text-xs">No teams in Group {activeGroup}</div>)}</div></div>)}</div></div> {selectedMatch && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"><h3 className="text-xl font-black italic uppercase mb-1 text-center">Match Result</h3><p className="text-xs text-gray-500 font-bold mb-6 text-center">{selectedMatch.t1} vs {selectedMatch.t2}</p><input type="text" placeholder="e.g. 6-4, 6-2" className="w-full bg-gray-100 p-4 rounded-xl font-bold text-lg mb-4 text-center outline-none" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)}/><div className="flex gap-3"><button onClick={() => setSelectedMatch(null)} className="flex-1 bg-gray-200 text-gray-600 py-3 rounded-xl font-bold text-xs uppercase">Cancel</button><button onClick={handleScoreSubmit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Submit</button></div></div></div>)}</div>
    );
};

const HomePage = ({ user, onRefresh }) => {
  const navigate = useNavigate(); 
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [viewingKey, setViewingKey] = useState(""); 
  const [pendingRequests, setPendingRequests] = useState([]);
  
  useEffect(() => { 
      if (user?.registrations?.length > 0) {
          if (!viewingKey) { setViewingKey(`${user.registrations[0].tournament}|${user.registrations[0].city}`); }
      }
  }, [user]);

  useEffect(() => { 
      fetch('http://127.0.0.1:8000/tournaments').then(res => res.json()).then(data => setAvailableTournaments(data)); 
      
      const refreshUser = async () => {
          if (!user?.team_id) return;
          try {
              const res = await fetch(`http://127.0.0.1:8000/user/${user.team_id}`);
              if (res.ok) {
                  const latestUser = await res.json();
                  onRefresh(latestUser); 
              }
              const pendRes = await fetch(`http://127.0.0.1:8000/user/${user.team_id}/pending`);
              if (pendRes.ok) setPendingRequests(await pendRes.json());
          } catch(e) { console.error("Sync failed", e); }
      };
      refreshUser();
  }, []);

  const handleConfirmPartner = async (regId) => {
      try {
          const res = await fetch('http://127.0.0.1:8000/confirm-partner', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ reg_id: regId, payment_mode: "WALLET" }) });
          const data = await res.json();
          if (res.ok) { alert("Registration Confirmed!"); window.location.reload(); } else { alert("Error: " + data.detail); }
      } catch(e) { console.error(e); }
  };

  const [viewName, viewCity] = viewingKey ? viewingKey.split('|') : ["", ""];
  const currentRegistration = user?.registrations?.find(r => r.tournament === viewName && r.city === viewCity);
  const handleQuickAction = (action) => { if (action === 'Compete') navigate('/compete'); else alert("Coming Soon!"); };
  
  return (
    <div className="pb-24 bg-gray-50 min-h-screen font-sans text-gray-900"><div className="bg-blue-600 p-6 pt-12 pb-20 rounded-b-[40px] shadow-lg mb-[-40px]"><div className="flex justify-between items-center mb-6 text-white"><h1 className="text-xl font-extrabold italic tracking-wide">PLAYTOMIC</h1><div className="flex gap-4"><Search size={20} /><Bell size={20} /></div></div><div className="flex justify-between items-center text-white"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center font-black text-xl">{user?.name?.charAt(0)}</div><div><h2 className="text-xl font-bold">{user?.name}</h2><p className="text-blue-200 text-xs font-bold">{user?.team_id}</p></div></div><div className="relative"><select value={viewingKey} onChange={(e) => setViewingKey(e.target.value)} className="appearance-none bg-blue-700 text-white font-bold text-xs py-2 pl-3 pr-8 rounded-lg outline-none">{user?.registrations && user.registrations.length > 0 ? (user.registrations.map((r, idx) => (<option key={idx} value={`${r.tournament}|${r.city}`}>{r.tournament} ({r.city})</option>))) : (<option>No events</option>)}</select><ChevronDown size={14} className="absolute right-2 top-2.5 text-white pointer-events-none" /></div></div></div><div className="mx-6 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 flex justify-between items-center relative z-10 mb-8"><div className="text-center flex-1 border-r border-gray-100"><p className="text-[10px] text-gray-400 font-bold uppercase">Wallet</p><p className="text-xl font-black text-gray-800">₹{user?.wallet_balance || 0}</p></div><div className="text-center flex-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Matches</p><p className="text-xl font-black text-gray-800">0</p></div></div><div className="px-6 grid grid-cols-4 gap-4 text-center mb-4">{['Book Court', 'Learn', 'Compete', 'Find Match'].map((item, i) => (<div key={i} onClick={() => handleQuickAction(item)} className="flex flex-col items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform"><div className={`w-14 h-14 rounded-full shadow-sm border border-gray-100 flex items-center justify-center ${item === 'Compete' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600'}`}>{item === 'Compete' ? <Trophy size={24} /> : <div className="w-6 h-6 bg-blue-100 rounded-full"/>}</div><span className="text-[10px] font-bold text-gray-600">{item}</span></div>))}</div>
    
    {pendingRequests.length > 0 && (<div className="mx-6 mb-4"><h3 className="font-bold text-gray-700 text-xs uppercase mb-2">Pending Requests</h3>{pendingRequests.map(req => (<div key={req.reg_id} className="bg-orange-50 border border-orange-200 p-4 rounded-xl mb-2 flex justify-between items-center"><div><p className="text-xs font-bold text-orange-800 uppercase">{req.tournament} ({req.level})</p><p className="text-[10px] text-gray-600">Invited by <b>{req.partner}</b></p></div><button onClick={() => handleConfirmPartner(req.reg_id)} className="bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm">Pay ₹{req.fee_share} & Join</button></div>))}</div>)}

    {currentRegistration ? (<OngoingEvents category={viewName} city={viewCity} level={currentRegistration.level} myTeamID={user?.team_id} />) : (<div className="mx-6 mt-16 p-6 bg-white rounded-3xl border border-dashed border-gray-300 text-center"><Trophy className="mx-auto text-gray-300 mb-2" size={32}/><p className="text-xs font-bold text-gray-400 mb-4">Not registered for any active event.</p><button onClick={() => navigate('/compete')} className="bg-blue-600 text-white text-xs font-black uppercase px-6 py-3 rounded-xl shadow-lg">Find a League</button></div>)}
    </div>
  );
};

const ProfilePage = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState("INFO");
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ email: user?.email || "", gender: user?.gender || "", dob: user?.dob || "", play_location: user?.play_location || "" });
    const [history, setHistory] = useState([]);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        if(user?.team_id) {
            fetch(`http://127.0.0.1:8000/user/${user.team_id}/history`).then(res => res.json()).then(data => setHistory(data));
            fetch(`http://127.0.0.1:8000/user/${user.team_id}/transactions`).then(res => res.json()).then(data => setTransactions(data));
        }
    }, [user]);

    const handleSave = async () => { const res = await fetch('http://127.0.0.1:8000/user/update-profile', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ team_id: user.team_id, email: formData.email, gender: formData.gender, dob: formData.dob, play_location: formData.play_location }) }); if(res.ok) { alert("Profile Updated!"); setEditMode(false); window.location.reload(); } };
    const handleAddMoney = async () => { const amount = prompt("Enter amount to add (Simulated Razorpay):", "500"); if(!amount) return; const res = await fetch('http://127.0.0.1:8000/admin/add-wallet', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ team_id: user.team_id, amount: parseInt(amount) }) }); if(res.ok) { alert(`₹${amount} added successfully! (Simulated)`); window.location.reload(); } };

    // --- WITHDRAW FUNCTION ---
    const handleWithdraw = async () => {
        const amount = prompt("Enter amount to withdraw:", "500");
        if(!amount) return;
        try {
            const res = await fetch('http://127.0.0.1:8000/user/withdraw', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ team_id: user.team_id, amount: parseInt(amount) })
            });
            const data = await res.json();
            if(res.ok) {
                alert(`₹${amount} withdrawal requested!`);
                window.location.reload();
            } else {
                alert("Withdrawal Failed: " + data.detail);
            }
        } catch(e) { alert("Error connecting to server"); }
    };

    // --- COLOR LOGIC FOR TRANSACTIONS ---
    const getAmountColor = (t) => {
        if (t.type === "CREDIT") return "text-green-600";
        if (t.mode === "WITHDRAWAL") return "text-red-500";
        return "text-pink-500"; // EVENT_FEE
    };

    return (
        <div className="pb-24 bg-white min-h-screen font-sans"><div className="bg-blue-600 text-white p-8 pt-12 rounded-b-[40px] shadow-lg mb-8"><div className="flex items-center gap-4 mb-6"><div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center font-black text-2xl shadow-inner">{user?.name?.charAt(0) || "P"}</div><div><h1 className="text-2xl font-bold">{user?.name || "Player"}</h1><p className="text-xs opacity-80">Team ID: {user?.team_id}</p><p className="text-xs font-bold bg-blue-700 px-2 py-1 rounded inline-block mt-1">₹{user?.wallet_balance}</p></div></div><div className="flex bg-blue-700 p-1 rounded-xl">{['INFO', 'WALLET', 'HISTORY'].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow' : 'text-blue-200'}`}>{tab}</button>))}</div></div><div className="p-6">{activeTab === "INFO" && (<div className="space-y-4"><h3 className="font-black text-lg text-gray-800 flex items-center gap-2"><User size={20}/> Personal Information</h3><div className="grid gap-3"><div><label className="text-[10px] font-bold text-gray-400 uppercase">Email</label><input disabled={!editMode} value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm border border-gray-100"/></div><div><label className="text-[10px] font-bold text-gray-400 uppercase">Gender</label><select disabled={!editMode} value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm border border-gray-100"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div><div><label className="text-[10px] font-bold text-gray-400 uppercase">Date of Birth</label><input type="date" disabled={!editMode} value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm border border-gray-100"/></div><div><label className="text-[10px] font-bold text-gray-400 uppercase">Where do you play?</label><input disabled={!editMode} value={formData.play_location} onChange={e=>setFormData({...formData, play_location: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm border border-gray-100"/></div></div>{editMode ? (<button onClick={handleSave} className="w-full bg-green-600 text-white p-4 rounded-xl font-black uppercase flex items-center justify-center gap-2 shadow-lg"><Save size={18}/> Save Changes</button>) : (<button onClick={() => setEditMode(true)} className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase shadow-lg">Edit Profile</button>)}</div>)}{activeTab === "WALLET" && (<div className="text-center mb-8"><Wallet size={48} className="mx-auto text-blue-200 mb-4"/><h2 className="text-4xl font-black text-gray-800 mb-2">₹{user?.wallet_balance}</h2><p className="text-xs font-bold text-gray-400 uppercase mb-4">Current Balance</p><div className="flex gap-2 mb-4"><button onClick={handleAddMoney} className="flex-1 bg-black text-white p-4 rounded-xl font-black uppercase shadow-lg">Add Money +</button><button onClick={handleWithdraw} className="flex-1 bg-gray-100 text-gray-800 p-4 rounded-xl font-black uppercase shadow-sm border border-gray-200 hover:bg-gray-200">Withdraw -</button></div><h3 className="font-bold text-gray-700 text-xs uppercase mb-3 flex items-center gap-2"><RefreshCw size={14}/> Recent Transactions</h3><div className="space-y-3">{transactions.length > 0 ? (transactions.map(t => (<div key={t.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100"><div><p className="font-bold text-gray-800 text-xs">{t.description}</p><p className="text-[10px] text-gray-400 uppercase">{new Date(t.date).toLocaleDateString()}</p></div><p className={`font-black text-sm ${getAmountColor(t)}`}>{t.type === "CREDIT" ? "+" : "-"}₹{t.amount}</p></div>))) : (<p className="text-center text-gray-400 text-xs">No transactions yet.</p>)}</div></div>)}{activeTab === "HISTORY" && (<div><h3 className="font-black text-lg text-gray-800 flex items-center gap-2 mb-4"><FileText size={20}/> Match History</h3>{history.length > 0 ? (<div className="space-y-2">{history.map(m => (<div key={m.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-100"><div><p className="text-[10px] font-bold text-gray-400 uppercase">{m.date}</p><p className="font-black text-sm">{m.t1} vs {m.t2}</p></div><div className="text-right"><p className="font-black text-lg text-blue-600">{m.score || "-"}</p><p className="text-[9px] font-bold text-gray-400 uppercase">{m.status}</p></div></div>))}</div>) : (<p className="text-center text-gray-400 text-xs font-bold mt-10">No matches played yet.</p>)}</div>)}<div className="mt-12 pt-12 border-t border-gray-100"><button onClick={onLogout} className="w-full bg-red-50 text-red-500 p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"><LogOut size={16}/> Log Out</button></div></div></div>
    );
};

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem("user") ? true : false);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const handleLogin = (userData) => { setIsLoggedIn(true); setUser(userData); localStorage.setItem("user", JSON.stringify(userData)); };
  const handleLogout = () => { setIsLoggedIn(false); setUser(null); localStorage.removeItem("user"); };
  const handleRegistrationUpdate = (updatedUser) => { setUser(updatedUser); localStorage.setItem("user", JSON.stringify(updatedUser)); };
  return (
    <div className={isAdmin ? "w-full min-h-screen bg-gray-100" : "max-w-md mx-auto shadow-lg min-h-screen bg-gray-50 flex flex-col"}>
      {!isLoggedIn && !isAdmin ? ( <LoginPage onLogin={handleLogin} /> ) : ( <> <div className="flex-1 overflow-y-auto"> <Routes> <Route path="/" element={<HomePage user={user} onRefresh={handleRegistrationUpdate} />} /> <Route path="/compete" element={<CompetePage />} /> <Route path="/register/:id" element={<TournamentRegistration onRegister={handleRegistrationUpdate} />} /> <Route path="/profile" element={<ProfilePage user={user} onLogout={handleLogout} />} /> <Route path="/admin" element={<Dashboard />} /> </Routes> </div> <BottomNav /> </> )}
    </div>
  );
}
export default function App() { return (<Router><AppContent /></Router>); }