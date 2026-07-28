'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getAccount, createAccount } from '@/lib/account';
import ProfileToggle from '@/components/ProfileToggle';
import ProfilePanel from '@/components/ProfilePanel';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const router = useRouter();

  useEffect(() => {
    const account = getAccount();
    if (account) {
      setPlayerName(account.name);
    }
  }, []);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) return;
    
    let account = getAccount();
    if (!account) {
      account = createAccount(playerName);
    } else {
      account.name = playerName;
      localStorage.setItem('typefight_account', JSON.stringify(account));
    }
    
    const response = await fetch('/api/rooms', {
      method: 'POST',
    });
    
    const data = await response.json();
    localStorage.setItem('playerId', data.player_id);
    
    router.push(`/room/${data.room_id}`);
  };
  
  const handleJoinRoom = () => {
    if (!playerName.trim() || !joinRoomId.trim()) return;
    
    let account = getAccount();
    if (!account) {
      account = createAccount(playerName);
    } else {
      account.name = playerName;
      localStorage.setItem('typefight_account', JSON.stringify(account));
    }
    
    router.push(`/room/${joinRoomId}`);
  };
  
  return (
    <main className="relative min-h-screen text-white overflow-hidden">
      <img
        src="/images/bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10">
        <header className="flex justify-end items-center p-2">
          <ProfileToggle onClick={() => setShowProfile(true)} />
        </header>

        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="bg-gray-800/80 p-8 rounded-lg shadow-lg w-96">
            <div className="flex flex-col items-center">
              <Image
                src="/images/iconv2.webp"
                alt="Type Fight icon"
                width={140}
                height={140}
                className="rounded-lg"
                priority
              />
              {/* <h1 className="text-xl font-bold">Type Fight</h1> */}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                />
              </div>
              
              <button
                onClick={handleCreateRoom}
                disabled={!playerName.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
              >
                Create Room
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-800 text-gray-400">or join existing</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Room Code</label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter room code"
                />
              </div>
              
              <button
                onClick={handleJoinRoom}
                disabled={!playerName.trim() || !joinRoomId.trim()}
                className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </div>

      <ProfilePanel isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </main>
  );
}
