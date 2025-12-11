import React from 'react';
import { Paper } from '../types';

interface InfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  likedPapers: Paper[];
}

const InfoDrawer: React.FC<InfoDrawerProps> = ({ isOpen, onClose, likedPapers }) => {
  return (
    <div 
      className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="h-full flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Reading List</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {likedPapers.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-4xl mb-4">📚</p>
              <p>No liked papers yet.</p>
              <p className="text-sm">Swipe right to build your list.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {likedPapers.map((p, i) => (
                <a 
                  key={i} 
                  href={`https://arxiv.org/abs/${p.id}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="block p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex justify-between items-start mb-1">
                     <span className="text-xs font-mono text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{p.id}</span>
                     <span className="text-xs text-gray-400">{p.year}</span>
                  </div>
                  <h3 className="font-semibold text-gray-800 leading-snug mb-2">{p.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2">{p.tldr}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfoDrawer;