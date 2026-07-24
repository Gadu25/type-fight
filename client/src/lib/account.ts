export type MatchRecord = {
  opponentName: string;
  winner: boolean;
  wpm: number;
  accuracy: number;
  timestamp: number;
};

export type PlayerAccount = {
  id: string;
  name: string;
  matchHistory: MatchRecord[];
};

const STORAGE_KEY = 'typefight_account';

export function getAccount(): PlayerAccount | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as PlayerAccount;
  } catch {
    return null;
  }
}

export function saveAccount(account: PlayerAccount): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}

export function createAccount(name: string): PlayerAccount {
  const account: PlayerAccount = {
    id: crypto.randomUUID(),
    name,
    matchHistory: [],
  };
  saveAccount(account);
  return account;
}

export function updateMatchHistory(match: MatchRecord): void {
  const account = getAccount();
  if (account) {
    account.matchHistory.push(match);
    saveAccount(account);
  }
}
