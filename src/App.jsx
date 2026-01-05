import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Trophy, User, Calendar, ChevronRight, Search, Bell, Home as HomeIcon, CheckCircle, LogOut, Activity, ChevronDown, ArrowLeft, Lock, Smartphone } from 'lucide-react';
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

const CompactScheduleList = ({ matches, myTeamID, onAction }) => {
    if (matches.length === 0) return <div className="p-8 text-center text-xs text-gray-400">No matches found.</div>;
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
                                    <div className="w-14 pr-2 border-r border-gray-100 flex flex-col justify-center"><span className="text-xs font-black text-gray-900">{time.replace(":00 ", "")}</span><span className="text-[8px] font-bold text-gray-400 uppercase">{time.slice(-2)}</span></div>
                                    <div className="flex-1 grid grid-cols-1 gap-2 pl-3">{timeMatches.map((m, mIdx) => (
                                            <div key={mIdx} className="flex items-center justify-between"><div className="text-xs w-full">{m.t1 === "TBD" ? (<div className="flex items-center gap-2"><span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded uppercase">{m.stage}</span><span className="text-[9px] text-gray-400 italic">{m.group}</span></div>) : (<div className="flex items-center gap-1"><span className={m.t1 === myTeamID ? "font-black text-blue-600" : "font-bold text-gray-700"}>{m.t1}</span><span className="text-[9px] text-gray-300 px-1">vs</span><span className={m.t2 === myTeamID ? "font-black text-blue-600" : "font-bold text-gray-700"}>{m.t2}</span></div>)}</div>{onAction && m.t1 !== "TBD" && onAction(m)}</div>))}</div></div>))}</div></div>);})
            }</div>
    );
};

// --- AUTH PAGES ---
const LoginPage = ({ onLogin }) => {
  const [mode, setMode] = useState("LOGIN");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const API_URL = "http://127.0.0.1:8000";

  const handleSendOtp = async (nextMode) => {
      if(phone.length < 10) return alert("Enter valid phone");
      setLoading(true);
      try { await fetch(`${API_URL}/send-otp`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({phone})}); alert("OTP Sent: 1234"); setMode(nextMode); } catch(e) { alert("Server Error"); }
      setLoading(false);
  };
  const handleVerifyOtp = (nextMode) => { if(otp !== "1234") return alert("Wrong OTP (Hint: 1234)"); setMode(nextMode); };
  const handleRegister = async () => {
      if(!name || !password) return alert("Fill all fields");
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone, name, password }) });
        const data = await res.json();
        if(res.ok) { alert(`Registration Success! Team ID: ${data.user.team_id}`); setTeamId(data.user.team_id); setMode("LOGIN"); } else { alert(data.detail); }
      } catch(e) { alert("Registration Error"); }
      setLoading(false);
  };
  const handleResetPassword = async () => {
      const res = await fetch(`${API_URL}/reset-password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone, new_password: password }) });
      if(res.ok) { alert("Password Changed!"); setMode("LOGIN"); } else alert("Error");
  };
  const handleSignIn = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ team_id: teamId, password }) });
        const data = await res.json();
        if(res.ok) onLogin(data.user); else alert(data.detail);
      } catch (e) { alert("Login Failed: Is backend running?"); }
      setLoading(false);
  };

  return (
    <div className="min-h-screen bg-blue-600 p-8 text-white flex flex-col justify-center">
        <h1 className="text-4xl font-black mb-8 text-center italic">PLAYTOMIC</h1>
        {mode === "LOGIN" && (<div className="space-y-4"><h2 className="font-bold text-xl mb-4">Player Login</h2><input placeholder="Team ID (e.g. SA99)" value={teamId} onChange={e=>setTeamId(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl text-white font-bold placeholder:text-blue-200 outline-none"/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl text-white font-bold placeholder:text-blue-200 outline-none"/><button onClick={handleSignIn} disabled={loading} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black uppercase">Login</button><div className="flex justify-between text-sm font-bold text-blue-200 mt-4"><button onClick={() => setMode("REGISTER_PHONE")}>Create Account</button><button onClick={() => setMode("FORGOT_PHONE")}>Forgot Password?</button></div></div>)}
        {mode === "REGISTER_PHONE" && (<div><h2 className="font-bold text-xl mb-4">Register - Step 1</h2><input placeholder="Phone Number" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><button onClick={() => handleSendOtp("REGISTER_OTP")} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Get OTP</button><button onClick={() => setMode("LOGIN")} className="w-full mt-4 text-blue-200 font-bold text-sm">Cancel</button></div>)}
        {mode === "REGISTER_OTP" && (<div><h2 className="font-bold text-xl mb-4">Verify OTP</h2><p className="text-sm mb-4 opacity-80">Sent to {phone}</p><input placeholder="Enter 1234" value={otp} onChange={e=>setOtp(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none text-center tracking-widest"/><button onClick={() => handleVerifyOtp("REGISTER_FINAL")} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Verify</button></div>)}
        {mode === "REGISTER_FINAL" && (<div><h2 className="font-bold text-xl mb-4">Complete Profile</h2><input placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><input type="password" placeholder="Create Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><button onClick={handleRegister} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Finish Setup</button></div>)}
        {mode === "FORGOT_PHONE" && (<div><h2 className="font-bold text-xl mb-4">Reset Password</h2><input placeholder="Phone Number" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><button onClick={() => handleSendOtp("FORGOT_OTP")} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Get OTP</button><button onClick={() => setMode("LOGIN")} className="w-full mt-4 text-blue-200 font-bold text-sm">Back to Login</button></div>)}
        {mode === "FORGOT_OTP" && (<div><h2 className="font-bold text-xl mb-4">Verify OTP</h2><input placeholder="Enter 1234" value={otp} onChange={e=>setOtp(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none text-center"/><button onClick={() => handleVerifyOtp("FORGOT_FINAL")} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Verify</button></div>)}
        {mode === "FORGOT_FINAL" && (<div><h2 className="font-bold text-xl mb-4">Set New Password</h2><input type="password" placeholder="New Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white/20 p-4 rounded-xl mb-4 font-bold outline-none"/><button onClick={handleResetPassword} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black">Update Password</button></div>)}
    </div>
  );
};

const TournamentRegistration = ({ onRegister }) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [categories, setCategories] = useState([]);
    const [selectedCat, setSelectedCat] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [previewSchedule, setPreviewSchedule] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            const tRes = await fetch('http://127.0.0.1:8000/tournaments');
            const tData = await tRes.json();
            const found = tData.find(t => t.id.toString() === id);
            setTournament(found);
            if (found) {
                const cats = JSON.parse(found.settings || "[]");
                setCategories(cats);
                if (cats.length > 0) setSelectedCat(cats[0]);
                const sRes = await fetch('http://127.0.0.1:8000/generate-test-season');
                const sData = await sRes.json();
                setPreviewSchedule((sData.full_schedule?.schedule || []).filter(m => m.category === found.name));
            }
        };
        loadData();
    }, [id]);

    const handlePayment = async () => {
        setLoading(true);
        const user = JSON.parse(localStorage.getItem("user"));
        try {
            const response = await fetch('http://127.0.0.1:8000/join-tournament', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: user.phone, tournament_name: tournament.name, level: selectedCat.name }) });
            if (!response.ok) { const err = await response.json(); throw new Error(err.detail || "Payment Failed"); }
            const data = await response.json();
            const updatedUser = data.user; 
            localStorage.setItem("user", JSON.stringify(updatedUser));
            onRegister(updatedUser);
            alert(`Success! Joined ${tournament.name}`); navigate('/');
        } catch (error) { alert("Registration Failed: " + error.message); } finally { setLoading(false); }
    };

    if (!tournament || !selectedCat) return <div className="p-10 text-center text-gray-500">Loading Event...</div>;
    const p1 = parseInt(selectedCat.p1) || 0; const p2 = parseInt(selectedCat.p2) || 0; const p3 = parseInt(selectedCat.p3) || 0;
    const prizes = [ { rank: '1st Place', amount: p1.toLocaleString(), icon: '🥇' }, { rank: '2nd Place', amount: p2.toLocaleString(), icon: '🥈' }, { rank: '3rd Place', amount: p3.toLocaleString(), icon: '🥉' } ];

    return (
        <div className="bg-white min-h-screen font-sans pb-32">
            <div className="bg-blue-600 p-6 pt-12 pb-12 text-white rounded-b-[40px] shadow-lg">
                <button onClick={() => navigate('/compete')} className="mb-6 bg-white/20 p-2 rounded-full"><ArrowLeft size={24}/></button><h1 className="text-3xl font-black italic uppercase mb-2">{tournament.name}</h1><p className="text-blue-100 font-bold text-xs uppercase tracking-widest">Registration Open</p>
            </div>
            <div className="p-6 -mt-8">
                <div className="bg-white p-6 rounded-[30px] shadow-xl border border-gray-100 mb-6">
                    <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-gray-400">Select Level</h3>
                    <div className="space-y-3">{categories.map((cat, idx) => (<button key={idx} onClick={() => setSelectedCat(cat)} className={`w-full p-4 rounded-xl flex justify-between items-center transition-all ${selectedCat.name === cat.name ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 transform scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><div className="text-left"><span className="font-bold text-sm block">{cat.name}</span><span className="text-[10px] font-bold opacity-70">Entry Fee: ₹{cat.fee}</span></div>{selectedCat.name === cat.name && <CheckCircle size={18}/>}</button>))}</div>
                </div>
                <div className="bg-blue-50 p-6 rounded-[30px] border border-blue-100 mb-24">
                    <div className="flex items-center gap-3 mb-6"><Trophy className="text-yellow-500" size={24} fill="currentColor"/><div><span className="block font-black text-lg text-blue-900 uppercase italic">Prize Pool</span><span className="text-[10px] font-bold text-blue-400 uppercase">{selectedCat.name} Only</span></div></div>
                    <div className="space-y-3">{prizes.map((place, index) => (<div key={index} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm"><span className="font-bold text-gray-500 text-xs uppercase flex items-center gap-2"><span className="text-lg">{place.icon}</span> {place.rank}</span><span className="font-black text-lg text-blue-600">₹{place.amount}</span></div>))}</div>
                </div>
            </div>
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-6 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
                <div className="flex justify-between items-end mb-4"><div><p className="text-xs text-gray-400 font-bold uppercase">Entry Fee</p><p className="text-3xl font-black text-gray-900">₹{selectedCat.fee}</p></div><div className="text-right"><p className="text-[10px] text-green-600 font-bold uppercase bg-green-50 px-2 py-1 rounded">Wallet: ₹{JSON.parse(localStorage.getItem("user"))?.wallet_balance || 0}</p></div></div><button onClick={handlePayment} disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex justify-center gap-2">{loading ? "Processing..." : <>Pay & Register <ChevronRight/></>}</button>
            </div>
        </div>
    );
};

const CompetePage = () => {
    const [tournaments, setTournaments] = useState([]);
    const navigate = useNavigate();
    useEffect(() => { fetch('http://127.0.0.1:8000/tournaments').then(res => res.json()).then(data => setTournaments(data)); }, []);
    return (
        <div className="pb-24 bg-gray-50 min-h-screen font-sans"><div className="bg-blue-600 p-6 pt-12 pb-12 text-white rounded-b-[40px] shadow-lg mb-[-20px]"><h1 className="text-3xl font-black italic uppercase">Events</h1><p className="text-blue-100 text-xs font-bold uppercase tracking-widest">Select a League to Join</p></div><div className="p-6 space-y-4">{tournaments.map(t => (<div key={t.id} onClick={() => navigate(`/register/${t.id}`)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-all active:scale-95"><div><span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block">{t.type}</span><h3 className="font-bold text-gray-800 text-lg">{t.name}</h3><p className="text-gray-400 text-xs font-bold">Starts from ₹{t.fee}</p></div><div className="bg-gray-50 p-2 rounded-full text-gray-400"><ChevronRight size={20}/></div></div>))} {tournaments.length === 0 && <div className="text-center text-gray-400 mt-10">No events found.</div>}</div></div>
    );
};

const OngoingEvents = ({ category, myTeamID }) => {
    const [activeTab, setActiveTab] = useState("SCHEDULE");
    const [activeGroup, setActiveGroup] = useState('A'); 
    const [schedule, setSchedule] = useState([]);
    const [standings, setStandings] = useState([]);
    const [scores, setScores] = useState({});
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [scoreInput, setScoreInput] = useState("");

    const fetchData = async () => {
        try {
            const user = JSON.parse(localStorage.getItem("user"));
            const level = user?.active_level || "undefined";
            const [schRes, scoreRes, rankRes] = await Promise.all([ fetch('http://127.0.0.1:8000/generate-test-season'), fetch('http://127.0.0.1:8000/scores'), fetch(`http://127.0.0.1:8000/standings/${category}?level=${level}`) ]);
            const schData = await schRes.json(); const scoreData = await scoreRes.json(); const rankData = await rankRes.json();
            const allMatches = schData.full_schedule?.schedule || [];
            const myMatches = allMatches.filter(m => m.category === category).sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
            setSchedule(myMatches); setStandings(rankData); 
            const scoreMap = {}; scoreData.forEach(s => scoreMap[s.id] = s); setScores(scoreMap);
        } catch(err) { console.log(err); }
    };
    
    useEffect(() => { fetchData(); const interval = setInterval(fetchData, 10000); return () => clearInterval(interval); }, [category]);

    const handleScoreSubmit = async () => { if(!selectedMatch) return; await fetch('http://127.0.0.1:8000/submit-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: selectedMatch.id, category: category, t1_name: selectedMatch.t1, t2_name: selectedMatch.t2, score: scoreInput, submitted_by_team: myTeamID }) }); alert("Score sent!"); setSelectedMatch(null); setScoreInput(""); fetchData(); };
    const handleVerify = async (matchId, action) => { await fetch('http://127.0.0.1:8000/verify-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId, action: action }) }); alert(action); fetchData(); };
    const filteredStandings = standings.filter(t => t.group === activeGroup).sort((a, b) => b.points - a.points);
    const getRankIcon = (index) => { if (index < 2) return <div className="bg-green-100 text-green-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">Q</div>; return <span className="font-bold text-gray-400 text-xs w-5 text-center">{index + 1}</span>; };
    const renderMatchAction = (match) => {
        const scoreEntry = scores[match.id];
        if (!scoreEntry) return <button onClick={() => setSelectedMatch(match)} className="bg-blue-50 text-blue-600 text-[8px] font-bold px-2 py-1 rounded border border-blue-100">+ Score</button>;
        if (scoreEntry.status === "Official") return <span className="text-green-600 text-[9px] font-black">{scoreEntry.score}</span>;
        if (scoreEntry.status === "Disputed") return <span className="text-red-500 text-[9px] font-black">⚠</span>;
        const iSubmittedIt = scoreEntry.submitted_by_team === myTeamID;
        if (iSubmittedIt) return <span className="text-gray-300 text-[8px] font-bold">Wait...</span>;
        return <div className="flex gap-1"><button onClick={() => handleVerify(match.id, "DENY")} className="text-red-500 text-[8px] font-bold border border-red-100 px-1 rounded">X</button><button onClick={() => handleVerify(match.id, "APPROVE")} className="text-green-600 text-[8px] font-bold border border-green-100 px-1 rounded">✓</button></div>;
    };

    return (
        <div className="mt-8 mb-24 px-6">
            <div className="flex items-center gap-2 mb-4"><Activity className="text-green-500 animate-pulse" size={20}/><h2 className="text-lg font-black italic uppercase">Ongoing Event</h2></div>
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white"><div><p className="text-[10px] font-bold opacity-80 uppercase">Tournament</p><h3 className="font-black text-lg italic">{category}</h3></div><div className="text-right"><p className="text-[10px] font-bold opacity-80 uppercase">My Rank</p><p className="font-black text-2xl">#{standings.findIndex(t => t.name === myTeamID) + 1 || "-"}</p></div></div>
                <div className="flex border-b border-gray-100 divide-x divide-gray-100"><div className="flex-1 p-3 text-center"><p className="text-[9px] text-gray-400 font-bold uppercase">Played</p><p className="font-black text-lg">{standings.find(t => t.name === myTeamID)?.played || 0}</p></div><div className="flex-1 p-3 text-center"><p className="text-[9px] text-gray-400 font-bold uppercase">Won</p><p className="font-black text-lg text-green-600">{standings.find(t => t.name === myTeamID)?.won || 0}</p></div><div className="flex-1 p-3 text-center"><p className="text-[9px] text-gray-400 font-bold uppercase">Points</p><p className="font-black text-lg text-blue-600">{standings.find(t => t.name === myTeamID)?.points || 0}</p></div></div>
                <div className="flex border-b border-gray-100"><button onClick={() => setActiveTab("SCHEDULE")} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === "SCHEDULE" ? "bg-gray-50 text-blue-600" : "text-gray-400"}`}>Schedule</button><button onClick={() => setActiveTab("STANDINGS")} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeTab === "STANDINGS" ? "bg-gray-50 text-blue-600" : "text-gray-400"}`}>Leaderboard</button></div>
                <div className="max-h-96 overflow-y-auto">{activeTab === "SCHEDULE" ? ( <CompactScheduleList matches={schedule} myTeamID={myTeamID} onAction={renderMatchAction} /> ) : (<div className="pb-4"><div className="flex justify-center p-3 bg-gray-50 border-b border-gray-100"><div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">{['A', 'B', 'C', 'D'].map((group) => (<button key={group} onClick={() => setActiveGroup(group)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeGroup === group ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>Group {group}</button>))}</div></div><div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase"><div className="col-span-2 text-center">Rank</div><div className="col-span-6">Team</div><div className="col-span-2 text-center">Games</div><div className="col-span-2 text-center">Pts</div></div><div className="divide-y divide-gray-50">{filteredStandings.length > 0 ? (filteredStandings.map((t, i) => (<div key={i} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${i < 2 ? "bg-green-50 border-l-4 border-green-500" : (t.name === myTeamID ? "bg-blue-50" : "hover:bg-gray-50")}`}><div className="col-span-2 flex justify-center">{getRankIcon(i)}</div><div className="col-span-6 font-bold text-gray-700 text-xs truncate">{t.name}</div><div className="col-span-2 text-center text-gray-500 font-bold text-xs">{t.gamesWon}</div><div className="col-span-2 text-center font-black text-blue-600 text-xs">{t.points}</div></div>))) : (<div className="p-6 text-center text-gray-400 text-xs">No teams in Group {activeGroup}</div>)}</div></div>)}</div></div> {selectedMatch && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"><h3 className="text-xl font-black italic uppercase mb-1 text-center">Match Result</h3><p className="text-xs text-gray-500 font-bold mb-6 text-center">{selectedMatch.t1} vs {selectedMatch.t2}</p><input type="text" placeholder="e.g. 6-4, 6-2" className="w-full bg-gray-100 p-4 rounded-xl font-bold text-lg mb-4 text-center outline-none" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)}/><div className="flex gap-3"><button onClick={() => setSelectedMatch(null)} className="flex-1 bg-gray-200 text-gray-600 py-3 rounded-xl font-bold text-xs uppercase">Cancel</button><button onClick={handleScoreSubmit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Submit</button></div></div></div>)}</div>
    );
};

// --- HOME PAGE (UPDATED WITH AUTO-REFRESH) ---
const HomePage = ({ user, onRefresh }) => {
  const navigate = useNavigate();
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [viewingTournament, setViewingTournament] = useState(user?.active_category || "Club 28 League");

  useEffect(() => { 
      fetch('http://127.0.0.1:8000/tournaments').then(res => res.json()).then(data => setAvailableTournaments(data)); 
      
      // AUTO-REFRESH WALLET
      const refreshWallet = async () => {
          if (!user?.team_id) return;
          try {
              const res = await fetch(`http://127.0.0.1:8000/user/${user.team_id}`);
              if (res.ok) {
                  const latestUser = await res.json();
                  if (latestUser.wallet_balance !== user.wallet_balance) {
                      onRefresh(latestUser); 
                  }
              }
          } catch(e) { console.error("Sync failed", e); }
      };
      refreshWallet();
  }, []);

  const handleQuickAction = (action) => { if (action === 'Compete') navigate('/compete'); else alert("Coming Soon!"); };

  return (
    <div className="pb-24 bg-gray-50 min-h-screen font-sans text-gray-900">
      <div className="bg-blue-600 p-6 pt-12 pb-20 rounded-b-[40px] shadow-lg mb-[-40px]">
          <div className="flex justify-between items-center mb-6 text-white"><h1 className="text-xl font-extrabold italic tracking-wide">PLAYTOMIC</h1><div className="flex gap-4"><Search size={20} /><Bell size={20} /></div></div>
          <div className="flex justify-between items-center text-white">
              <div className="flex items-center gap-4"><div className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center font-black text-xl">{user?.name?.charAt(0)}</div><div><h2 className="text-xl font-bold">{user?.name}</h2><p className="text-blue-200 text-xs font-bold">{user?.team_id}</p></div></div>
              <div className="relative"><select value={viewingTournament} onChange={(e) => setViewingTournament(e.target.value)} className="appearance-none bg-blue-700 text-white font-bold text-xs py-2 pl-3 pr-8 rounded-lg outline-none">{availableTournaments.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select><ChevronDown size={14} className="absolute right-2 top-2.5 text-white pointer-events-none" /></div>
          </div>
      </div>
      <div className="mx-6 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 flex justify-between items-center relative z-10 mb-8"><div className="text-center flex-1 border-r border-gray-100"><p className="text-[10px] text-gray-400 font-bold uppercase">Wallet</p><p className="text-xl font-black text-gray-800">₹{user?.wallet_balance || 0}</p></div><div className="text-center flex-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Matches</p><p className="text-xl font-black text-gray-800">0</p></div></div>
      <div className="px-6 grid grid-cols-4 gap-4 text-center mb-4">{['Book Court', 'Learn', 'Compete', 'Find Match'].map((item, i) => (<div key={i} onClick={() => handleQuickAction(item)} className="flex flex-col items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform"><div className={`w-14 h-14 rounded-full shadow-sm border border-gray-100 flex items-center justify-center ${item === 'Compete' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600'}`}>{item === 'Compete' ? <Trophy size={24} /> : <div className="w-6 h-6 bg-blue-100 rounded-full"/>}</div><span className="text-[10px] font-bold text-gray-600">{item}</span></div>))}</div>
      {user?.active_category ? <OngoingEvents category={viewingTournament} myTeamID={user?.team_id} /> : <div className="mx-6 mt-16 p-6 bg-white rounded-3xl border border-dashed border-gray-300 text-center"><Trophy className="mx-auto text-gray-300 mb-2" size={32}/><p className="text-xs font-bold text-gray-400 mb-4">No active tournaments.</p><button onClick={() => navigate('/compete')} className="bg-blue-600 text-white text-xs font-black uppercase px-6 py-3 rounded-xl shadow-lg">Find a League</button></div>}
    </div>
  );
};

const ProfilePage = ({ user, onLogout }) => (<div className="pb-24 bg-white min-h-screen font-sans"><div className="bg-blue-600 text-white p-8 pt-12 rounded-b-[40px] shadow-lg mb-8"><div className="flex items-center gap-4 mb-6"><div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center font-black text-2xl shadow-inner">{user?.name?.charAt(0) || "P"}</div><div><h1 className="text-2xl font-bold">{user?.name || "Player"}</h1><p className="text-xs opacity-80">Team ID: {user?.team_id || "PENDING"}</p></div></div><div className="p-6"><button onClick={onLogout} className="w-full bg-gray-50 text-gray-500 p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-500 transition-all"><LogOut size={16}/> Log Out</button></div></div></div>);

// --- MAIN APP SHELL ---
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
      {!isLoggedIn && !isAdmin ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
             <Routes>
               <Route path="/" element={<HomePage user={user} onRefresh={handleRegistrationUpdate} />} />
               <Route path="/compete" element={<CompetePage />} />
               <Route path="/register/:id" element={<TournamentRegistration onRegister={handleRegistrationUpdate} />} />
               <Route path="/profile" element={<ProfilePage user={user} onLogout={handleLogout} />} />
               <Route path="/admin" element={<Dashboard />} />
             </Routes>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}

export default function App() { return (<Router><AppContent /></Router>); }