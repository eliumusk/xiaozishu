import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Paper, SwipeDirection } from '../types';

interface PaperCardProps {
  paper: Paper;
  onSwipe: (direction: SwipeDirection) => void;
  style?: React.CSSProperties;
  frontCard: boolean;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper, onSwipe, frontCard }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  
  // Visual feedback colors
  const borderColor = useTransform(
    x, 
    [-200, -50, 0, 50, 200], 
    ['rgba(239, 68, 68, 1)', 'rgba(239, 68, 68, 0)', 'rgba(0,0,0,0)', 'rgba(34, 197, 94, 0)', 'rgba(34, 197, 94, 1)']
  );

  const [expanded, setExpanded] = useState(false);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      const direction = info.offset.x > 0 ? SwipeDirection.RIGHT : SwipeDirection.LEFT;
      onSwipe(direction);
    }
  };

  const openPaper = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://arxiv.org/abs/${paper.id}`, '_blank');
  };

  // Generate a distinct color gradient based on paper ID hash just for visual variety
  const bgGradient = () => {
    const hash = paper.id.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const hues = [
      'from-blue-50 to-slate-100',
      'from-emerald-50 to-teal-100',
      'from-purple-50 to-fuchsia-100',
      'from-orange-50 to-amber-100',
    ];
    return hues[hash % hues.length];
  };

  return (
    <motion.div
      style={{ 
        x: frontCard ? x : 0, 
        rotate: frontCard ? rotate : 0,
        opacity: frontCard ? opacity : 1, // Only fade the top card
        scale: frontCard ? 1 : 0.95,
        zIndex: frontCard ? 10 : 0,
      }}
      drag={frontCard ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, opacity: 0, y: 50 }}
      animate={{ scale: frontCard ? 1 : 0.96, opacity: 1, y: frontCard ? 0 : 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`absolute inset-0 w-full h-full max-w-md mx-auto p-4 cursor-grab active:cursor-grabbing touch-none`}
    >
      <motion.div 
        style={{ borderColor: frontCard ? borderColor : 'transparent' }}
        className={`w-full h-full bg-white rounded-3xl shadow-xl border-2 overflow-hidden flex flex-col relative ${!frontCard && 'bg-gray-50'}`}
      >
        {/* Card Header / Image Placeholder */}
        <div className={`h-32 bg-gradient-to-br ${bgGradient()} p-6 flex flex-col justify-end shrink-0`}>
           <div className="flex gap-2 mb-2 flex-wrap">
              {paper.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-wider font-bold bg-white/60 px-2 py-1 rounded-full text-gray-700">
                  {tag}
                </span>
              ))}
           </div>
           <div className="flex justify-between items-end">
              <span className="text-sm font-semibold text-gray-500">{paper.year}</span>
              <span className="text-xs text-gray-400 font-mono">{paper.id}</span>
           </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar" onPointerDownCapture={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-gray-900 leading-tight mb-2">
            {paper.title}
          </h2>
          <p className="text-sm text-gray-600 mb-6 italic">
            {paper.authors.slice(0, 3).join(", ")} {paper.authors.length > 3 && `+${paper.authors.length - 3}`}
          </p>

          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">TL;DR</h3>
            <p className="text-gray-800 font-medium">{paper.tldr}</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                Abstract (中文)
              </h3>
              <p className="text-gray-700 leading-relaxed text-sm text-justify">
                {paper.abstract_zh}
              </p>
            </div>

            <div className={`transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-60'}`}>
              <div 
                className="flex items-center gap-2 cursor-pointer mb-2"
                onClick={() => setExpanded(!expanded)}
              >
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                   <span className="w-1 h-4 bg-gray-300 rounded-full"></span>
                   Abstract (English)
                </h3>
                <span className="text-xs text-blue-500">{expanded ? 'Collapse' : 'Expand'}</span>
              </div>
              
              {expanded && (
                <p className="text-gray-600 leading-relaxed text-sm serif text-justify">
                  {paper.abstract_en}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions */}
        <div className="p-4 bg-white/95 backdrop-blur border-t border-gray-100 flex justify-between items-center shrink-0">
          <button 
            onClick={openPaper}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Read on ArXiv ↗
          </button>
          
          <div className="flex gap-2">
             <div className="text-[10px] text-gray-400 flex flex-col items-end leading-tight">
               <span>Swipe Right</span>
               <span>to Save</span>
             </div>
          </div>
        </div>

        {/* Overlay Labels for Swipe */}
        <motion.div 
            style={{ opacity: useTransform(x, [50, 150], [0, 1]) }}
            className="absolute top-10 left-10 border-4 border-green-500 text-green-500 font-bold text-4xl px-4 py-2 rounded-lg transform -rotate-12 bg-white/80 pointer-events-none"
        >
          LIKE
        </motion.div>
        <motion.div 
            style={{ opacity: useTransform(x, [-150, -50], [1, 0]) }}
            className="absolute top-10 right-10 border-4 border-red-500 text-red-500 font-bold text-4xl px-4 py-2 rounded-lg transform rotate-12 bg-white/80 pointer-events-none"
        >
          NOPE
        </motion.div>

      </motion.div>
    </motion.div>
  );
};

export default PaperCard;