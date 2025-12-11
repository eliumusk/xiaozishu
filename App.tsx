import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Paper, SwipeDirection, RecommendationContext } from './types';
import { fetchRecommendations } from './services/geminiService';
import PaperCard from './components/PaperCard';
import InfoDrawer from './components/InfoDrawer';

const App: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [likedPapers, setLikedPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Refs to avoid dependency cycles and manage pagination
  const fetchingRef = useRef(false);
  const nextStartIndexRef = useRef(0); 
  
  // Prefetch Threshold: When papers drop below this number, fetch more
  const PREFETCH_THRESHOLD = 4;

  const loadMorePapers = useCallback(async (currentLiked: Paper[], isInitialLoad: boolean = false) => {
    // Prevent double fetching
    if (fetchingRef.current) return;
    
    fetchingRef.current = true;
    
    // Only show full screen loading on the very first load
    if (isInitialLoad) {
      setLoading(true);
    }

    const context: RecommendationContext = {
      likedPapers: currentLiked.map(p => p.title),
      dislikedPapers: [], 
      currentFocus: "AI Agents"
    };

    try {
      console.log("Fetching more papers... Start Index:", nextStartIndexRef.current);
      const newPapers = await fetchRecommendations(context, nextStartIndexRef.current);
      
      if (newPapers.length > 0) {
        nextStartIndexRef.current += newPapers.length;

        setPapers(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const currentLikedIds = new Set(currentLiked.map(p => p.id));
          
          // Filter out duplicates
          const uniqueNew = newPapers.filter(p => !existingIds.has(p.id) && !currentLikedIds.has(p.id));
          
          if (uniqueNew.length === 0) {
             console.log("No unique papers found this batch, trying next batch...");
             // If all duplicates, maybe trigger another fetch immediately?
             // For simplicity, we just leave it. The next swipe will trigger check again.
          }
          return [...prev, ...uniqueNew];
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Initial Load
  useEffect(() => {
    loadMorePapers([], true);
  }, [loadMorePapers]);

  // Aggressive Prefetching Effect
  // Whenever `papers` changes (e.g. after a swipe), check if we need more.
  useEffect(() => {
    if (papers.length < PREFETCH_THRESHOLD && !fetchingRef.current && papers.length > 0) {
      console.log(`Buffer low (${papers.length}), prefetching...`);
      loadMorePapers(likedPapers, false);
    }
  }, [papers.length, likedPapers, loadMorePapers]);

  const handleSwipe = (direction: SwipeDirection) => {
    // Get the card being swiped (top of stack)
    const currentPaper = papers[0];
    
    // Optimistic UI: Remove from stack immediately
    const remainingPapers = papers.slice(1);
    setPapers(remainingPapers);

    if (direction === SwipeDirection.RIGHT) {
      setLikedPapers(prev => [...prev, currentPaper]);
    }
    
    // Note: The `useEffect` above will automatically detect the length change and trigger prefetch
  };

  // Manual Trigger for buttons
  const manualSwipe = (direction: SwipeDirection) => {
     if (papers.length > 0) {
        handleSwipe(direction);
     }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center bg-gray-100 overflow-hidden relative">
      
      {/* Header */}
      <header className="w-full max-w-md p-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
            A
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">AgentFlow</h1>
        </div>
        <button 
          onClick={() => setDrawerOpen(true)}
          className="relative p-2 bg-white rounded-full shadow hover:bg-gray-50 transition-colors"
        >
           <span className="sr-only">Saved Papers</span>
           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
           </svg>
           {likedPapers.length > 0 && (
             <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
           )}
        </button>
      </header>

      {/* Main Card Stack */}
      <main className="flex-1 w-full max-w-md relative flex flex-col justify-center items-center py-4 px-4">
        <div className="w-full h-full relative">
          
          {/* Empty State / Loader */}
          {papers.length === 0 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
               {loading ? (
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-blue-200 rounded-full mb-4"></div>
                    <div className="h-4 w-48 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                    <p className="mt-8 text-gray-400 text-sm">
                      Searching ArXiv & Translating...<br/>
                      <span className="text-xs text-gray-300">Getting the latest & most relevant</span>
                    </p>
                  </div>
               ) : (
                 <div className="text-gray-400">
                    <p>No more papers found.</p>
                    <button 
                      onClick={() => loadMorePapers(likedPapers, true)}
                      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                    >
                      Try Reloading
                    </button>
                 </div>
               )}
             </div>
          )}

          {/* Cards (Reverse order so index 0 is on top) */}
          {[...papers].reverse().map((paper, index) => {
            // Is this the top card?
            const isTop = index === papers.length - 1; 
            
            // Performance: Only render the top 2 cards
            if (index < papers.length - 2) return null;

            return (
              <PaperCard 
                key={paper.id} 
                paper={paper} 
                frontCard={isTop}
                onSwipe={handleSwipe}
              />
            );
          })}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="w-full max-w-md p-6 pb-8 flex justify-center gap-6 z-20">
        <button 
          onClick={() => manualSwipe(SwipeDirection.LEFT)}
          disabled={papers.length === 0}
          className="w-14 h-14 rounded-full bg-white shadow-lg border border-red-100 text-red-500 flex items-center justify-center hover:bg-red-50 hover:scale-110 transition-all disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <button 
           onClick={() => manualSwipe(SwipeDirection.RIGHT)}
           disabled={papers.length === 0}
           className="w-14 h-14 rounded-full bg-blue-600 shadow-xl shadow-blue-200 text-white flex items-center justify-center hover:bg-blue-700 hover:scale-110 transition-all disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        </button>
      </footer>

      {/* Side Drawer */}
      <InfoDrawer 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        likedPapers={likedPapers} 
      />

    </div>
  );
};

export default App;