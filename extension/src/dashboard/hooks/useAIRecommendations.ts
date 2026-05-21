import { useEffect } from 'react';
import { useDashboardStore } from '../store';
import { MOCK_RECOMMENDATIONS } from '../mockData';

export function useAIRecommendations(refreshMs = 30000) {
  const { setRecommendations } = useDashboardStore();

  useEffect(() => {
    setRecommendations(MOCK_RECOMMENDATIONS);
    const timer = setInterval(() => {
      setRecommendations([...MOCK_RECOMMENDATIONS].sort(() => Math.random() - 0.5));
    }, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);
}
