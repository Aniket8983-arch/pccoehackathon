import React from 'react';
import { AlertOctagon, RefreshCw, FileText } from 'lucide-react';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="full-screen-center p-4">
      <div className="card error-card text-center p-8 max-w-lg border border-red-500/30 bg-slate-900/90 shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
          <AlertOctagon className="icon-lg text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Grid Data Failed to Load</h2>
        <p className="text-red-300 text-sm mb-4 bg-red-950/40 p-3 rounded-lg border border-red-900/50 font-mono text-xs text-left overflow-x-auto">
          {error}
        </p>

        <div className="text-slate-400 text-xs mb-6 text-left space-y-2 bg-slate-800/40 p-4 rounded-lg">
          <div className="font-semibold text-slate-300 flex items-center gap-1">
            <FileText className="icon-xs text-amber-400" />
            <span>Troubleshooting steps:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Ensure <code className="text-amber-300">data/processed/grid.json</code> exists in backend outputs.</li>
            <li>Verify <code className="text-amber-300">frontend/public/data/grid.json</code> is accessible.</li>
            <li>Run <code className="text-amber-300">python scripts/07_create_grid.py</code> if grid needs generation.</li>
          </ul>
        </div>

        <button onClick={onRetry} className="btn-primary mx-auto">
          <RefreshCw className="icon-xs" />
          <span>Retry Loading grid.json</span>
        </button>
      </div>
    </div>
  );
};
