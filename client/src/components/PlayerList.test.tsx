import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import PlayerList from './PlayerList';

const mockPlayers = [
  { id: 'player1', name: 'Alice' },
  { id: 'player2', name: 'Bob' },
];

describe('PlayerList', () => {
  it('renders player names', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player1"
        gameStatus="lobby"
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows host badge', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player1"
        gameStatus="lobby"
      />
    );
    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('shows Start Game button when host and 2 players', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player1"
        gameStatus="lobby"
      />
    );
    expect(screen.getByText('Start Game')).toBeInTheDocument();
  });

  it('disables Start Game button when room is full', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player1"
        gameStatus="lobby"
        isRoomFull={true}
      />
    );
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeDisabled();
  });

  it('disables Start Game button when not host', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player2"
        gameStatus="lobby"
      />
    );
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeDisabled();
  });

  it('does not show Start Game button when not in lobby', () => {
    render(
      <PlayerList
        players={mockPlayers}
        hostId="player1"
        currentPlayerId="player1"
        gameStatus="playing"
      />
    );
    expect(screen.queryByText('Start Game')).not.toBeInTheDocument();
  });
});
