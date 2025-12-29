import React, { useState, useEffect } from 'react';
import { Lock, RefreshCw, Calendar, Trophy, Settings, Save, AlertTriangle, Plus, ChevronRight, Edit2, X } from 'lucide-react';

const Dashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("TOURNAMENTS"); 
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [editingTournament, setEditingTournament] = useState(null); // New state for Edit Modal
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (password === "admin123") { setIsAuthenticated(true); fetchTournaments(); } 
    else { alert("Wrong Password"); }
  };

  const fetchTournaments = async () => {
    const res = await fetch('http://127.0.0.1:8000/tournaments');
    const data = await res.json();
    setTournaments(data);
  };

  const fetchMatches = async () => {
    setLoading(true);
    const res = await fetch('http://127.0.0.1:8000/scores');
    const data = await res.json();
    const filtered = selectedTournament 
        ? data.filter(m => m.category === selectedTournament.name)
        : data;
    setMatches(filtered.sort((a,b) => a.id - b.id));
    setLoading(false);
  };

  useEffect(() => { if(isAuthenticated) fetchMatches(); }, [selectedTournament, isAuthenticated]);

  const handleCreateTournament = async () => {
    const name = prompt("Enter Tournament Name (e.g. Feb League):");
    if(!name) return;
    const type = prompt("Type (League/Knockout):", "League");
    const fee = prompt("Entry Fee:", "2500");
    const prize = prompt("Prize Pool:", "50000");

    await fetch('http://127.0.0.1:8000/admin/create-tournament', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, type, fee, prize })
    });
    fetchTournaments();
  };

  // --- NEW: HANDLE EDIT SUBMISSION ---
  const handleEditSubmit = async () => {
      if(!editingTournament) return;
      
      await fetch('http://127.0.0.1:8000/admin/edit-tournament', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
              id: editingTournament.id,
              name: document.getElementById('edit-name').value,
              fee: document.getElementById('edit-fee').value,
              prize: document.getElementById('edit-prize').value,
              status: document.getElementById('edit-status').value
          })
      });
      alert("Tournament Updated!");
      setEditingTournament(null); // Close modal
      fetchTournaments(); // Refresh list
  };

  const handleCreateMatch = async () => {
    if (!selectedTournament) return alert("Select a tournament first!");
    const t1 = document.getElementById('new-t1').value;
    const t2 = document.getElementById('new-t2').value;
    const date = document.getElementById('new-date').value;
    const time = document.getElementById('new-time').value;
    const group = document.getElementById('new-grp').value || "A";

    await fetch('http://127.0.0.1:8000/admin/create-match', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            category: selectedTournament.name, 
            group_id: group, t1, t2, date, time 
        })
    });
    fetchMatches();
  };

  const handleScoreUpdate = async (id, score) => {
      await fetch('http://127.0.0.1:8000/admin/update-score', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({match_id: id, score})});
      fetchMatches();
  };

  const handleScheduleUpdate = async (matchId, date, time) => {
    await fetch('http://127.0.0.1:8000/admin/edit-schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, date, time })
    });
    // alert("Schedule Updated"); // Optional alert
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl w-full max-w-sm text-center">
            <h1 className="text-2xl font-black mb-4">ADMIN ACCESS</h1>
            <input type="password" placeholder="Pass" className="w-full bg-gray-100 p-4 rounded-xl mb-4 font-bold text-center" value={password} onChange={e=>setPassword(e.target.value)}/>
            <button onClick={handleLogin} className="w-full bg-black text-white p-4 rounded-xl font-bold">UNLOCK</button>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col md:flex-row relative">
      
      {/* EDIT MODAL OVERLAY */}
      {editingTournament && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                  <div className="bg-blue-900 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold">Edit Tournament</h3>
                      <button onClick={() => setEditingTournament(null)}><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">Event Name</label>
                          <input id="edit-name" defaultValue={editingTournament.name} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs font-bold text-gray-400 uppercase">Entry Fee (₹)</label>
                              <input id="edit-fee" defaultValue={editingTournament.fee} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"/>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-400 uppercase">Prize Pool (₹)</label>
                              <input id="edit-prize" defaultValue={editingTournament.prize} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200"/>
                          </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                          <select id="edit-status" defaultValue={editingTournament.status} className="w-full p-3 bg-gray-50 rounded-lg font-bold border border-gray-200">
                              <option value="Open">Open (Registration Active)</option>
                              <option value="Ongoing">Ongoing (Matches Active)</option>
                              <option value="Finished">Finished</option>
                          </select>
                      </div>
                      <button onClick={handleEditSubmit} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">Save Changes</button>
                  </div>
              </div>
          </div>
      )}

      {/* SIDEBAR */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0">
        <h1 className="font-black text-xl text-blue-900 italic mb-6 px-2">CLUB 28 ADMIN</h1>
        <div className="space-y-1">
            <button onClick={() => {setActiveTab("TOURNAMENTS"); setSelectedTournament(null);}} className={`w-full text-left px-4 py-3 rounded-xl font-bold ${activeTab === "TOURNAMENTS" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>All Events</button>
            <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase mt-4">Active Events</div>
            {tournaments.map(t => (
                <button key={t.id} onClick={() => {setSelectedTournament(t); setActiveTab("MANAGE");}} className={`w-full text-left px-4 py-2 rounded-lg font-medium text-sm ${selectedTournament?.id === t.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                    {t.name}
                </button>
            ))}
            <button onClick={handleCreateTournament} className="w-full mt-4 border border-dashed border-gray-300 p-2 rounded-lg text-xs font-bold text-gray-400 hover:text-blue-600 hover:border-blue-600">+ Create New Event</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 h-screen">
        {activeTab === "TOURNAMENTS" && (
            <div>
                <h2 className="text-3xl font-black text-gray-800 mb-6">Tournament Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tournaments.map(t => (
                        <div key={t.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all relative group">
                            {/* EDIT BUTTON */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingTournament(t); }}
                                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-blue-100 hover:text-blue-600 z-10"
                            >
                                <Edit2 size={16}/>
                            </button>

                            <div onClick={() => {setSelectedTournament(t); setActiveTab("MANAGE");}} className="cursor-pointer">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded uppercase">{t.type}</span>
                                </div>
                                <h3 className="font-bold text-xl text-gray-800 mb-1">{t.name}</h3>
                                <div className="flex gap-4 text-sm text-gray-500 mt-4 border-t border-gray-50 pt-4">
                                    <div><span className="block text-[10px] font-bold uppercase text-gray-300">Entry</span>₹{t.fee}</div>
                                    <div><span className="block text-[10px] font-bold uppercase text-gray-300">Prize</span>₹{t.prize}</div>
                                    <div><span className="block text-[10px] font-bold uppercase text-gray-300">Status</span>{t.status}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={handleCreateTournament} className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all min-h-[180px]">
                        <Plus size={32} className="mb-2"/>
                        <span className="font-bold text-sm">Create New Event</span>
                    </button>
                </div>
            </div>
        )}

        {activeTab === "MANAGE" && selectedTournament && (
            <div className="max-w-5xl">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <button onClick={() => setActiveTab("TOURNAMENTS")} className="text-xs font-bold text-gray-400 hover:text-gray-600 mb-1">← Back to Events</button>
                        <h2 className="text-3xl font-black text-blue-900">{selectedTournament.name}</h2>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchMatches} className="p-2 bg-white border rounded hover:bg-gray-50"><RefreshCw size={20}/></button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Calendar size={18}/> Add Match to Schedule</h3>
                    <div className="grid grid-cols-5 gap-3">
                        <input id="new-grp" placeholder="Group (A)" className="p-2 bg-gray-50 rounded border text-sm font-bold"/>
                        <input id="new-t1" placeholder="Team 1" className="p-2 bg-gray-50 rounded border text-sm font-bold"/>
                        <input id="new-t2" placeholder="Team 2" className="p-2 bg-gray-50 rounded border text-sm font-bold"/>
                        <input id="new-date" type="date" className="p-2 bg-gray-50 rounded border text-sm font-bold"/>
                        <input id="new-time" type="time" className="p-2 bg-gray-50 rounded border text-sm font-bold"/>
                    </div>
                    <button onClick={handleCreateMatch} className="w-full mt-3 bg-black text-white font-bold py-3 rounded-lg text-sm hover:bg-gray-800">+ Add Match to {selectedTournament.name}</button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-400 border-b border-gray-100 text-xs uppercase font-bold"><tr><th className="p-4">Match</th><th className="p-4">Date & Time</th><th className="p-4 text-center">Score</th><th className="p-4 text-right">Save Time</th></tr></thead>
                        <tbody className="divide-y divide-gray-50">
                            {matches.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-bold text-gray-700">{m.t1} <span className="text-gray-400 font-normal">vs</span> {m.t2} <span className="ml-2 text-[10px] bg-gray-100 px-1 rounded text-gray-500">{m.group_id}</span></td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <input type="date" defaultValue={m.date} id={`date-${m.id}`} className="bg-gray-100 border-none rounded px-2 py-1 text-xs font-bold w-24"/>
                                            <input type="time" defaultValue={m.time} id={`time-${m.id}`} className="bg-gray-100 border-none rounded px-2 py-1 text-xs font-bold w-20"/>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <input type="text" defaultValue={m.score} placeholder="-" className="w-16 bg-gray-100 text-center rounded font-bold p-1" onBlur={(e) => handleScoreUpdate(m.id, e.target.value)}/>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => { const d = document.getElementById(`date-${m.id}`).value; const t = document.getElementById(`time-${m.id}`).value; handleScheduleUpdate(m.id, d, t); }} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"><Save size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {matches.length === 0 && <div className="p-8 text-center text-gray-400">No matches yet. Add one above.</div>}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;