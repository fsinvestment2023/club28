import React, { useState, useEffect } from 'react';
import { RefreshCw, Calendar, Save, Plus, Edit2, X, Trash2, Users, Wallet, UserPlus, MapPin, Activity, Trophy, List, Filter, FileText, Info, Edit, Settings, CheckCircle, Bell, Send } from 'lucide-react';

const Dashboard = () => {
  // --- STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("TOURNAMENTS"); 
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [activeLevelTab, setActiveLevelTab] = useState(null); 
  const [viewMode, setViewMode] = useState("MATCHES");
  const [leaderboardGroup, setLeaderboardGroup] = useState("ALL");

  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tournamentPlayers, setTournamentPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]); 
  const [transactions, setTransactions] = useState([]); 
  
  const [playerHistory, setPlayerHistory] = useState([]);
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [walletTeamId, setWalletTeamId] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Event Form State
  const [editingId, setEditingId] = useState(null); 
  const [eventName, setEventName] = useState("");
  const [eventCity, setEventCity] = useState("MUMBAI"); 
  const [eventSport, setEventSport] = useState("Padel"); 
  const [eventFormat, setEventFormat] = useState("Singles");
  const [eventType, setEventType] = useState("League");
  const [eventStatus, setEventStatus] = useState("Open");
  const [categories, setCategories] = useState([{ name: "Advance", fee: 2500, p1: 30000, p2: 15000, p3: 5000, per_match: 500 }]);
  const [drawSize, setDrawSize] = useState(16);
  const [eventVenue, setEventVenue] = useState("");
  const [eventAbout, setEventAbout] = useState(""); 
  const [eventSchedule, setEventSchedule] = useState([{ label: "", value: "" }]);

  // Match/Player Form State
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  const [newMatchT1, setNewMatchT1] = useState("");
  const [newMatchT2, setNewMatchT2] = useState("");
  const [newMatchDate, setNewMatchDate] = useState("");
  const [newMatchTime, setNewMatchTime] = useState("");
  const [newMatchStage, setNewMatchStage] = useState("Group Stage"); 

  const [ourAimContent, setOurAimContent] = useState("");

  // Notification State
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [newFact, setNewFact] = useState("");
  const [factsList, setFactsList] = useState([
    "🎾 Did you know? Padel was invented in Mexico in 1969!",
    "🚀 Pickleball is the fastest growing sport in the USA!",
    "🎾 The longest tennis match lasted 11 hours and 5 minutes.",
    "🌍 Padel is played by over 25 million people across 90 countries.",
    "🏆 Wimbledon uses 54,250 tennis balls during the tournament."
  ]);
  const [reminderHours, setReminderHours] = useState([24, 2]);

  const API_URL = "http://127.0.0.1:8000"; 

  // --- HANDLERS ---
  const handleLogin = () => { if (password === "admin123") { setIsAuthenticated(true); fetchTournaments(); } else { alert("Wrong Password"); } };
  
  const fetchTournaments = async () => { 
      try { 
          const res = await fetch(`${API_URL}/tournaments`); 
          const data = await res.json();
          if(Array.isArray(data)) setTournaments(data);
          else setTournaments([]);
      } catch (e) { setTournaments([]); } 
  };
  
  const fetchMatches = async () => { 
      try { 
          const res = await fetch(`${API_URL}/scores`); 
          const data = await res.json(); 
          if(Array.isArray(data)){
              const filtered = selectedTournament ? data.filter(m => m.category === selectedTournament.name && m.city === selectedTournament.city) : data; 
              setMatches(filtered.sort((a,b) => a.id - b.id)); 
          } else { setMatches([]); }
      } catch(e) { setMatches([]); } 
  };
  
  const fetchPlayers = async () => { try { const res = await fetch(`${API_URL}/admin/players`); const data = await res.json(); setPlayers(Array.isArray(data) ? data : []); } catch(e){ setPlayers([]); } };
  
  const fetchTransactions = async () => { try { const res = await fetch(`${API_URL}/admin/transactions`); const data = await res.json(); setTransactions(Array.isArray(data) ? data : []); } catch(e){ setTransactions([]); } };
  
  const fetchTournamentPlayers = async () => { 
      if(!selectedTournament) return; 
      try { 
          const res = await fetch(`${API_URL}/admin/tournament-players?name=${selectedTournament.name}&city=${selectedTournament.city}`); 
          const data = await res.json();
          setTournamentPlayers(Array.isArray(data) ? data : []); 
      } catch(e){ setTournamentPlayers([]); } 
  };

  const fetchLeaderboard = async () => {
      let levelToFetch = activeLevelTab;
      if (!levelToFetch && selectedTournament) {
          try {
              const cats = JSON.parse(selectedTournament.settings || "[]");
              if (cats.length > 0) { levelToFetch = cats[0].name; setActiveLevelTab(levelToFetch); }
          } catch(e) {}
      }
      if(!selectedTournament || !levelToFetch) return;
      try {
          const res = await fetch(`${API_URL}/admin/leaderboard?tournament=${selectedTournament.name}&city=${selectedTournament.city}&level=${levelToFetch}`);
          const data = await res.json();
          setLeaderboard(Array.isArray(data) ? data : []);
      } catch(e) { setLeaderboard([]); }
  };

  const fetchAppContent = async () => {
      try {
          const res = await fetch(`${API_URL}/club-info/OUR_AIM`);
          const data = await res.json();
          setOurAimContent(data.content);
      } catch(e) {}
  };

  const handleUpdateContent = async () => {
      await fetch(`${API_URL}/admin/update-club-info`, { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ section: "OUR_AIM", content: ourAimContent }) 
      });
      alert("Content Updated!");
  };

  const handleSendTestNotification = async () => {
      if(!notifTitle || !notifBody) return alert("Enter Title and Body");
      await fetch(`${API_URL}/admin/create-notification`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ type: "COMMUNITY", title: notifTitle, message: notifBody })
      });
      alert("Notification Sent to All Users!");
      setNotifTitle("");
      setNotifBody("");
  };

  const handleAddFact = () => {
      if(!newFact) return;
      setFactsList([...factsList, newFact]);
      setNewFact("");
  };

  const handleDeleteFact = (index) => {
      const newFacts = [...factsList];
      newFacts.splice(index, 1);
      setFactsList(newFacts);
  };

  const handleConfirmPayment = async (txnId) => {
      if(!window.confirm("Mark this payment as COMPLETED manually?")) return;
      try {
          const res = await fetch(`${API_URL}/admin/confirm-withdrawal`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ transaction_id: txnId })
          });
          if(res.ok) { alert("Marked as Paid!"); fetchTransactions(); }
          else alert("Error updating status");
      } catch(e) { console.error(e); }
  };

  const handleViewHistory = async (player) => {
      setViewingPlayer(player);
      setIsHistoryOpen(true);
      setPlayerHistory([]); 
      try {
          const res = await fetch(`${API_URL}/user/${player.team_id}/transactions`);
          if (res.ok) {
              const data = await res.json();
              setPlayerHistory(Array.isArray(data) ? data : []);
          }
      } catch(e) { console.error(e); }
  };

  const isCashIn = (t) => ["WALLET_TOPUP", "DIRECT_PAYMENT"].includes(t.mode);
  const isCashOut = (t) => ["WITHDRAWAL", "PRIZE"].includes(t.mode);

  const getAmountColor = (t) => {
      if (t.type === "CREDIT") return "text-green-600"; 
      if (t.mode === "WITHDRAWAL") return "text-red-500"; 
      return "text-pink-500"; 
  };

  useEffect(() => { 
      if(isAuthenticated) { 
          if (activeTab === "PLAYERS") fetchPlayers(); 
          else if (activeTab === "ACCOUNTS") fetchTransactions();
          else if (activeTab === "CONTENT") { fetchAppContent(); }
          else if (activeTab === "MANAGE" && selectedTournament) { fetchMatches(); fetchTournamentPlayers(); fetchLeaderboard(); } else { fetchMatches(); } 
      } 
  }, [selectedTournament, isAuthenticated, activeTab, viewMode, activeLevelTab]); 

  // Fetch settings on login
  useEffect(() => {
    if (isAuthenticated) {
        fetch(`${API_URL}/admin/get-settings/reminder_hours`)
            .then(res => res.json())
            .then(data => { if(data.value && data.value.length > 0) setReminderHours(data.value); });
    }
  }, [isAuthenticated]);

  useEffect(() => { if (selectedTournament && !activeLevelTab) { try { const cats = JSON.parse(selectedTournament.settings || "[]"); if (cats.length > 0) setActiveLevelTab(cats[0].name); } catch(e) {} } }, [selectedTournament]);

  const filteredPlayers = Array.isArray(tournamentPlayers) ? tournamentPlayers.filter(p => p.active_level === activeLevelTab) : [];
  const filteredLeaderboard = Array.isArray(leaderboard) ? leaderboard.filter(p => leaderboardGroup === "ALL" || p.group === leaderboardGroup) : [];
  
  const handleAddMoney = async () => { if (!walletTeamId || !walletAmount) return alert("Fill fields"); const res = await fetch(`${API_URL}/admin/add-wallet`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ team_id: walletTeamId, amount: parseInt(walletAmount) }) }); if (res.ok) { alert("Money Added!"); setWalletTeamId(""); setWalletAmount(""); fetchPlayers(); } else { alert("Player Not Found"); } };
  const handleDeleteTournament = async (id) => { if(!window.confirm("Delete this event?")) return; await fetch(`${API_URL}/admin/delete-tournament`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id }) }); fetchTournaments(); if(selectedTournament?.id === id) setSelectedTournament(null); };
  
  const openCreateModal = () => { setEditingId(null); setEventName(""); setEventCity("MUMBAI"); setEventSport("Padel"); setEventFormat("Singles"); setEventType("League"); setEventStatus("Open"); setDrawSize(16); setEventVenue(""); setEventAbout(""); setEventSchedule([{ label: "", value: "" }]); setCategories([{ name: "", fee: 0, p1: 0, p2: 0, p3: 0, per_match: 0 }]); setIsModalOpen(true); };
  const openEditModal = (t) => { setEditingId(t.id); setEventName(t.name); setEventCity(t.city || "MUMBAI"); setEventSport(t.sport || "Padel"); setEventFormat(t.format || "Singles"); setEventType(t.type); setEventStatus(t.status); setDrawSize(t.draw_size || 16); setEventVenue(t.venue || ""); setEventAbout(t.about || ""); try { setEventSchedule(JSON.parse(t.schedule || "[]")); } catch { setEventSchedule([{ label: "", value: "" }]); } try { setCategories(JSON.parse(t.settings || "[]")); } catch { setCategories([{ name: "Default", fee: t.fee, p1: 0, p2: 0, p3: 0, per_match: 0 }]); } setIsModalOpen(true); };
  
  const handleModalSubmit = async () => { 
      if(!eventName) return alert("Enter Name"); 
      const endpoint = editingId ? '/admin/edit-tournament' : '/admin/create-tournament'; 
      const body = { id: editingId, name: eventName, city: eventCity, sport: eventSport, format: eventFormat, type: eventType, status: eventStatus, settings: categories, venue: eventVenue, about: eventAbout, schedule: eventSchedule, draw_size: parseInt(drawSize) }; 
      await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) }); setIsModalOpen(false); fetchTournaments(); 
  };
  
  const updateCategory = (idx, f, v) => { const n = [...categories]; n[idx][f] = v; setCategories(n); };
  const addCategoryRow = () => setCategories([...categories, { name: "", fee: 0, p1: 0, p2: 0, p3: 0, per_match: 0 }]);
  const removeCategory = (idx) => setCategories(categories.filter((_, i) => i !== idx));
  const updateSchedule = (idx, f, v) => { const n = [...eventSchedule]; n[idx][f] = v; setEventSchedule(n); };
  const addScheduleRow = () => setEventSchedule([...eventSchedule, { label: "", value: "" }]);
  const removeScheduleRow = (idx) => setEventSchedule(eventSchedule.filter((_, i) => i !== idx));

  const handleManualRegister = async () => {
    if (!manualName || !manualPhone) return alert("Fill name and phone");
    try {
        const res = await fetch(`${API_URL}/admin/manual-register`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name: manualName, phone: manualPhone, category: selectedTournament.name, city: selectedTournament.city, level: activeLevelTab }) });
        const data = await res.json();
        if (res.ok) { alert(`✅ Added to Group ${data.group}`); setManualName(""); setManualPhone(""); fetchTournamentPlayers(); fetchLeaderboard(); } else { alert("Error: " + data.detail); }
    } catch(e) { console.error(e); }
  };

  const handleCreateMatch = async () => { 
      if (!selectedTournament || !newMatchT1 || !newMatchT2) return alert("Select teams!"); 
      const t1Obj = filteredPlayers.find(p => p.name === newMatchT1);
      const group = t1Obj ? t1Obj.group_id : 'A';
      await fetch(`${API_URL}/admin/create-match`, { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ category: selectedTournament.name, city: selectedTournament.city, group_id: group, t1: newMatchT1, t2: newMatchT2, date: newMatchDate, time: newMatchTime, stage: newMatchStage }) 
        }); 
      fetchMatches(); setNewMatchT1(""); setNewMatchT2("");
  };
  
  const handleMatchUpdate = async (match) => { 
      const t1Input = document.getElementById(`t1-${match.id}`);
      const t2Input = document.getElementById(`t2-${match.id}`);
      const dateInput = document.getElementById(`date-${match.id}`);
      const timeInput = document.getElementById(`time-${match.id}`);
      const scoreInput = document.getElementById(`score-${match.id}`);

      const t1 = t1Input ? t1Input.value : match.t1;
      const t2 = t2Input ? t2Input.value : match.t2;
      const date = dateInput ? dateInput.value : match.date;
      const time = timeInput ? timeInput.value : match.time;
      const score = scoreInput ? scoreInput.value : match.score;

      await fetch(`${API_URL}/admin/edit-match-full`, { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ id: match.id, t1, t2, date, time, score }) 
      }); 
      alert("Match Updated"); fetchMatches(); fetchLeaderboard(); 
  };

  const handleDeleteMatch = async (id) => { if(!window.confirm("Delete this match?")) return; await fetch(`${API_URL}/admin/delete-match`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id }) }); fetchMatches(); };

  const getWinner = (m) => {
    if (!m.score) return "-";
    try {
        let t1_sets = 0;
        let t2_sets = 0;
        const sets = m.score.split(',');
        sets.forEach(s => {
            const p = s.trim().split('-');
            if (p.length === 2) {
                if (parseInt(p[0]) > parseInt(p[1])) t1_sets++;
                else if (parseInt(p[1]) > parseInt(p[0])) t2_sets++;
            }
        });
        if (t1_sets > t2_sets) return m.t1;
        if (t2_sets > t1_sets) return m.t2;
        return "Draw";
    } catch { return "Error"; }
  };

  if (!isAuthenticated) return ( <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-sm text-center"><h1 className="text-2xl font-black mb-4">ADMIN ACCESS</h1><input type="password" placeholder="Pass" className="w-full bg-gray-100 p-4 rounded-xl mb-4 font-bold text-center" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={handleLogin} className="w-full bg-black text-white p-4 rounded-xl font-bold">UNLOCK</button></div></div> );

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col md:flex-row relative">
      
      {/* --- HISTORY MODAL --- */}
      {isHistoryOpen && viewingPlayer && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                      <div><h3 className="font-bold text-lg">{viewingPlayer.name}</h3><p className="text-xs opacity-80">{viewingPlayer.team_id} • Transaction History</p></div>
                      <button onClick={() => setIsHistoryOpen(false)}><X size={20}/></button>
                  </div>
                  <div className="p-4 overflow-y-auto">
                      {Array.isArray(playerHistory) && playerHistory.length > 0 ? (
                          <div className="space-y-2">
                              {playerHistory.map(t => (
                                  <div key={t.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                      <div><p className="font-bold text-gray-800 text-xs">{t.description}</p><p className="text-[10px] text-gray-400 uppercase">{new Date(t.date).toLocaleDateString()}</p></div>
                                      <div className="text-right"><p className={`font-black text-sm ${getAmountColor(t)}`}>{t.type === "CREDIT" ? "+" : "-"}₹{t.amount}</p><span className="text-[9px] text-gray-400 bg-white border border-gray-200 px-1 rounded">{t.mode}</span></div>
                                  </div>
                              ))}
                          </div>
                      ) : (<div className="p-8 text-center text-gray-400 text-sm">No transactions found.</div>)}
                  </div>
              </div>
          </div>
      )}

      {/* --- EVENT MODAL --- */}
      {isModalOpen && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden"><div className="bg-black p-4 flex justify-between items-center text-white"><h3 className="font-bold">{editingId ? "Edit Event" : "Create New Event"}</h3><button onClick={() => setIsModalOpen(false)}><X size={20}/></button></div><div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="grid grid-cols-3 gap-4"><div><label className="text-xs font-bold text-gray-400 uppercase">Event Name</label><input value={eventName} onChange={e => setEventName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"/></div><div><label className="text-xs font-bold text-gray-400 uppercase">City</label><input value={eventCity} onChange={e => setEventCity(e.target.value.toUpperCase())} placeholder="e.g. MUMBAI" className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"/></div><div><label className="text-xs font-bold text-gray-400 uppercase">Sport</label><select value={eventSport} onChange={e => setEventSport(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"><option value="Padel">Padel</option><option value="Pickleball">Pickleball</option><option value="Tennis">Tennis</option><option value="Badminton">Badminton</option><option value="Box Cricket">Box Cricket</option><option value="Football">Football</option></select></div></div>
      <div className="grid grid-cols-3 gap-4"><div><label className="text-xs font-bold text-gray-400 uppercase">Status</label><select value={eventStatus} onChange={e => setEventStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"><option value="Open">Open</option><option value="Ongoing">Ongoing</option><option value="Finished">Finished</option></select></div><div><label className="text-xs font-bold text-gray-400 uppercase">Format</label><select value={eventFormat} onChange={e => setEventFormat(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"><option value="Singles">Singles</option><option value="Doubles">Doubles</option></select></div><div><label className="text-xs font-bold text-gray-400 uppercase">Draw Size</label><select value={drawSize} onChange={e => setDrawSize(parseInt(e.target.value))} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"><option value="8">8 Players (2 Grps)</option><option value={12}>12 Players (3 Grps)</option><option value={16}>16 Players (4 Grps)</option></select></div></div>
      <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-2"><Calendar size={14}/> Schedule Preview (Row & Column Style)</label><div className="space-y-2">{eventSchedule.map((row, idx) => (<div key={idx} className="flex gap-2 items-center"><input placeholder="Row Label" value={row.label} onChange={e => updateSchedule(idx, 'label', e.target.value)} className="w-1/3 p-2 bg-gray-50 rounded border text-xs font-bold"/><input placeholder="Value" value={row.value} onChange={e => updateSchedule(idx, 'value', e.target.value)} className="flex-1 p-2 bg-gray-50 rounded border text-xs font-bold"/><button onClick={() => removeScheduleRow(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button></div>))}</div><button onClick={addScheduleRow} className="mt-2 text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded flex items-center gap-1">+ Add Schedule Row</button></div>
      <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-2"><Info size={14}/> About Event</label><textarea value={eventAbout} onChange={e => setEventAbout(e.target.value)} placeholder="Description of the event..." className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200 text-sm h-20 resize-none"/></div>
      <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-2"><MapPin size={14}/> Venue Information</label><textarea value={eventVenue} onChange={e => setEventVenue(e.target.value)} placeholder="Enter full address, landmarks, or google maps link..." className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200 text-sm h-20 resize-none"/></div><div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Categories, Fees & Prizes</label><div className="space-y-2">{categories.map((cat, idx) => (<div key={idx} className="flex gap-2 items-center"><input placeholder="Name" value={cat.name} onChange={e => updateCategory(idx, 'name', e.target.value)} className="w-32 p-2 bg-gray-50 rounded border text-xs font-bold"/><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">Fee</span><input type="number" value={cat.fee} onChange={e => updateCategory(idx, 'fee', e.target.value)} className="w-16 p-2 bg-gray-50 rounded border text-xs font-bold"/></div><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">1st</span><input type="number" value={cat.p1} onChange={e => updateCategory(idx, 'p1', e.target.value)} className="w-20 p-2 bg-green-50 rounded border border-green-200 text-xs font-bold text-green-700"/></div><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">2nd</span><input type="number" value={cat.p2} onChange={e => updateCategory(idx, 'p2', e.target.value)} className="w-20 p-2 bg-gray-50 rounded border text-xs font-bold"/></div><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">3rd</span><input type="number" value={cat.p3} onChange={e => updateCategory(idx, 'p3', e.target.value)} className="w-20 p-2 bg-gray-50 rounded border text-xs font-bold"/></div><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">Per Match</span><input type="number" value={cat.per_match} onChange={e => updateCategory(idx, 'per_match', e.target.value)} className="w-20 p-2 bg-blue-50 rounded border border-blue-200 text-xs font-bold text-blue-700"/></div><button onClick={() => removeCategory(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded mt-3"><Trash2 size={16}/></button></div>))}</div><button onClick={addCategoryRow} className="mt-2 text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded flex items-center gap-1"><Plus size={14}/> Add Category</button></div><button onClick={handleModalSubmit} className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800">{editingId ? "Save Changes" : "Create Event"}</button></div></div></div>)}

      {/* --- SIDEBAR --- */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0">
        <h1 className="font-black text-xl text-blue-900 italic mb-6 px-2">CLUB 28 ADMIN</h1>
        <div className="space-y-1">
            <button onClick={() => {setActiveTab("TOURNAMENTS"); setSelectedTournament(null);}} className={`w-full text-left px-4 py-3 rounded-xl font-bold ${activeTab === "TOURNAMENTS" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Events</button>
            <button onClick={() => {setActiveTab("PLAYERS"); setSelectedTournament(null);}} className={`w-full text-left px-4 py-3 rounded-xl font-bold ${activeTab === "PLAYERS" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Players & Wallet</button>
            <button onClick={() => {setActiveTab("ACCOUNTS"); setSelectedTournament(null);}} className={`w-full text-left px-4 py-3 rounded-xl font-bold ${activeTab === "ACCOUNTS" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Accounts</button>
            <button onClick={() => {setActiveTab("CONTENT"); setSelectedTournament(null);}} className={`w-full text-left px-4 py-3 rounded-xl font-bold ${activeTab === "CONTENT" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Content (CMS)</button>
            <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase mt-4">Active Events</div>
            {Array.isArray(tournaments) && tournaments.map(t => ( <button key={t.id} onClick={() => {setSelectedTournament(t); setActiveTab("MANAGE");}} className={`w-full text-left px-4 py-2 rounded-lg font-medium text-sm ${selectedTournament?.id === t.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{t.name}</button> ))}
            <button onClick={openCreateModal} className="w-full mt-4 border border-dashed border-gray-300 p-2 rounded-lg text-xs font-bold text-gray-400 hover:text-blue-600 hover:border-blue-600">+ Create New Event</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 h-screen">
        {activeTab === "TOURNAMENTS" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(tournaments) && tournaments.map(t => (
                    <div key={t.id} onClick={() => {setSelectedTournament(t); setActiveTab("MANAGE");}} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4"><span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded uppercase">{t.type}</span><span className="bg-purple-100 text-purple-600 text-[10px] font-black px-2 py-1 rounded uppercase">{t.format || "Singles"}</span></div>
                            <h3 className="font-bold text-xl text-gray-800 mb-1">{t.name}</h3>
                            <div className="flex items-center gap-3 text-xs font-bold text-gray-400 mb-4"><span className="flex items-center gap-1"><MapPin size={12}/> {t.city || "MUMBAI"}</span><span className="flex items-center gap-1"><Activity size={12}/> {t.sport || "Padel"}</span></div>
                            <div className="flex gap-4 text-sm text-gray-500 mt-4 border-t border-gray-50 pt-4 mb-4"><div><span className="block text-[10px] font-bold uppercase text-gray-300">Fee Starts</span>₹{t.fee}</div><div><span className="block text-[10px] font-bold uppercase text-gray-300">Draw Size</span>{t.draw_size || 16}</div></div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3"><button onClick={(e) => { e.stopPropagation(); openEditModal(t); }} className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-blue-100 hover:text-blue-600"><Edit2 size={16}/></button><button onClick={(e) => { e.stopPropagation(); handleDeleteTournament(t.id); }} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 hover:text-red-700"><Trash2 size={16}/></button></div>
                    </div>
                ))}
            </div>
        )}
        
        {activeTab === "ACCOUNTS" && (
            <div>
                <h2 className="text-3xl font-black text-gray-800 mb-6">Accounts & Transactions</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-400 border-b border-gray-100 text-xs uppercase font-bold">
                    <tr><th className="p-4">Date</th><th className="p-4">Player</th><th className="p-4">Description</th><th className="p-4">Bank Details</th><th className="p-4 text-right">Income</th><th className="p-4 text-right">Expense</th><th className="p-4 text-center">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.isArray(transactions) && transactions.map(t => {
                        if (t.mode === "EVENT_FEE") return null;
                        const showInCredit = isCashIn(t);
                        const showInDebit = isCashOut(t);
                        return (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="p-4 text-xs font-bold text-gray-500">{new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                            <td className="p-4 font-bold text-gray-800">{t.user_name} <span className="text-gray-400 text-[10px]">({t.team_id})</span><br/><span className="text-[10px] text-gray-400">{t.user_phone}</span></td>
                            <td className="p-4 text-xs font-bold text-gray-600">{t.description} <span className="bg-gray-100 px-2 py-0.5 rounded text-[9px] uppercase ml-1">{t.mode}</span></td>
                            
                            {/* BANK DETAILS COLUMN */}
                            <td className="p-4">
                                {t.mode === "WITHDRAWAL" && t.bank_details ? (
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => alert(`BANK DETAILS:\n\n${t.bank_details}`)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200">View Info</button>
                                        {/* ADMIN CONFIRMATION BUTTON */}
                                        {t.status === "PENDING" && (
                                            <button onClick={() => handleConfirmPayment(t.id)} className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm">Confirm Payment</button>
                                        )}
                                    </div>
                                ) : (<span className="text-gray-300 text-xs">-</span>)}
                            </td>

                            <td className={`p-4 text-right font-black ${showInCredit ? "text-green-600" : "text-gray-200"}`}>{showInCredit ? `+₹${t.amount}` : "-"}</td>
                            <td className={`p-4 text-right font-black ${showInDebit ? (t.mode === "WITHDRAWAL" ? "text-red-500" : "text-pink-500") : "text-gray-200"}`}>{showInDebit ? `-₹${t.amount}` : "-"}</td>
                            
                            {/* STATUS COLUMN */}
                            <td className="p-4 text-center">
                                {t.mode === "WITHDRAWAL" ? (
                                    t.status === "PENDING" ? (
                                        <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-1 rounded uppercase">PENDING</span>
                                    ) : (
                                        <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded uppercase flex items-center justify-center gap-1"><CheckCircle size={10}/> PAID</span>
                                    )
                                ) : (
                                    <span className="text-gray-300 text-xs font-bold">COMPLETED</span>
                                )}
                            </td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {activeTab === "CONTENT" && (
            <div>
                <h2 className="text-3xl font-black text-gray-800 mb-6">App Content (CMS)</h2>
                
                {/* --- OUR MISSION SECTION --- */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-4xl mb-8">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Edit size={20}/> Edit "Our Mission"</h3>
                    <p className="text-sm text-gray-400 mb-4">This text will appear on the Login screen and User Profile.</p>
                    <textarea value={ourAimContent} onChange={(e) => setOurAimContent(e.target.value)} className="w-full h-32 p-4 border border-gray-200 rounded-xl font-medium text-gray-700 text-sm leading-relaxed mb-6 focus:border-blue-500 outline-none" placeholder="Write your mission statement here..."/>
                    <button onClick={handleUpdateContent} className="bg-black text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wide hover:bg-gray-800">Save Content</button>
                </div>

                {/* --- NOTIFICATION CONTROL PANEL --- */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-4xl">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Bell size={20}/> Notification Control</h3>
                    
                    <div className="grid grid-cols-2 gap-8">
                        {/* MANUAL PUSH */}
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                            <h4 className="font-bold text-sm text-gray-500 uppercase mb-4">📢 Send Instant Alert</h4>
                            <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Title (e.g. Rain Delay)" className="w-full p-3 mb-2 rounded-lg border border-gray-200 font-bold text-sm"/>
                            <textarea value={notifBody} onChange={e => setNotifBody(e.target.value)} placeholder="Message (e.g. All matches delayed by 1 hour)" className="w-full p-3 mb-4 rounded-lg border border-gray-200 font-medium text-sm h-24 resize-none"/>
                            <button onClick={handleSendTestNotification} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"><Send size={16}/> Send Now</button>
                        </div>

                        {/* REMINDER & FACTS SETTINGS */}
                        <div className="space-y-8">
                            
                            {/* REMINDER SCHEDULE */}
                            <div>
                                <h4 className="font-bold text-sm text-gray-500 uppercase mb-4">⏰ Reminder Schedule (Hours Before)</h4>
                                <div className="flex gap-2 mb-4">
                                    <input id="newReminderHour" type="number" placeholder="Add Hour (e.g. 12)" className="flex-1 p-3 rounded-lg border border-gray-200 font-medium text-sm"/>
                                    <button onClick={async () => {
                                        const val = document.getElementById("newReminderHour").value;
                                        if(!val) return;
                                        const newHours = [...reminderHours, parseInt(val)].sort((a,b) => b-a);
                                        setReminderHours(newHours);
                                        await fetch(`${API_URL}/admin/update-settings`, {
                                            method: 'POST', headers: {'Content-Type': 'application/json'},
                                            body: JSON.stringify({ key: "reminder_hours", value: newHours })
                                        });
                                        document.getElementById("newReminderHour").value = "";
                                    }} className="bg-black text-white px-4 rounded-lg font-bold hover:bg-gray-800">+</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {reminderHours.map((h, i) => (
                                        <div key={i} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-2">
                                            {h} Hours Before
                                            <button onClick={async () => {
                                                const newHours = reminderHours.filter((_, idx) => idx !== i);
                                                setReminderHours(newHours);
                                                await fetch(`${API_URL}/admin/update-settings`, {
                                                    method: 'POST', headers: {'Content-Type': 'application/json'},
                                                    body: JSON.stringify({ key: "reminder_hours", value: newHours })
                                                });
                                            }} className="text-blue-400 hover:text-blue-600"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* FACTS MANAGER */}
                            <div>
                                <h4 className="font-bold text-sm text-gray-500 uppercase mb-4">🧠 Manage Facts (Random Rotation)</h4>
                                <div className="flex gap-2 mb-4">
                                    <input value={newFact} onChange={e => setNewFact(e.target.value)} placeholder="Add a new sport fact..." className="flex-1 p-3 rounded-lg border border-gray-200 font-medium text-sm"/>
                                    <button onClick={handleAddFact} className="bg-black text-white px-4 rounded-lg font-bold hover:bg-gray-800">+</button>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                    {factsList.map((fact, i) => (
                                        <div key={i} className="flex justify-between items-start bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs font-medium text-gray-600">
                                            <p>{fact}</p>
                                            <button onClick={() => handleDeleteFact(i)} className="text-red-400 hover:text-red-600 ml-2"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        )}

        {/* ... (Rest of the tabs: PLAYERS, MANAGE, etc.) ... */}
        {activeTab === "PLAYERS" && (
            <div>
                <h2 className="text-3xl font-black text-gray-800 mb-6">Player Management</h2>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 max-w-xl">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Wallet size={18}/> Quick Top-Up</h3>
                    <div className="flex gap-4">
                        <input value={walletTeamId} onChange={e => setWalletTeamId(e.target.value)} placeholder="Team ID (e.g. SA99)" className="p-3 bg-gray-50 rounded-lg border font-bold text-sm w-1/2"/>
                        <input value={walletAmount} onChange={e => setWalletAmount(e.target.value)} type="number" placeholder="Amount (₹)" className="p-3 bg-gray-50 rounded-lg border font-bold text-sm w-1/3"/>
                        <button onClick={handleAddMoney} className="bg-green-600 text-white font-bold px-6 rounded-lg hover:bg-green-700">ADD</button>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-400 border-b border-gray-100 text-xs uppercase font-bold">
                            <tr>
                                <th className="p-4">Name</th>
                                <th className="p-4">Contact & Info</th>
                                <th className="p-4">Registered On</th>
                                <th className="p-4">Team ID</th>
                                <th className="p-4">Wallet Balance</th>
                                <th className="p-4">Bank Details</th> {/* NEW COLUMN HERE */}
                                <th className="p-4 text-right">History</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {Array.isArray(players) && players.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-bold text-gray-800">{p.name}</td>
                                    <td className="p-4"><p className="font-bold text-gray-700">{p.phone}</p><p className="text-[10px] text-gray-400">{p.email || "No Email"}</p><p className="text-[10px] text-blue-500 uppercase font-bold mt-1">{p.gender} • {p.dob || "-"}</p></td>
                                    <td className="p-4 text-xs font-bold text-gray-500">{p.registration_date ? new Date(p.registration_date).toLocaleDateString() : "-"}</td>
                                    <td className="p-4"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded font-black text-xs">{p.team_id}</span></td>
                                    <td className="p-4 font-black text-green-600">₹{p.wallet_balance}</td>
                                    
                                    {/* NEW DATA CELL: BANK DETAILS BUTTON */}
                                    <td className="p-4">
                                        {p.bank_details ? (
                                            <button 
                                                onClick={() => alert(`SAVED BANK DETAILS:\n\n${p.bank_details}`)}
                                                className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200"
                                            >
                                                View Info
                                            </button>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>

                                    <td className="p-4 text-right"><button onClick={() => handleViewHistory(p)} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200"><FileText size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === "MANAGE" && selectedTournament && (
            <div className="max-w-6xl">
                <div className="flex justify-between items-center mb-4"><div><button onClick={() => {setActiveTab("TOURNAMENTS"); setViewMode("MATCHES");}} className="text-xs font-bold text-gray-400 hover:text-gray-600 mb-1">← Back to Events</button><h2 className="text-3xl font-black text-blue-900">{selectedTournament.name} <span className="text-lg text-gray-400">({selectedTournament.city} • {selectedTournament.sport})</span></h2></div><button onClick={() => {fetchMatches(); fetchLeaderboard();}} className="p-2 bg-white border rounded hover:bg-gray-50"><RefreshCw size={20}/></button></div>
                <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-1">
                    <div className="flex gap-2">{(() => { try { const cats = JSON.parse(selectedTournament.settings || "[]"); return cats.map((cat, idx) => (<button key={idx} onClick={() => setActiveLevelTab(cat.name)} className={`px-6 py-2 font-bold text-sm rounded-t-lg transition-all ${activeLevelTab === cat.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{cat.name.toUpperCase()}</button>)); } catch(e) { return null; } })()}</div>
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-1"><button onClick={() => setViewMode("MATCHES")} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${viewMode === "MATCHES" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}><List size={14}/> Matches</button><button onClick={() => setViewMode("LEADERBOARD")} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${viewMode === "LEADERBOARD" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}><Trophy size={14}/> Leaderboard</button></div>
                </div>

                {viewMode === "MATCHES" ? (
                    <div className="grid grid-cols-12 gap-8">
                        <div className="col-span-5">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-4"><h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-xs uppercase"><UserPlus size={14}/> Add Player to {activeLevelTab}</h3><div className="flex gap-2"><input value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="Name" className="w-1/3 p-2 bg-gray-50 rounded border text-xs font-bold"/><input value={manualPhone} onChange={e=>setManualPhone(e.target.value)} placeholder="Phone" className="w-1/3 p-2 bg-gray-50 rounded border text-xs font-bold"/><button onClick={handleManualRegister} className="flex-1 bg-black text-white text-xs font-bold rounded">ADD</button></div></div>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-gray-700 text-sm flex justify-between items-center"><span>Teams ({filteredPlayers.length})</span><span className={filteredPlayers.length >= (selectedTournament.draw_size || 16) ? "text-red-500 text-xs" : "text-green-500 text-xs"}>{filteredPlayers.length}/{selectedTournament.draw_size || 16} Filled</span></div><table className="w-full text-left text-sm"><thead className="bg-white text-gray-400 border-b border-gray-100 text-xs uppercase font-bold"><tr><th className="p-3">Name</th><th className="p-3">Grp</th><th className="p-3">ID</th></tr></thead><tbody className="divide-y divide-gray-50">{filteredPlayers.length > 0 ? (filteredPlayers.map(p => (<tr key={p.id}><td className="p-3 font-bold text-gray-800">{p.name}</td><td className="p-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{p.group_id || "-"}</span></td><td className="p-3 font-mono text-gray-400 text-xs">{p.team_id}</td></tr>))) : (<tr><td colSpan="3" className="p-4 text-center text-gray-400 text-xs">No players in {activeLevelTab}.</td></tr>)}</tbody></table></div>
                        </div>

                        <div className="col-span-7">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-4">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Calendar size={18}/> Add Match ({activeLevelTab})</h3>
                                <div className="grid grid-cols-2 gap-3 mb-3"><select onChange={e=>setNewMatchT1(e.target.value)} value={newMatchT1} className="p-2 bg-gray-50 rounded border text-sm font-bold"><option value="">Select Team 1</option>{filteredPlayers.map(p => <option key={p.id} value={p.name}>{p.name} (Gr. {p.group_id})</option>)}</select><select onChange={e=>setNewMatchT2(e.target.value)} value={newMatchT2} className="p-2 bg-gray-50 rounded border text-sm font-bold"><option value="">Select Team 2</option>{filteredPlayers.filter(p => p.name !== newMatchT1).map(p => <option key={p.id} value={p.name}>{p.name} (Gr. {p.group_id})</option>)}</select></div>
                                <div className="grid grid-cols-3 gap-3 mb-3"><input onChange={e=>setNewMatchDate(e.target.value)} type="date" className="p-2 bg-gray-50 rounded border text-sm font-bold"/><input onChange={e=>setNewMatchTime(e.target.value)} type="time" className="p-2 bg-gray-50 rounded border text-sm font-bold"/><select onChange={e=>setNewMatchStage(e.target.value)} className="p-2 bg-gray-50 rounded border text-sm font-bold"><option value="Group Stage">Group Stage</option><option value="Quarter Final">Quarter Final</option><option value="Semi Final">Semi Final</option><option value="Final">Final</option><option value="3rd Place">3rd Place</option><option value="Cross Stage">Cross Stage</option><option value="Backdraw">Backdraw</option></select></div>
                                <button onClick={handleCreateMatch} className="w-full bg-black text-white font-bold rounded-lg text-sm hover:bg-gray-800 p-3">+ Add Match</button>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-400 border-b border-gray-100 text-xs uppercase font-bold"><tr><th className="p-4">Teams</th><th className="p-4">Date & Time</th><th className="p-4">Stage</th><th className="p-4">Score</th><th className="p-4">Winner</th><th className="p-4 text-right">Actions</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">{Array.isArray(matches) && matches.map(m => (<tr key={m.id} className={m.status === "Pending Verification" ? "bg-yellow-50" : ""}><td className="p-4"><div className="flex flex-col gap-1"><input id={`t1-${m.id}`} defaultValue={m.t1} className="p-1 bg-transparent rounded text-xs font-bold border-none w-32"/><input id={`t2-${m.id}`} defaultValue={m.t2} className="p-1 bg-transparent rounded text-xs font-bold border-none w-32"/></div></td>
                                    
                                    {/* NEW: Date & Time Inputs */}
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <input id={`date-${m.id}`} type="date" defaultValue={m.date} className="p-1 bg-transparent rounded text-xs font-bold border border-gray-100 w-24"/>
                                            <input id={`time-${m.id}`} type="time" defaultValue={m.time} className="p-1 bg-transparent rounded text-xs font-bold border border-gray-100 w-24"/>
                                        </div>
                                    </td>

                                    <td className="p-4"><span className="text-[9px] text-gray-500 uppercase font-bold bg-gray-100 px-2 py-1 rounded">{m.stage}</span></td>

                                    <td className="p-4">
                                        <input id={`score-${m.id}`} defaultValue={m.score} placeholder="-" className="w-16 bg-white border border-gray-200 text-center rounded font-bold p-2"/>
                                        {m.status === "Pending Verification" && <p className="text-[9px] text-orange-500 font-bold mt-1">PENDING</p>}
                                        {m.status === "Official" && <p className="text-[9px] text-green-500 font-bold mt-1">OFFICIAL</p>}
                                    </td>
                                    
                                    <td className="p-4 font-bold text-green-600 text-xs">{getWinner(m)}</td>

                                    <td className="p-4 text-right">
                                        <button onClick={() => handleMatchUpdate(m)} className="bg-blue-600 text-white p-2 rounded-lg mr-2"><Save size={16}/></button>
                                        <button onClick={() => handleDeleteMatch(m.id)} className="bg-red-100 text-red-600 p-2 rounded-lg"><Trash2 size={16}/></button>
                                    </td></tr>))}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 font-bold text-blue-800 text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2"><Trophy size={18}/> Live Leaderboard ({activeLevelTab})</div>
                            <div className="flex gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase pt-1 flex items-center gap-1"><Filter size={12}/> Filter:</span>
                                {["ALL", "A", "B", "C", "D"].map(g => (
                                    <button key={g} onClick={() => setLeaderboardGroup(g)} className={`px-3 py-1 rounded-md text-[10px] font-bold ${leaderboardGroup === g ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>{g === "ALL" ? "All Groups" : `Group ${g}`}</button>
                                ))}
                            </div>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-gray-400 border-b border-gray-100 text-xs uppercase font-bold">
                                <tr><th className="p-4">Rank</th><th className="p-4">Team</th><th className="p-4 text-center">Played</th><th className="p-4 text-center">Won</th><th className="p-4 text-center">Games</th><th className="p-4 text-center">Points</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {Array.isArray(filteredLeaderboard) && filteredLeaderboard.length > 0 ? (
                                    filteredLeaderboard.map((team, i) => (
                                    <tr key={i} className={i < 2 ? "bg-green-50/50" : ""}>
                                        <td className="p-4 font-bold text-gray-400 text-xs">#{i+1}</td>
                                        <td className="p-4 font-bold text-gray-800">{team.name} <span className="text-[10px] text-gray-400">({team.team_id})</span> <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] ml-2">Grp {team.group}</span></td>
                                        <td className="p-4 text-center font-bold text-gray-600">{team.played}</td>
                                        <td className="p-4 text-center font-bold text-green-600">{team.gamesWon}</td>
                                        <td className="p-4 text-center font-bold text-gray-600">{team.totalGamePoints}</td>
                                        <td className="p-4 text-center font-black text-blue-600 text-lg">{team.points}</td>
                                    </tr>
                                ))
                                ) : (
                                    <tr><td colSpan="6" className="p-8 text-center text-gray-400 text-xs font-bold">No teams found in {leaderboardGroup === "ALL" ? "this category" : `Group ${leaderboardGroup}`}.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;