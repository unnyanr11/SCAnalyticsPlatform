import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../store';

export const ConnectionStatus: React.FC = () => {
  const { isConnected, lastUpdated } = useDashboardStore();

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <AnimatePresence mode="wait">
        <motion.span
          key={isConnected ? 'on' : 'off'}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-500'
          }`}
        />
      </AnimatePresence>
      <span className={isConnected ? 'text-emerald-400' : 'text-red-400'}>
        {isConnected ? 'LIVE' : 'OFFLINE'}
      </span>
      {isConnected && (
        <span className="text-slate-500">Updated {timeStr}</span>
      )}
    </div>
  );
};
