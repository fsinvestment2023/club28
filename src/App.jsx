import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Trophy, User, Calendar, ChevronRight, Search, Bell, Home as HomeIcon, CheckCircle, LogOut, Smartphone, Hash, Activity, Medal, ChevronDown, ArrowLeft } from 'lucide-react';
import Dashboard from './Dashboard.jsx'; 

// --- COMPONENTS ---
const BottomNav = () => {
  const location = useLocation();
  // Hide Bottom Nav on Admin and Registration pages
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/register')) return null;
  const isActive = (path) => location.pathname === path;
  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 py-3 px-6 flex justify-between items-center z-50 md:hidden max-w-md mx-auto left-0 right-0">
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

// --- REGISTRATION PAGE (UPDATED WITH DYNAMIC PRIZES & 3 PLACES) ---
const TournamentRegistration = ({ onRegister }) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [selectedCat, setSelectedCat] = useState('Advance'); 
    const [loading, setLoading] = useState(false);
    const [previewSchedule, setPreviewSchedule] = useState([]);

    // --- PRIZE STRUCTURE DEF ---
    const prizeStructure = {
        'Advance': { 
            fee: '2,500', 
            places: [
                { rank: '1st Place', amount: '50,000', icon: '🥇' },
                { rank: '2nd Place', amount: '25,000', icon: '🥈' },
                { rank: '3rd Place', amount: '10,000', icon: '🥉' }
            ] 
        },
        'Intermediate +': { 
            fee: '2,000', 
            places: [
                { rank: '1st Place', amount: '30,000', icon: '🥇' },
                { rank: '2nd Place', amount: '15,000', icon: '🥈' },
                { rank: '3rd Place', amount: '5,000', icon: '🥉' }
            ] 
        },
        'Intermediate': { 
            fee: '1,500', 
            places: [
                { rank: '1st Place', amount: '15,000', icon: '🥇' },
                { rank: '2nd Place', amount: '8,000', icon: '🥈' },
                { rank: '3rd Place', amount: '3,000', icon: '🥉' }
            ] 
        }
    };

    // Default fallback if category not found (e.g. for custom events)
    const defaultStructure = { fee: '1,000', places: [{ rank: 'Winner', amount: 'Prize Pool', icon: '🏆' }] };
    const activeDetails = prizeStructure[selectedCat] || defaultStructure;

    useEffect(() => {
        const loadData = async () => {
            const tRes = await fetch('https://club28-backend.onrender.com/tournaments');
            const tData = await tRes.json();
            const found = tData.find(t => t.id.toString() === id);
            setTournament(found);
            if (found) {
                const sRes = await fetch('https://club28-backend.onrender.com/generate-test-season');
                const sData = await sRes.json();
                setPreviewSchedule((sData.full_schedule?.schedule || []).filter(m => m.category === found.name));
            }
        };
        loadData();
    }, [id]);

    const handlePayment = async () => {
        setLoading(true);
        setTimeout(() => {
            const user = JSON.parse(localStorage.getItem("user"));
            const feeAmount = parseInt(activeDetails.fee.replace(/,/g, ''));
            const updatedUser = { 
                ...user, 
                active_category: tournament.name, 
                active_level: selectedCat, 
                wallet_balance: user.wallet_balance - feeAmount 
            };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            onRegister(updatedUser);
            alert(`Joined ${tournament.name} (${selectedCat})!`);
            navigate('/');
        }, 1500);
    };

    if (!tournament) return <div className="p-10 text-center text-gray-500">Loading Event Details...</div>;

    return (
        <div className="bg-white min-h-screen font-sans pb-32">
            <div className="bg-blue-600 p-6 pt-12 pb-12 text-white rounded-b-[40px] shadow-lg">
                <button onClick={() => navigate('/compete')} className="mb-6 bg-white/20 p-2 rounded-full"><ArrowLeft size={24}/></button>
                <h1 className="text-3xl font-black italic uppercase mb-2">{tournament.name}</h1>
                <p className="text-blue-100 font-bold text-xs uppercase tracking-widest">Registration Open</p>
            </div>

            <div className="p-6 -mt-8">
                {/* Category Selector */}
                <div className="bg-white p-6 rounded-[30px] shadow-xl border border-gray-100 mb-6">
                    <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-gray-400">Select Level</h3>
                    <div className="space-y-3">
                        {Object.keys(prizeStructure).map(cat => (
                            <button key={cat} onClick={() => setSelectedCat(cat)} className={`w-full p-4 rounded-xl flex justify-between items-center transition-all ${selectedCat === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 transform scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                <span className="font-bold text-sm">{cat}</span>
                                {selectedCat === cat && <CheckCircle size={18}/>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Schedule Preview */}
                <div className="bg-white p-6 rounded-[30px] shadow-xl border border-gray-100 mb-6">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 flex items-center gap-2"><Calendar size={16}/> Schedule Preview</h3><span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">{previewSchedule.length} Matches</span></div>
                    <div className="h-64 overflow-y-auto border rounded-xl border-gray-50"><CompactScheduleList matches={previewSchedule} myTeamID={null} onAction={null} /></div>
                </div>

                {/* Prize Pool Display */}
                <div className="bg-blue-50 p-6 rounded-[30px] border border-blue-100 mb-24">
                    <div className="flex items-center gap-3 mb-6">
                        <Trophy className="text-yellow-500" size={24} fill="currentColor"/>
                        <div><span className="block font-black text-lg text-blue-900 uppercase italic">Prize Pool</span><span className="text-[10px] font-bold text-blue-400 uppercase">{selectedCat}</span></div>
                    </div>
                    <div className="space-y-3">
                        {activeDetails.places.map((place, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                                <span className="font-bold text-gray-500 text-xs uppercase flex items-center gap-2"><span className="text-lg">{place.icon}</span> {place.rank}</span>
                                <span className="font-black text-lg text-blue-600">₹{place.amount}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky Payment Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-6 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
                <div className="flex justify-between items-end mb-4">
                    <div><p className="text-xs text-gray-400 font-bold uppercase">Entry Fee ({selectedCat})</p><p className="text-3xl font-black text-gray-900">₹{activeDetails.fee}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 font-bold uppercase bg-green-50 px-2 py-1 rounded">Wallet: ₹10,000</p></div>
                </div>
                <button onClick={handlePayment} disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex justify-center gap-2">{loading ? "Processing..." : <>Pay & Register <ChevronRight/></>}</button>
            </div>
        </div>
    );
};

// --- COMPETE PAGE (LIST VIEW) ---
const CompetePage = () => {
    const [tournaments, setTournaments] = useState([]);
    const navigate = useNavigate();
    useEffect(() => { fetch('https://club28-backend.onrender.com/tournaments').then(res => res.json()).then(data => setTournaments(data)); }, []);
    return (
        <div className="pb-24 bg-gray-50 min-h-screen font-sans">
            <div className="bg-blue-600 p-6 pt-12 pb-12 text-white rounded-b-[40px] shadow-lg mb-[-20px]"><h1 className="text-3xl font-black italic uppercase">Events</h1><p className="text-blue-100 text-xs font-bold uppercase tracking-widest">Select a League to Join</p></div>
            <div className="p-6 space-y-4">
                {tournaments.map(t => (
                    <div key={t.id} onClick={() => navigate(`/register/${t.id}`)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-all active:scale-95">
                        <div><span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block">{t.type}</span><h3 className="font-bold text-gray-800 text-lg">{t.name}</h3><p className="text-gray-400 text-xs font-bold">Prize Pool: ₹{t.prize}</p></div>
                        <div className="bg-gray-50 p-2 rounded-full text-gray-400"><ChevronRight size={20}/></div>
                    </div>
                ))}
                {tournaments.length === 0 && <div className="text-center text-gray-400 mt-10">No events found.</div>}
            </div>
        </div>
    );
};

// --- ONGOING EVENT WIDGET ---
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
            const [schRes, scoreRes, rankRes] = await Promise.all([
                fetch('https://club28-backend.onrender.com/generate-test-season'),
                fetch('https://club28-backend.onrender.com/scores'),
                fetch(`https://club28-backend.onrender.com/standings/${category}`)
            ]);
            const schData = await schRes.json();
            const scoreData = await scoreRes.json();
            const rankData = await rankRes.json();
            const allMatches = schData.full_schedule?.schedule || [];
            const myMatches = allMatches.filter(m => m.category === category).sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
            setSchedule(myMatches);
            setStandings(rankData); 
            const scoreMap = {}; scoreData.forEach(s => scoreMap[s.id] = s); setScores(scoreMap);
        } catch(err) { console.log(err); }
    };
    useEffect(() => { fetchData(); const interval = setInterval(fetchData, 10000); return () => clearInterval(interval); }, [category]);

    const handleScoreSubmit = async () => { if(!selectedMatch) return; await fetch('https://club28-backend.onrender.com/submit-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: selectedMatch.id, category: category, t1_name: selectedMatch.t1, t2_name: selectedMatch.t2, score: scoreInput, submitted_by_team: myTeamID }) }); alert("Score sent!"); setSelectedMatch(null); setScoreInput(""); fetchData(); };
    const handleVerify = async (matchId, action) => { await fetch('https://club28-backend.onrender.com/verify-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId, action: action }) }); alert(action); fetchData(); };
    
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
                <div className="max-h-96 overflow-y-auto">
                    {activeTab === "SCHEDULE" ? ( <CompactScheduleList matches={schedule} myTeamID={myTeamID} onAction={renderMatchAction} /> ) : (
                        <div className="pb-4">
                            <div className="flex justify-center p-3 bg-gray-50 border-b border-gray-100"><div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">{['A', 'B', 'C', 'D'].map((group) => (<button key={group} onClick={() => setActiveGroup(group)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeGroup === group ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>Group {group}</button>))}</div></div>
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase"><div className="col-span-2 text-center">Rank</div><div className="col-span-6">Team</div><div className="col-span-2 text-center">Games</div><div className="col-span-2 text-center">Pts</div></div>
                            <div className="divide-y divide-gray-50">{filteredStandings.length > 0 ? (filteredStandings.map((t, i) => (<div key={i} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${i < 2 ? "bg-green-50 border-l-4 border-green-500" : (t.name === myTeamID ? "bg-blue-50" : "hover:bg-gray-50")}`}><div className="col-span-2 flex justify-center">{getRankIcon(i)}</div><div className="col-span-6 font-bold text-gray-700 text-xs truncate">{t.name}</div><div className="col-span-2 text-center text-gray-500 font-bold text-xs">{t.gamesWon}</div><div className="col-span-2 text-center font-black text-blue-600 text-xs">{t.points}</div></div>))) : (<div className="p-6 text-center text-gray-400 text-xs">No teams in Group {activeGroup}</div>)}</div>
                            <div className="px-4 py-2 flex items-center gap-2 justify-end"><div className="w-2 h-2 bg-green-500 rounded-full"></div><span className="text-[9px] font-bold text-gray-400 uppercase">Qualifies for QF</span></div>
                        </div>
                    )}
                </div>
            </div>
            {selectedMatch && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"><h3 className="text-xl font-black italic uppercase mb-1 text-center">Match Result</h3><p className="text-xs text-gray-500 font-bold mb-6 text-center">{selectedMatch.t1} vs {selectedMatch.t2}</p><input type="text" placeholder="e.g. 6-4, 6-2" className="w-full bg-gray-100 p-4 rounded-xl font-bold text-lg mb-4 text-center outline-none" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)}/><div className="flex gap-3"><button onClick={() => setSelectedMatch(null)} className="flex-1 bg-gray-200 text-gray-600 py-3 rounded-xl font-bold text-xs uppercase">Cancel</button><button onClick={handleScoreSubmit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Submit</button></div></div></div>)}
        </div>
    );
};

const HomePage = ({ user }) => {
  const navigate = useNavigate();
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [viewingTournament, setViewingTournament] = useState(user?.active_category || "Club 28 League");

  useEffect(() => { fetch('https://club28-backend.onrender.com/tournaments').then(res => res.json()).then(data => setAvailableTournaments(data)); }, []);
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

const LoginPage = ({ onLogin }) => {
  const [phone, setPhone] = useState("");
  const handleLogin = async () => { try { const response = await fetch('https://club28-backend.onrender.com/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone, name: "Player" }) }); const data = await response.json(); onLogin(data.user); } catch (e) { alert("Backend Error"); } };
  return <div className="min-h-screen bg-blue-600 p-8 text-white"><h1 className="text-5xl font-black mt-20">PLAYTOMIC</h1><input className="w-full bg-white/20 p-4 rounded-xl mt-8 text-white placeholder:text-blue-200 font-bold outline-none" placeholder="Phone" onChange={e => setPhone(e.target.value)}/><button onClick={handleLogin} className="w-full bg-white text-blue-600 p-4 rounded-xl font-black mt-4 uppercase">Login</button></div>;
};

const ProfilePage = ({ user, onLogout }) => (<div className="pb-24 bg-white min-h-screen font-sans"><div className="bg-blue-600 text-white p-8 pt-12 rounded-b-[40px] shadow-lg mb-8"><div className="flex items-center gap-4 mb-6"><div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center font-black text-2xl shadow-inner">{user?.name?.charAt(0) || "P"}</div><div><h1 className="text-2xl font-bold">{user?.name || "Player"}</h1><p className="text-xs opacity-80">Team ID: {user?.team_id || "PENDING"}</p></div></div><div className="p-6"><button onClick={onLogout} className="w-full bg-gray-50 text-gray-500 p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-500 transition-all"><LogOut size={16}/> Log Out</button></div></div></div>);

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
               <Route path="/" element={<HomePage user={user} />} />
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