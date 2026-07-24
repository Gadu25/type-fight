'use client';

import { useState } from 'react';

type NamePromptModalProps = {
  onNameSubmitted: (name: string) => void;
};

export default function NamePromptModal({ onNameSubmitted }: NamePromptModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onNameSubmitted(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-2 text-center">Welcome to Type Fight!</h2>
        <p className="text-gray-400 mb-6 text-center">Enter your name to join the room</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-md font-medium transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}
