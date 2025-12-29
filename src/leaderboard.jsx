import React, { useState } from 'react';
import { Trophy, Medal, AlertCircle } from 'lucide-react';

const Leaderboard = () => {
  const [activeGroup, setActiveGroup] = useState('A');

  // Mock Data: Added 'gamesWon' and 'group' properties
  const players = [
    { id: 1, name: "Arjun Mehta", points: 1200, gamesWon: 45, group: 'A', avatar: "/api/placeholder/40/40" },
    { id: 2, name: "Sarah Jenkins", points: 1150, gamesWon: 42, group: 'A', avatar: "/api/placeholder/40/40" },
    { id: 3, name: "Mike Chen", points: 1200, gamesWon: 40, group: 'A', avatar: "/api/placeholder/40/40" }, // Same points as Arjun, fewer games won
    { id: 4, name: "Lisa Ray", points: 900, gamesWon: 30, group: 'B', avatar: "/api/placeholder/40/40" },
    { id: 5, name: "Tom Ford", points: 850, gamesWon: 28, group: 'B', avatar: "/api/placeholder/40/40" },
    { id: 6, name: "Jenny Wilson", points: 600, gamesWon: 20, group: 'C', avatar: "/api/placeholder/40/40" },
    { id: 7, name: "Rob Stark", points: 400, gamesWon: 15, group: 'D', avatar: "/api/placeholder/40/40" },
  ];

  const groups = ['A', 'B', 'C', 'D'];

  // Logic: Filter by Group -> Sort by Points -> Sort by Games Won (Tie-breaker)
  const filteredPlayers = players
    .filter(player => player.group === activeGroup)
    .sort((a, b) => {
      // Primary Sort: Points (High to Low)
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      // Secondary Sort: Games Won (High to Low)
      return b.gamesWon - a.gamesWon;
    });

  const getRankIcon = (index) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="font-bold text-gray-500 w-5 text-center">{index + 1}</span>;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      
      {/* Header */}
      <div className="bg-blue-900 p-6 text-white">
        <h2 className="text-2xl font-bold text-center">Leaderboard</h2>
        <p className="text-center text-blue-200 text-sm mt-1">Season 2025</p>
      </div>

      {/* Group Selector */}
      <div className="flex justify-center p-4 bg-gray-50 border-b border-gray-100">
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                activeGroup === group
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              Group {group}
            </button>
          ))}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
        <div className="col-span-2 text-center">Rank</div>
        <div className="col-span-6">Player</div>
        <div className="col-span-2 text-center">Games</div>
        <div className="col-span-2 text-center">Pts</div>
      </div>

      {/* Player List */}
      <div className="divide-y divide-gray-100">
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map((player, index) => (
            <div 
              key={player.id} 
              className="grid grid-cols-12 gap-2 px-4 py-4 items-center hover:bg-blue-50 transition-colors duration-150"
            >
              {/* Rank */}
              <div className="col-span-2 flex justify-center">
                {getRankIcon(index)}
              </div>

              {/* Player Name */}
              <div className="col-span-6 flex items-center space-x-3">
                <img 
                  src={player.avatar} 
                  alt={player.name} 
                  className="w-8 h-8 rounded-full bg-gray-200"
                />
                <span className="font-semibold text-gray-800 text-sm truncate">
                  {player.name}
                </span>
              </div>

              {/* Games Won (Tie Breaker) */}
              <div className="col-span-2 text-center text-gray-500 font-medium text-sm">
                {player.gamesWon}
              </div>

              {/* Points */}
              <div className="col-span-2 text-center font-bold text-blue-600 text-sm">
                {player.points}
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-gray-400 flex flex-col items-center">
            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
            <p>No players found in Group {activeGroup}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;