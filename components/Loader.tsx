import React from 'react';

interface LoaderProps {
  message: string;
  progress?: number;
  onCancel?: () => void;
}

const Loader: React.FC<LoaderProps> = ({ message, progress, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white">
      <div className="w-64 text-center">
        <div className="mb-4 text-lg font-semibold text-cyan-300" style={{textShadow: '0 0 5px rgba(0, 220, 255, 0.5)'}}>{message}</div>
        <div className="w-full bg-cyan-900/50 rounded-full h-2.5 overflow-hidden border border-cyan-700/50">
          {progress !== undefined ? (
            <div 
              className="bg-cyan-400 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: `${progress}%`, boxShadow: '0 0 8px rgba(0, 220, 255, 0.7)' }}
            ></div>
          ) : (
             <div className="h-2.5 rounded-full bg-cyan-400 animate-pulse" style={{boxShadow: '0 0 8px rgba(0, 220, 255, 0.7)'}}></div>
          )}
        </div>
        {progress !== undefined && (
          <div className="text-center mt-2 text-sm text-cyan-400">{progress}%</div>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 px-4 py-2 text-sm font-semibold text-gray-300 bg-black/50 hover:bg-cyan-900/50 border border-cyan-700 rounded-lg transition-colors"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
};

export default Loader;