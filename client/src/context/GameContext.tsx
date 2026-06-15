import { createContext, useContext, useState, ReactNode } from 'react';

interface GameContextType {
  username: string;
  setUsername: (u: string) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState(
    () => sessionStorage.getItem('mg_username') ?? ''
  );

  function setUsername(u: string) {
    sessionStorage.setItem('mg_username', u);
    setUsernameState(u);
  }

  return (
    <GameContext.Provider value={{ username, setUsername }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
