import React from 'react';
import { Loader2, Database } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = "Loading 11,550 real raster cells from grid.json..." }) => {
  return (
    <div className="full-screen-center">
      <div className="card loading-card text-center p-8 max-w-md">
        <div className="relative inline-block mb-4">
          <Database className="icon-xl text-emerald-400 opacity-60" />
          <Loader2 className="icon-xl text-sky-400 animate-spin absolute inset-0 m-auto" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Development Viewer</h2>
        <p className="text-slate-300 text-sm mb-4">{message}</p>
        <div className="progress-bar-container">
          <div className="progress-bar-indeterminate"></div>
        </div>
      </div>
    </div>
  );
};
