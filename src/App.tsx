import { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useAgentQueryReset } from './hooks/useQueries';
import LoginScreen from './components/LoginScreen';
import AgentScreen from './components/AgentScreen';
import GameScreen from './components/GameScreen';
import LoadingScreen from './components/LoadingScreen';
import StarField from './components/StarField';
import RateLimitOverlay from './components/RateLimitOverlay';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cached data in memory for a full day
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'st-query-cache',
});

function AppRoutes() {
  const { token, agent, loading, isAccountToken } = useAuth();
  const [inGame, setInGame] = useState(false);
  const prevAgent = useRef(agent);

  // Clear agent-specific query cache when switching agents
  useAgentQueryReset(agent?.symbol);

  // Auto-launch game when a new agent is registered (agent goes from null → set)
  useEffect(() => {
    if (!prevAgent.current && agent) {
      setInGame(true);
    }
    prevAgent.current = agent;
  }, [agent]);

  if (loading) return <LoadingScreen />;
  if (!token) return <LoginScreen />;
  if (isAccountToken) return <AgentScreen onLaunch={() => setInGame(true)} />;
  if (inGame) return <GameScreen onBack={() => setInGame(false)} />;
  return <AgentScreen onLaunch={() => setInGame(true)} />;
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: localStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <AuthProvider>
        <StarField />
        <AppRoutes />
        <RateLimitOverlay />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}