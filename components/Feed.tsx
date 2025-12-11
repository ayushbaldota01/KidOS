
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateFunFact, generateLibrary, generateStory, generateImage, promptForKey } from '../services/gemini';
import { FeedItem, ParentSettings, Book, Story, ImageSize } from '../types';
import { SparklesIcon, BookIcon, XIcon } from './Icons';
import { FeedSkeleton } from './SkeletonLoader';
import { useIBLM } from '../context/IBLMContext';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_TOPICS = ['Dinosaurs', 'Space', 'Ocean', 'Insects', 'Robots', 'Castles', 'Jungle'];
const HIGH_ENERGY_TOPICS = ['Volcanoes', 'Race Cars', 'Rockets', 'Sharks', 'Lightning'];
const CALM_TOPICS = ['Clouds', 'Flowers', 'Butterflies', 'Forests', 'Pandas'];

// --- MEMOIZED CARD COMPONENT ---
const FeedCard = React.memo(({ item, isActive }: { item: FeedItem; isActive: boolean }) => {
    return (
        <motion.div 
            initial={{ scale: 0.9, opacity: 0.5, rotateX: 10 }}
            animate={isActive ? { scale: 1, opacity: 1, rotateX: 0 } : { scale: 0.9, opacity: 0.5, rotateX: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative w-full max-w-lg h-full max-h-[75vh] rounded-[2rem] overflow-hidden shadow-2xl bg-black transform"
        >
            <img 
            src={item.imageUrl} 
            alt={item.topic} 
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            {/* Gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
            
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={isActive ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
                transition={{ delay: 0.2 }}
                className="absolute bottom-0 left-0 right-0 p-8 pb-12 flex flex-col items-start gap-4"
            >
                <div className="flex justify-between items-center w-full">
                    <span className="px-4 py-2 bg-yellow-400 text-black font-black rounded-full text-sm shadow-lg tracking-wide uppercase">
                        {item.topic}
                    </span>
                </div>
                <p className="text-white text-3xl md:text-4xl font-black font-sans leading-tight shadow-black drop-shadow-md">
                    {item.fact}
                </p>
            </motion.div>
        </motion.div>
    );
});

export const Feed: React.FC = () => {
  const { startInteraction, endInteraction, decideNextContent } = useIBLM();
  const [activeTab, setActiveTab] = useState<'FACTS' | 'LIBRARY'>('FACTS');
  
  // Facts State
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(true);
  
  // Virtualization State
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  // Library State
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  
  // Reader State
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  
  // Page -1 is Cover, 0+ are story pages
  const [currentPage, setCurrentPage] = useState(-1);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [settings, setSettings] = useState<ParentSettings | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('parent_settings');
    const parsed = JSON.parse(saved || 'null');
    setSettings(parsed);
    loadFeed(parsed);
    loadLibrary(parsed);
  }, []);

  // --- VIRTUALIZATION & IBLM TRACKING LOGIC ---
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
        const { scrollTop, clientHeight } = containerRef.current;
        const newIndex = Math.round(scrollTop / clientHeight);
        if (newIndex !== visibleIndex) {
            // IBLM: End interaction for old card, Start for new
            if (items[visibleIndex]) {
                endInteraction(true);
            }
            if (items[newIndex]) {
                startInteraction(items[newIndex].id, 'feed-card');
            }
            setVisibleIndex(newIndex);
        }
    }
  }, [visibleIndex, items, endInteraction, startInteraction]);

  useEffect(() => {
    if (items.length > 0 && visibleIndex === 0) {
        startInteraction(items[0].id, 'feed-card');
    }
  }, [items.length]);

  useEffect(() => {
    const nextItem = items[visibleIndex + 1];
    if (nextItem && nextItem.imageUrl) {
        const img = new Image();
        img.src = nextItem.imageUrl;
    }
  }, [visibleIndex, items]);

  // --- Facts Logic ---
  const loadFeed = useCallback(async (currentSettings: ParentSettings | null) => {
    setLoadingFacts(true);
    const recommendation = decideNextContent();
    
    let topicPool = DEFAULT_TOPICS;
    if (recommendation.topicCategory === 'HIGH_ENERGY') {
        topicPool = HIGH_ENERGY_TOPICS;
    } else if (recommendation.topicCategory === 'CALM') {
        topicPool = CALM_TOPICS;
    } else if (currentSettings && currentSettings.focusTopics.length > 0) {
        topicPool = [...DEFAULT_TOPICS, ...currentSettings.focusTopics, ...currentSettings.focusTopics];
    }
    
    const promises = Array(3).fill(null).map(async (_, i) => {
        const topic = topicPool[Math.floor(Math.random() * topicPool.length)];
        const id = Date.now() + i + Math.random();
        const imageUrl = `https://picsum.photos/400/600?random=${id}`; 
        const fact = await generateFunFact(topic, currentSettings || undefined, {
            difficulty: recommendation.difficulty,
            category: recommendation.topicCategory
        });
        return { id: id.toString(), title: topic, fact: fact, imageUrl, topic };
    });

    const newItems = await Promise.all(promises);
    setItems(prev => [...prev, ...newItems]);
    setLoadingFacts(false);
  }, [decideNextContent]);

  // --- Library Logic ---
  const loadLibrary = async (currentSettings: ParentSettings | null) => {
      setLoadingLibrary(true);
      try {
          const library = await generateLibrary(currentSettings || undefined);
          setBooks(library);
      } catch (e) { console.error("Library error", e); }
      setLoadingLibrary(false);
  }

  const openBook = useCallback(async (book: Book) => {
      setActiveBook(book);
      setStoryLoading(true);
      setCurrentStory(null);
      setCurrentPage(-1);
      setPageImages({});
      setCoverImage(null);
      
      try {
          const story = await generateStory(book.title);
          setCurrentStory(story);
          generateImage(story.coverPrompt || `${book.title} book cover cute`, ImageSize.S_1K, 'gemini-2.5-flash-image')
            .then(img => setCoverImage(img))
            .catch(e => console.warn("Cover gen failed", e));
          if (story.pages.length > 0 && story.pages[0].imagePrompt) {
              generatePageImage(0, story.pages[0].imagePrompt);
          }
      } catch (e: any) {
          if (e.toString().includes('403') || e.toString().includes('permission')) {
              if (window.confirm("To read this magical story, please connect your account.")) await promptForKey();
          } else { alert("Could not open book. Try another one!"); }
          setActiveBook(null);
      }
      setStoryLoading(false);
  }, []);

  const generatePageImage = async (pageIndex: number, prompt: string) => {
      if (pageImages[pageIndex]) return;
      try {
          const img = await generateImage(prompt, ImageSize.S_1K, 'gemini-2.5-flash-image');
          if (img) setPageImages(prev => ({ ...prev, [pageIndex]: img }));
      } catch (e) { console.warn("Image gen failed", e); }
  }

  const handleNextPage = useCallback(() => {
      if (!currentStory) return;
      if (currentPage < currentStory.pages.length - 1) {
          const next = currentPage + 1;
          setCurrentPage(next);
          if (currentStory.pages[next]?.imagePrompt) generatePageImage(next, currentStory.pages[next].imagePrompt!);
      } else { setActiveBook(null); }
  }, [currentPage, currentStory, pageImages]);

  const handlePrevPage = () => { if (currentPage > -1) setCurrentPage(currentPage - 1); }

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 overflow-hidden font-sans">
      {/* Top Tab Switcher */}
      <div className="bg-white/90 backdrop-blur-md pt-[env(safe-area-inset-top)] px-4 pb-3 shadow-sm z-30 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-black text-slate-800">WonderNest</h1>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-full relative">
              <button 
                onClick={() => setActiveTab('FACTS')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm md:text-base font-bold transition-all duration-300 relative z-10 touch-manipulation ${activeTab === 'FACTS' ? 'bg-white text-blue-600 shadow-md scale-100' : 'text-slate-500 scale-95'}`}
              >
                  <SparklesIcon className="w-5 h-5" /> Daily Facts
              </button>
              <button 
                onClick={() => setActiveTab('LIBRARY')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm md:text-base font-bold transition-all duration-300 relative z-10 touch-manipulation ${activeTab === 'LIBRARY' ? 'bg-white text-yellow-600 shadow-md scale-100' : 'text-slate-500 scale-95'}`}
              >
                  <BookIcon className="w-5 h-5" /> Library
              </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full overflow-hidden">
        
        {activeTab === 'FACTS' && (
            <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="h-full w-full overflow-y-auto snap-y snap-mandatory scroll-smooth pb-4"
            >
                {items.map((item, index) => {
                    const isVisible = index === visibleIndex;
                    // Render slightly more than just visible to allow scrolling preview
                    const shouldRender = Math.abs(index - visibleIndex) <= 1;

                    return (
                        <div key={item.id} className="h-full w-full p-4 snap-start snap-always flex items-center justify-center">
                            {shouldRender ? (
                                <FeedCard item={item} isActive={isVisible} />
                            ) : (
                                <div className="w-full max-w-lg h-full max-h-[75vh]" />
                            )}
                        </div>
                    );
                })}
                
                <div className="h-[40vh] w-full p-4 snap-start flex items-center justify-center">
                    {loadingFacts ? (
                        <FeedSkeleton />
                    ) : (
                        <motion.button 
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.05 }}
                            onClick={() => loadFeed(settings)}
                            className="w-full max-w-xs py-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3"
                        >
                            <SparklesIcon className="w-6 h-6" />
                            Load More Facts!
                        </motion.button>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'LIBRARY' && (
            <div className="h-full overflow-y-auto p-4 md:p-6 pb-20">
                <div className="mb-6 px-2">
                    <h2 className="text-3xl font-black text-slate-800 mb-2 font-serif">Reading Time! 📚</h2>
                    <p className="text-slate-500 font-bold text-lg">Pick a book to start a magical adventure.</p>
                </div>
                
                {loadingLibrary && books.length === 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[1,2,3,4].map(i => <div key={i} className="aspect-[3/4] bg-slate-200 rounded-3xl animate-pulse"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-12">
                        {books.map((book) => (
                            <motion.button 
                                whileTap={{ scale: 0.95 }}
                                whileHover={{ scale: 1.02 }}
                                key={book.id} 
                                onClick={() => openBook(book)}
                                className={`aspect-[3/4] rounded-3xl p-5 flex flex-col justify-between shadow-lg ${book.color} text-white relative overflow-hidden group text-left`}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="text-6xl mb-auto drop-shadow-sm group-hover:scale-110 transition-transform duration-300">{book.emoji}</div>
                                    <div>
                                        <h3 className="font-black text-xl leading-tight mb-2 shadow-black drop-shadow-md font-serif line-clamp-2">{book.title}</h3>
                                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/25 backdrop-blur-md rounded-full text-xs font-bold">
                                            <span>Read Now</span> <BookIcon className="w-3 h-3" />
                                        </div>
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      <AnimatePresence>
      {activeBook && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] bg-[#2d1b0e] flex flex-col pt-[env(safe-area-inset-top)]"
          >
              <button 
                onClick={() => setActiveBook(null)} 
                className="absolute top-4 right-4 z-[110] w-14 h-14 bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md active:scale-90 transition-transform"
              >
                  <XIcon className="w-8 h-8 stroke-2" />
              </button>

              <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-20 pointer-events-none"></div>

                  <div className="relative w-full h-full max-h-[85vh] max-w-5xl bg-[#fdfbf7] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row overflow-hidden">
                      {storyLoading && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#fdfbf7] p-8 text-center">
                              <div className="text-8xl animate-bounce mb-8">{activeBook.emoji}</div>
                              <h2 className="text-3xl font-serif font-bold text-slate-800 mb-4">Creating your story...</h2>
                              <div className="w-64 h-4 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-500 animate-progress"></div>
                              </div>
                          </div>
                      )}

                      {!storyLoading && currentStory && (
                          <>
                            {currentPage === -1 ? (
                                 <div className="w-full h-full flex flex-col relative bg-orange-900">
                                      <div className="flex-1 relative overflow-hidden">
                                          {coverImage ? (
                                              <img src={coverImage} className="w-full h-full object-cover opacity-90" alt="Cover" />
                                          ) : (
                                              <div className="w-full h-full bg-orange-800 flex items-center justify-center text-white/20"><SparklesIcon className="w-32 h-32" /></div>
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                          <div className="absolute bottom-0 left-0 right-0 p-8 pb-32 md:pb-12 text-white">
                                              <h1 className="text-5xl font-serif font-black leading-tight mb-4 drop-shadow-lg text-yellow-100">{currentStory.title}</h1>
                                              <p className="text-xl italic opacity-90 text-orange-100">A magical story for you</p>
                                          </div>
                                      </div>
                                      
                                      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent flex justify-center pb-[env(safe-area-inset-bottom)]">
                                           <motion.button 
                                              whileTap={{ scale: 0.9 }}
                                              onClick={handleNextPage}
                                              className="w-full max-w-md py-5 bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-2xl rounded-full shadow-[0_10px_30px_rgba(234,88,12,0.4)] flex items-center justify-center gap-3"
                                           >
                                               <BookIcon className="w-8 h-8" /> Open Book
                                           </motion.button>
                                      </div>
                                 </div>
                            ) : (
                                <div className="w-full h-full flex flex-col md:flex-row bg-[#fdfbf7] relative">
                                    <div className="flex-[1.2] relative bg-slate-100 overflow-hidden md:rounded-l-3xl border-b md:border-b-0 md:border-r border-slate-200/50">
                                         {currentStory.pages[currentPage].imagePrompt ? (
                                             pageImages[currentPage] ? (
                                                <motion.img 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    src={pageImages[currentPage]} 
                                                    className="w-full h-full object-cover" 
                                                    alt="Scene" 
                                                />
                                             ) : (
                                                 <div className="w-full h-full flex flex-col items-center justify-center bg-orange-50 text-orange-300 gap-4">
                                                     <SparklesIcon className="w-12 h-12 animate-spin" />
                                                     <p className="text-sm font-bold uppercase tracking-widest opacity-50">Painting...</p>
                                                 </div>
                                             )
                                         ) : (
                                             <div className="w-full h-full flex items-center justify-center bg-[#fdfbf7]"><div className="text-8xl opacity-10">{activeBook.emoji}</div></div>
                                         )}
                                    </div>

                                    <div className="flex-1 flex flex-col bg-[#fdfbf7] md:rounded-r-3xl relative">
                                         <div className="flex-1 p-6 md:p-10 overflow-y-auto flex flex-col justify-center">
                                             <p className="text-2xl md:text-3xl font-serif text-slate-800 leading-loose drop-shadow-sm text-center md:text-left">
                                                 {currentStory.pages[currentPage].text}
                                             </p>
                                         </div>

                                         <div className="p-4 px-6 bg-white border-t border-slate-100 flex items-center justify-between pb-[calc(1rem+env(safe-area-inset-bottom))]">
                                              <motion.button 
                                                whileTap={{ scale: 0.9 }}
                                                onClick={handlePrevPage}
                                                className="w-14 h-14 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-400"
                                              >
                                                  <span className="text-2xl font-bold">←</span>
                                              </motion.button>
                                              
                                              <span className="text-slate-300 font-serif italic font-bold">
                                                  {currentPage + 1} / {currentStory.pages.length}
                                              </span>

                                              <motion.button 
                                                whileTap={{ scale: 0.95 }}
                                                onClick={handleNextPage}
                                                className="h-14 px-8 bg-yellow-400 text-black font-black text-lg rounded-full shadow-[0_4px_0_rgba(0,0,0,1)] border-2 border-black flex items-center gap-2"
                                              >
                                                  {currentPage === currentStory.pages.length - 1 ? 'Finish!' : 'Next'} 
                                                  <span className="text-xl">→</span>
                                              </motion.button>
                                         </div>
                                    </div>
                                </div>
                            )}
                          </>
                      )}
                  </div>
              </div>
          </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};
