
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateFunFact, generateLibrary, generateStory, generateImage, promptForKey, generatePredictivePackage } from '../services/gemini';
import { FeedItem, ParentSettings, Book, Story, ImageSize } from '../types';
import { SparklesIcon, BookIcon, XIcon, ShieldIcon } from './Icons';
import { FeedSkeleton } from './SkeletonLoader';
import { useIBLM } from '../context/IBLMContext';
import { motion, AnimatePresence } from 'framer-motion';

const FeedCard = React.memo(({ item, isActive }: { item: FeedItem; isActive: boolean }) => {
    const isHydrating = item.hydrationStatus === 'HYDRATED';
    const isReady = item.hydrationStatus === 'READY';

    return (
        <motion.div 
            initial={{ scale: 0.9, opacity: 0.5 }}
            animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0.5 }}
            className="relative w-full max-w-lg h-full max-h-[75vh] rounded-[3rem] overflow-hidden shadow-2xl bg-slate-900 border-[8px] border-white"
        >
            {isReady || isHydrating ? (
                <img src={item.imageUrl} alt={item.topic} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isReady ? 'opacity-90' : 'opacity-40 blur-lg'}`} />
            ) : (
                <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center"><SparklesIcon className="w-12 h-12 text-slate-700" /></div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
            
            <motion.div className="absolute bottom-0 left-0 right-0 p-8 pb-12">
                <div className="flex items-center gap-2 mb-4">
                    <span className="px-4 py-2 bg-yellow-400 text-black font-black rounded-full text-[10px] tracking-widest uppercase bubbly-text shadow-lg">
                        {item.topic}
                    </span>
                    {isHydrating && !isReady && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 bg-black/40 px-3 py-1.5 rounded-full border border-white/10">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> PREPARING...
                        </div>
                    )}
                </div>
                <h2 className="text-white text-3xl font-black bubbly-text leading-tight mb-2 drop-shadow-xl">{item.title}</h2>
                <p className={`text-white/80 text-xl font-medium leading-snug transition-all duration-500 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    {item.fact}
                </p>
            </motion.div>
        </motion.div>
    );
});

export const Feed: React.FC = () => {
  const { metrics, startInteraction, endInteraction, decideNextContent, contentBuffer, setBuffer } = useIBLM();
  const [activeTab, setActiveTab] = useState<'FACTS' | 'LIBRARY'>('FACTS');
  const [visibleIndex, setVisibleIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<ParentSettings | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('parent_settings');
    const parsed = saved ? JSON.parse(saved) : null;
    setSettings(parsed);
    if (contentBuffer.length === 0) loadInitialTrack(parsed);
  }, []);

  // --- CORE HYDRATION LOGIC (25% Pre-load) ---
  const hydrateItem = async (index: number) => {
    const item = contentBuffer[index];
    if (!item || item.hydrationStatus !== 'EMPTY') return;

    // 25% Ready = Metadata + Thumbnail
    setBuffer(prev => prev.map((it, i) => i === index ? { ...it, hydrationStatus: 'HYDRATED' } : it));
    
    try {
        const img = await generateImage(`${item.title} cute 3d illustration for kids`, ImageSize.S_1K, 'gemini-2.5-flash-image');
        if (img) {
            setBuffer(prev => prev.map((it, i) => i === index ? { ...it, imageUrl: img, hydrationStatus: 'READY' } : it));
        }
    } catch (e) { console.error("Hydration failed", e); }
  };

  useEffect(() => {
    // Keep next 2 items hydrated
    if (contentBuffer.length > 0) {
        hydrateItem(visibleIndex);
        hydrateItem(visibleIndex + 1);
        hydrateItem(visibleIndex + 2);
    }
  }, [visibleIndex, contentBuffer.length]);

  const loadInitialTrack = async (s: ParentSettings | null) => {
    const rec = decideNextContent();
    const pkg = await generatePredictivePackage("Surprise me!", s, rec);
    const initialItems = pkg.map(p => ({
        ...p,
        imageUrl: '',
        hydrationStatus: 'EMPTY' as const
    })) as FeedItem[];
    setBuffer(initialItems);
  };

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
        const { scrollTop, clientHeight } = containerRef.current;
        const newIndex = Math.round(scrollTop / clientHeight);
        if (newIndex !== visibleIndex) {
            endInteraction(true);
            if (contentBuffer[newIndex]) startInteraction(contentBuffer[newIndex].id, 'feed');
            setVisibleIndex(newIndex);
            
            // If we are reaching the end of current track, predict next track
            if (newIndex >= contentBuffer.length - 2) {
                extendTrack();
            }
        }
    }
  }, [visibleIndex, contentBuffer, endInteraction, startInteraction]);

  const extendTrack = async () => {
      const lastItem = contentBuffer[contentBuffer.length - 1];
      const rec = decideNextContent();
      const pkg = await generatePredictivePackage(lastItem?.topic || "Learning", settings, rec);
      const newItems = pkg.map(p => ({
        ...p,
        imageUrl: '',
        hydrationStatus: 'EMPTY' as const
      })) as FeedItem[];
      setBuffer(prev => [...prev, ...newItems]);
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 overflow-hidden">
      <div className="bg-white/95 backdrop-blur-md pt-[env(safe-area-inset-top)] px-4 pb-3 shadow-sm z-30">
          <div className="flex justify-between items-center mb-2 px-2 pt-2">
            <h1 className="text-2xl font-black text-slate-900 bubbly-text">WonderNest</h1>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${metrics.energyLevel === 'HIGH' ? 'bg-orange-500 animate-ping' : 'bg-green-500'}`} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metrics.energyLevel} MODE</span>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-full mt-2">
              <button onClick={() => setActiveTab('FACTS')} className={`flex-1 py-3 rounded-full text-sm font-black transition-all ${activeTab === 'FACTS' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Daily Discovery</button>
              <button onClick={() => setActiveTab('LIBRARY')} className={`flex-1 py-3 rounded-full text-sm font-black transition-all ${activeTab === 'LIBRARY' ? 'bg-white text-yellow-600 shadow-md' : 'text-slate-400'}`}>Magic Library</button>
          </div>
      </div>

      <div className="flex-1 relative w-full overflow-hidden">
        {activeTab === 'FACTS' && (
            <div ref={containerRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth">
                {contentBuffer.length === 0 ? (
                    <div className="h-full flex items-center justify-center"><FeedSkeleton /></div>
                ) : (
                    contentBuffer.map((item, index) => (
                        <div key={item.id} className="h-full w-full p-4 snap-start flex items-center justify-center">
                            <FeedCard item={item} isActive={index === visibleIndex} />
                        </div>
                    ))
                )}
                <div className="h-20" />
            </div>
        )}
      </div>
    </div>
  );
};
