import React, { useState, useEffect } from 'react';
import { RefreshCw, Calendar, Save, Plus, Edit2, X, Trash2, Users, Wallet } from 'lucide-react';

const Dashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("TOURNAMENTS"); 
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tournamentPlayers, setTournamentPlayers] = useState([]);
  const [walletTeamId, setWalletTeamId] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("League");
  const [eventStatus, setEventStatus] = useState("Open");
  const [categories, setCategories] = useState([{ name: "Advance", fee: 2500, p1: 30000, p2: 15000, p3: 5000 }]);
  const API_URL = "http://127.0.0.1:8000"; 

  const handleLogin = () => { if (password === "admin123") { setIsAuthenticated(true); fetchTournaments(); } else { alert("Wrong Password"); } };
  const fetchTournaments = async () => { try { const res = await fetch(`${API_URL}/tournaments`); setTournaments(await res.json()); } catch (e) {} };
  const fetchMatches = async () => { try { const res = await fetch(`${API_URL}/scores`); const data = await res.json(); const filtered = selectedTournament ? data.filter(m => m.category === selectedTournament.name) : data; setMatches(filtered.sort((a,b) => a.id - b.id)); } catch(e) {} };
  const fetchPlayers = async () => { try { const res = await fetch(`${API_URL}/admin/players`); setPlayers(await res.json()); } catch(e){} };
  const fetchTournamentPlayers = async () => { if(!selectedTournament) return; try { const res = await fetch(`${API_URL}/admin/tournament-players/${selectedTournament.name}`); setTournamentPlayers(await res.json()); } catch(e){} };

  useEffect(() => { if(isAuthenticated) { if (activeTab === "PLAYERS") fetchPlayers(); else if (activeTab === "MANAGE" && selectedTournament) { fetchMatches(); fetchTournamentPlayers(); } else { fetchMatches(); } } }, [selectedTournament, isAuthenticated, activeTab]);

  const handleAddMoney = async () => { if (!walletTeamId || !walletAmount) return alert("Fill fields"); const res = await fetch(`${API_URL}/admin/add-wallet`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ team_id: walletTeamId, amount: parseInt(walletAmount) }) }); if (res.ok) { alert("Money Added!"); setWalletTeamId(""); setWalletAmount(""); fetchPlayers(); } else { alert("Player Not Found"); } };
  const handleDeleteTournament = async (id) => { if(!window.confirm("Delete this event?")) return; await fetch(`${API_URL}/admin/delete-tournament`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id }) }); fetchTournaments(); if(selectedTournament?.id === id) setSelectedTournament(null); };
  const openCreateModal = () => { setEditingId(null); setEventName(""); setEventType("League"); setEventStatus("Open"); setCategories([{ name: "", fee: 0, p1: 0, p2: 0, p3: 0 }]); setIsModalOpen(true); };
  const openEditModal = (t) => { setEditingId(t.id); setEventName(t.name); setEventType(t.type); setEventStatus(t.status); try { setCategories(JSON.parse(t.settings || "[]")); } catch { setCategories([{ name: "Default", fee: t.fee, p1: 0, p2: 0, p3: 0 }]); } setIsModalOpen(true); };
  const handleModalSubmit = async () => { if(!eventName) return alert("Enter Name"); const endpoint = editingId ? '/admin/edit-tournament' : '/admin/create-tournament'; const body = { id: editingId, name: eventName, type: eventType, status: eventStatus, settings: categories }; await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) }); setIsModalOpen(false); fetchTournaments(); };
  const updateCategory = (idx, f, v) => { const n = [...categories]; n[idx][f] = v; setCategories(n); };
  const addCategoryRow = () => setCategories([...categories, { name: "", fee: 0, p1: 0, p2: 0, p3: 0 }]);
  const removeCategory = (idx) => setCategories(categories.filter((_, i) => i !== idx));
  const handleCreateMatch = async () => { if (!selectedTournament) return alert("Select a tournament first!"); const t1 = document.getElementById('new-t1').value || "Team 1"; const t2 = document.getElementById('new-t2').value || "Team 2"; const date = document.getElementById('new-date').value; const time = document.getElementById('new-time').value; const group = document.getElementById('new-grp').value || "A"; await fetch(`${API_URL}/admin/create-match`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ category: selectedTournament.name, group_id: group, t1, t2, date, time }) }); fetchMatches(); };
  const handleMatchUpdate = async (id) => { const t1 = document.getElementById(`t1-${id}`).value; const t2 = document.getElementById(`t2-${id}`).value; const date = document.getElementById(`date-${id}`).value; const time = document.getElementById(`time-${id}`).value; const score = document.getElementById(`score-${id}`).value; await fetch(`${API_URL}/admin/edit-match-full`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id, t1, t2, date, time, score }) }); alert("Match Updated"); fetchMatches(); };
  const handleDeleteMatch = async (id) => { if(!window.confirm("Delete this match?")) return; await fetch(`${API_URL}/admin/delete-match`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id }) }); fetchMatches(); };

  if (!isAuthenticated) return ( <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-sm text-center"><h1 className="text-2xl font-black mb-4">ADMIN ACCESS</h1><input type="password" placeholder="Pass" className="w-full bg-gray-100 p-4 rounded-xl mb-4 font-bold text-center" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={handleLogin} className="w-full bg-black text-white p-4 rounded-xl font-bold">UNLOCK</button></div></div> );

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col md:flex-row relative">
      {/* MODAL */}
      {isModalOpen && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden"><div className="bg-black p-4 flex justify-between items-center text-white"><h3 className="font-bold">{editingId ? "Edit Event" : "Create New Event"}</h3><button onClick={() => setIsModalOpen(false)}><X size={20}/></button></div><div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-400 uppercase">Event Name</label><input value={eventName} onChange={e => setEventName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"/></div><div><label className="text-xs font-bold text-gray-400 uppercase">Status</label><select value={eventStatus} onChange={e => setEventStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"><option value="Open">Open</option><option value="Ongoing">Ongoing</option><option value="Finished">Finished</option></select></div></div><div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Categories, Fees & Prizes</label><div className="space-y-2">{categories.map((cat, idx) => (<div key={idx} className="flex gap-2 items-center"><input placeholder="Name" value={cat.name} onChange={e => updateCategory(idx, 'name', e.target.value)} className="w-40 p-2 bg-gray-50 rounded border text-xs font-bold"/><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">Fee</span><input type="number" value={cat.fee} onChange={e => updateCategory(idx, 'fee', e.target.value)} className="w-20 p-2 bg-gray-50 rounded border text-xs font-bold"/></div><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">1st</span><input type="number" value={cat.p1} onChange={e => updateCategory(idx, 'p1', e.target.value)} className="w-24 p-2 bg-green-50 rounded border border-green-200 text-xs font-bold text-green-700"/></div><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">2nd</span><input type="number" value={cat.p2} onChange={e => updateCategory(idx, 'p2', e.target.value)} className="w-24 p-2 bg-gray-50 rounded border text-xs font-bold"/></div><div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase font-bold">3rd</span><input type="number" value={cat.p3} onChange={e => updateCategory(idx, 'p3', e.target.value)} className="w-24 p-2 bg-gray-50 rounded border text-xs font-bold"/></div><button onClick={() => removeCategory(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded mt-3"><Trash2 size={16}/></button></div>))}</div><button onClick={addCategoryRow} className="mt-2 text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded flex items-center gap-1"><Plus size={14}/> Add Category</button></div><button onClick={handleModalSubmit} className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800">{editingId ? "Save Changes" : "Create Event"}</button></div></div></div>)}

      {/* SIDEBAR */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0">
        <h1 className="font-black text-xl text-blue-900 italic mb-6 px-2">CLUB 28 ADMIN</h1>
        <div className="space-y-1">
            <button onClick={() => {setActiveTab("TOURNAMENTS"); setSelectedTournament(null);}} className={`w-full text-left px-4 py-3 rounded-xl font-bold ${activeTab === "TOURNAMENTS" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Events</button>
            <button onClick={() => {setActiveTab("PLAYERS"); setSelectedTournament(null);}} className={`w-full text-left px-4 py-3 rounded-xl font-bold ${activeTab === "PLAYERS" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Players & Wallet</button>
            <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase mt-4">Active Events</div>
            {tournaments.map(t => ( <button key={t.id} onClick={() => {setSelectedTournament(t); setActiveTab("MANAGE");}} className={`w-full text-left px-4 py-2 rounded-lg font-medium text-sm ${selectedTournament?.id === t.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{t.name}</button> ))}
            <button onClick={openCreateModal} className="w-full mt-4 border border-dashed border-gray-300 p-2 rounded-lg text-xs font-bold text-gray-400 hover:text-blue-600 hover:border-blue-600">+ Create New Event</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 h-screen">
        {activeTab === "TOURNAMENTS" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments.map(t => (
                    <div key={t.id} onClick={() => {setSelectedTournament(t); setActiveTab("MANAGE");}} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer relative group">
                        <div className="absolute top-4 right-4 flex gap-2 z-10"><button onClick={(e) => { e.stopPropagation(); handleDeleteTournament(t.id); }} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 hover:text-red-700"><Trash2 size={16}/></button><button onClick={(e) => { e.stopPropagation(); openEditModal(t); }} className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-blue-100 hover:text-blue-600"><Edit2 size={16}/></button></div>
                        <div className="flex justify-between items-start mb-4"><span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded uppercase">{t.type}</span></div><h3 className="font-bold text-xl text-gray-800 mb-1">{t.name}</h3><div className="flex gap-4 text-sm text-gray-500 mt-4 border-t border-gray-50 pt-4"><div><span className="block text-[10px] font-bold uppercase text-gray-300">Fee Starts</span>₹{t.fee}</div><div><span className="block text-[10px] font-bold uppercase text-gray-300">Max Prize</span>₹{t.prize}</div></div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === "PLAYERS" && (
            <div><h2 className="text-3xl font-black text-gray-800 mb-6">Player Management</h2><div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 max-w-xl"><h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Wallet size={18}/> Quick Top-Up</h3><div className="flex gap-4"><input value={walletTeamId} onChange={e => setWalletTeamId(e.target.value)} placeholder="Team ID (e.g. SA99)" className="p-3 bg-gray-50 rounded-lg border font-bold text-sm w-1/2"/><input value={walletAmount} onChange={e => setWalletAmount(e.target.value)} type="number" placeholder="Amount (₹)" className="p-3 bg-gray-50 rounded-lg border font-bold text-sm w-1/3"/><button onClick={handleAddMoney} className="bg-green-600 text-white font-bold px-6 rounded-lg hover:bg-green-700">ADD</button></div></div><div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-400 border-b border-gray-100 text-xs uppercase font-bold"><tr><th className="p-4">Name</th><th className="p-4">Phone</th><th className="p-4">Team ID</th><th className="p-4">Wallet Balance</th></tr></thead><tbody className="divide-y divide-gray-50">{players.map(p => (<tr key={p.id}><td className="p-4 font-bold text-gray-800">{p.name}</td><td className="p-4 text-gray-500 font-bold">{p.phone}</td><td className="p-4"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded font-black text-xs">{p.team_id}</span></td><td className="p-4 font-black text-green-600">₹{p.wallet_balance}</td></tr>))}</tbody></table></div></div>
        )}

        {activeTab === "MANAGE" && selectedTournament && (
            <div className="max-w-5xl">
                <div className="flex justify-between items-center mb-8"><div><button onClick={() => setActiveTab("TOURNAMENTS")} className="text-xs font-bold text-gray-400 hover:text-gray-600 mb-1">← Back to Events</button><h2 className="text-3xl font-black text-blue-900">{selectedTournament.name}</h2></div><button onClick={fetchMatches} className="p-2 bg-white border rounded hover:bg-gray-50"><RefreshCw size={20}/></button></div>
                
                {/* REGISTERED PLAYERS TABLE */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-gray-700 text-sm flex items-center gap-2"><Users size={16}/> Registered Teams ({tournamentPlayers.length})</div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-gray-400 border-b border-gray-100 text-xs uppercase font-bold"><tr><th className="p-4">Team Name</th><th className="p-4">Phone</th><th className="p-4">Category</th><th className="p-4">Team ID</th></tr></thead>
                        <tbody className="divide-y divide-gray-50">
                            {tournamentPlayers.length > 0 ? (
                                tournamentPlayers.map(p => (
                                    <tr key={p.id}>
                                        <td className="p-4 font-bold text-gray-800">{p.name}</td>
                                        <td className="p-4 text-gray-500">{p.phone}</td>
                                        <td className="p-4"><span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-black uppercase">{p.active_level}</span></td>
                                        <td className="p-4 font-mono text-gray-400">{p.team_id}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="4" className="p-8 text-center text-gray-400">No players registered yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8"><h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Calendar size={18}/> Add Match</h3><div className="grid grid-cols-5 gap-3"><input id="new-grp" placeholder="Group" className="p-2 bg-gray-50 rounded border text-sm font-bold"/><input id="new-t1" placeholder="Team 1" className="p-2 bg-gray-50 rounded border text-sm font-bold"/><input id="new-t2" placeholder="Team 2" className="p-2 bg-gray-50 rounded border text-sm font-bold"/><input id="new-date" type="date" className="p-2 bg-gray-50 rounded border text-sm font-bold"/><input id="new-time" type="time" className="p-2 bg-gray-50 rounded border text-sm font-bold"/></div><button onClick={handleCreateMatch} className="w-full mt-3 bg-black text-white font-bold py-3 rounded-lg text-sm hover:bg-gray-800">+ Add Match</button></div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-400 border-b border-gray-100 text-xs uppercase font-bold"><tr><th className="p-4">Teams</th><th className="p-4">Schedule</th><th className="p-4">Score</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-50">{matches.map(m => (<tr key={m.id}><td className="p-4"><div className="flex flex-col gap-1"><input id={`t1-${m.id}`} defaultValue={m.t1} className="p-1 bg-gray-50 rounded text-xs font-bold border-none w-32"/><input id={`t2-${m.id}`} defaultValue={m.t2} className="p-1 bg-gray-50 rounded text-xs font-bold border-none w-32"/></div></td><td className="p-4"><div className="flex flex-col gap-1"><input type="date" id={`date-${m.id}`} defaultValue={m.date} className="p-1 bg-gray-50 rounded text-xs font-bold border-none w-28"/><input type="time" id={`time-${m.id}`} defaultValue={m.time} className="p-1 bg-gray-50 rounded text-xs font-bold border-none w-20"/></div></td><td className="p-4"><input id={`score-${m.id}`} defaultValue={m.score} placeholder="-" className="w-16 bg-gray-100 text-center rounded font-bold p-2"/></td><td className="p-4 text-right"><button onClick={() => handleMatchUpdate(m.id)} className="bg-blue-600 text-white p-2 rounded-lg mr-2"><Save size={16}/></button><button onClick={() => handleDeleteMatch(m.id)} className="bg-red-100 text-red-600 p-2 rounded-lg"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
            </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;