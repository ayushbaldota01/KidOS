
import React, { useState, useEffect } from 'react';
import { generateFunFact, generateLibrary, generateStory, generateImage, promptForKey } from '../services/gemini';
import { FeedItem, ParentSettings, Book, Story, ImageSize } from '../types';
import { SparklesIcon, BookIcon, XIcon, PlayIcon } from './Icons';

const DEFAULT_TOPICS = ['Dinosaurs', 'Space', 'Ocean', 'Insects', 'Robots', 'Castles', 'Jungle'];

export const Feed: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FACTS' | 'LIBRARY'>('FACTS');
  
  // Facts State
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(true);
  
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

  // --- Facts Logic ---
  const loadFeed = async (currentSettings: ParentSettings | null) => {
    setLoadingFacts(true);
    const newItems: FeedItem[] = [];
    
    let topicPool = DEFAULT_TOPICS;
    if (currentSettings && currentSettings.focusTopics.length > 0) {
        topicPool = [...DEFAULT_TOPICS, ...currentSettings.focusTopics, ...currentSettings.focusTopics];
    }
    
    for (let i = 0; i < 3; i++) {
      const topic = topicPool[Math.floor(Math.random() * topicPool.length)];
      const id = Date.now() + i;
      const imageUrl = `https://picsum.photos/400/600?random=${id}`; // Fallback random image
      
      const fact = await generateFunFact(topic, currentSettings || undefined);
      
      newItems.push({
        id: id.toString(),
        title: topic,
        fact: fact,
        imageUrl,
        topic
      });
    }
    setItems(prev => [...prev, ...newItems]);
    setLoadingFacts(false);
  };

  // --- Library Logic ---
  const loadLibrary = async (currentSettings: ParentSettings | null) => {
      setLoadingLibrary(true);
      try {
          const library = await generateLibrary(currentSettings || undefined);
          setBooks(library);
      } catch (e) {
          console.error("Library error", e);
      }
      setLoadingLibrary(false);
  }

  const openBook = async (book: Book) => {
      setActiveBook(book);
      setStoryLoading(true);
      setCurrentStory(null);
      setCurrentPage(-1); // Start at cover
      setPageImages({});
      setCoverImage(null);
      
      try {
          const story = await generateStory(book.title);
          setCurrentStory(story);
          
          // Generate Cover Image using Nano Banana (Flash Image)
          generateImage(story.coverPrompt || `${book.title} book cover cute`, ImageSize.S_1K, 'gemini-2.5-flash-image')
            .then(img => setCoverImage(img))
            .catch(e => console.warn("Cover gen failed", e));
            
          // Pre-generate Page 0 image if needed
          if (story.pages.length > 0 && story.pages[0].imagePrompt) {
              generatePageImage(0, story.pages[0].imagePrompt);
          }
      } catch (e: any) {
          if (e.toString().includes('403') || e.toString().includes('permission')) {
              if (window.confirm("To read this magical story, please connect your account.")) {
                  await promptForKey();
              }
          } else {
            alert("Could not open book. Try another one!");
          }
          setActiveBook(null);
      }
      setStoryLoading(false);
  }

  const generatePageImage = async (pageIndex: number, prompt: string) => {
      if (pageImages[pageIndex]) return; // Already exists
      try {
          const img = await generateImage(prompt, ImageSize.S_1K, 'gemini-2.5-flash-image');
          if (img) {
              setPageImages(prev => ({ ...prev, [pageIndex]: img }));
          }
      } catch (e) { console.warn("Image gen failed", e); }
  }

  const handleNextPage = () => {
      if (!currentStory) return;
      if (currentPage < currentStory.pages.length - 1) {
          const next = currentPage + 1;
          setCurrentPage(next);
          // Trigger image gen for next page if needed
          if (currentStory.pages[next]?.imagePrompt) {
              generatePageImage(next, currentStory.pages[next].imagePrompt!);
          }
      } else {
          // Close book at end
          setActiveBook(null);
      }
  }

  const handlePrevPage = () => {
      if (currentPage > -1) setCurrentPage(currentPage - 1);
  }

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* Tab Switcher */}
      <div className="bg-white p-2 shadow-sm z-10 flex gap-2 justify-center shrink-0">
          <button 
            onClick={() => setActiveTab('FACTS')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'FACTS' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
          >
              <SparklesIcon className="w-5 h-5" /> Daily Facts
          </button>
          <button 
            onClick={() => setActiveTab('LIBRARY')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'LIBRARY' ? 'bg-yellow-400 text-black shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
          >
              <BookIcon className="w-5 h-5" /> Library
          </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 relative bg-slate-50">
        
        {activeTab === 'FACTS' && (
            <div className="snap-y snap-mandatory h-full overflow-y-auto">
                {items.map((item) => (
                    <div key={item.id} className="h-full w-full p-4 snap-start flex items-center justify-center">
                    <div className="relative w-full max-w-md h-[90%] rounded-3xl overflow-hidden shadow-2xl bg-black">
                        <img 
                        src={item.imageUrl} 
                        alt={item.topic} 
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                        <span className="inline-block px-3 py-1 bg-yellow-400 text-black font-bold rounded-full text-xs mb-3">
                            {item.topic}
                        </span>
                        <p className="text-white text-3xl font-black font-sans leading-tight shadow-black drop-shadow-md">
                            {item.fact}
                        </p>
                        </div>
                    </div>
                    </div>
                ))}
                
                <div className="h-40 flex items-center justify-center snap-start">
                    {loadingFacts ? (
                        <div className="animate-bounce flex flex-col items-center gap-2 text-blue-500">
                            <SparklesIcon className="w-8 h-8" />
                            <span className="font-bold">Loading tailored content...</span>
                        </div>
                    ) : (
                        <button 
                            onClick={() => loadFeed(settings)}
                            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-bold shadow-lg transform transition active:scale-95"
                        >
                            Load More Facts!
                        </button>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'LIBRARY' && (
            <div className="p-4 md:p-6">
                <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-800 mb-2 font-serif">Reading Time! 📚</h2>
                    <p className="text-slate-500">Pick a book to start a magical adventure.</p>
                </div>
                
                {loadingLibrary && books.length === 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1,2,3,4].map(i => <div key={i} className="aspect-[3/4] bg-slate-200 rounded-2xl animate-pulse"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                        {books.map((book) => (
                            <div 
                                key={book.id} 
                                onClick={() => openBook(book)}
                                className={`aspect-[3/4] rounded-2xl p-4 flex flex-col justify-between shadow-lg cursor-pointer transform hover:scale-[1.02] transition-all ${book.color} text-white relative overflow-hidden group`}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-12 -mt-12 blur-xl"></div>
                                
                                <div className="relative z-10">
                                    <div className="text-5xl mb-4 drop-shadow-sm transform group-hover:scale-110 transition-transform">{book.emoji}</div>
                                    <h3 className="font-black text-xl md:text-2xl leading-tight mb-2 shadow-black drop-shadow-md font-serif">{book.title}</h3>
                                    <p className="text-xs font-bold opacity-90 line-clamp-2">{book.description}</p>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full flex items-center gap-1 font-bold text-xs">
                                        <span>Read</span> <BookIcon className="w-3 h-3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* --- IMMERSIVE BOOK READER --- */}
      {activeBook && (
          <div className="fixed inset-0 z-[100] bg-[#2d1b0e] flex items-center justify-center p-0 md:p-8 overflow-hidden">
              {/* Background Wood Texture/Table */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-20 pointer-events-none"></div>

              {/* Close Button */}
              <button 
                onClick={() => setActiveBook(null)} 
                className="absolute top-4 right-4 z-50 w-12 h-12 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-md"
              >
                  <XIcon className="w-6 h-6" />
              </button>

              <div className="relative w-full h-[100dvh] md:h-[85vh] md:aspect-[1.5/1] max-w-6xl md:rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex transition-all duration-500 perspective-1000 bg-[#fdfbf7] overflow-hidden">
                  
                  {/* --- LOADING STATE --- */}
                  {storyLoading && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#fdfbf7] text-center p-8">
                          <div className="text-8xl animate-bounce mb-8">{activeBook.emoji}</div>
                          <h2 className="text-3xl font-serif font-bold text-slate-800 mb-2">Printing "{activeBook.title}"...</h2>
                          <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden mt-4">
                              <div className="h-full bg-orange-400 animate-progress"></div>
                          </div>
                      </div>
                  )}

                  {/* --- BOOK CONTENT --- */}
                  {!storyLoading && currentStory && (
                      <>
                        {/* Cover View */}
                        {currentPage === -1 ? (
                             <div className="w-full h-full flex flex-col md:flex-row bg-orange-900 relative">
                                  {/* Front Cover Art */}
                                  <div className="flex-1 relative overflow-hidden">
                                      {coverImage ? (
                                          <img src={coverImage} className="w-full h-full object-cover opacity-90" alt="Cover" />
                                      ) : (
                                          <div className="w-full h-full bg-orange-800 flex items-center justify-center text-white/20"><SparklesIcon className="w-32 h-32" /></div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                      <div className="absolute bottom-12 left-8 right-8 text-white">
                                          <h1 className="text-5xl md:text-6xl font-serif font-black leading-tight mb-4 drop-shadow-lg text-yellow-100">{currentStory.title}</h1>
                                          <p className="text-lg italic opacity-90 text-orange-100">A magical story for you</p>
                                      </div>
                                  </div>
                                  
                                  {/* Cover Actions */}
                                  <div className="h-24 md:h-full md:w-80 bg-[#fdfbf7] md:border-l-4 md:border-orange-950/20 flex md:flex-col items-center justify-between md:justify-center p-6 shrink-0 z-10 shadow-2xl">
                                       <div className="hidden md:block text-center mb-8">
                                           <div className="text-6xl mb-4">{activeBook.emoji}</div>
                                           <p className="font-serif text-slate-500 italic">WonderFeed Library</p>
                                       </div>
                                       <button 
                                          onClick={handleNextPage}
                                          className="w-full md:w-auto px-12 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full shadow-lg text-xl flex items-center justify-center gap-3 transition-transform hover:scale-105"
                                       >
                                           <BookIcon className="w-6 h-6" /> Open Book
                                       </button>
                                  </div>
                             </div>
                        ) : (
                            // --- OPEN BOOK VIEW ---
                            <div className="w-full h-full flex flex-col md:flex-row bg-[#fdfbf7] relative">
                                
                                {/* Center Spine (Desktop Only) */}
                                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-8 -ml-4 z-20 bg-gradient-to-r from-black/5 via-black/10 to-black/5 rounded-sm pointer-events-none"></div>

                                {/* LEFT PAGE: Visuals */}
                                <div className="flex-1 h-[45%] md:h-full relative overflow-hidden bg-slate-100 md:rounded-l-[20px] md:border-r border-slate-200">
                                     {currentStory.pages[currentPage].imagePrompt ? (
                                         <div className="w-full h-full relative group">
                                             {pageImages[currentPage] ? (
                                                <img src={pageImages[currentPage]} className="w-full h-full object-cover" alt="Illustration" />
                                             ) : (
                                                 <div className="w-full h-full flex flex-col items-center justify-center bg-orange-50 text-orange-300 gap-4">
                                                     <SparklesIcon className="w-16 h-16 animate-spin" />
                                                     <p className="text-sm font-bold uppercase tracking-widest opacity-50">Painting Scene...</p>
                                                 </div>
                                             )}
                                             {/* Paper Texture Overlay */}
                                             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/canvas-orange.png')] opacity-10 mix-blend-multiply pointer-events-none"></div>
                                             {/* Inner Shadow */}
                                             <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] pointer-events-none"></div>
                                         </div>
                                     ) : (
                                         <div className="w-full h-full flex items-center justify-center bg-[#fdfbf7] p-8">
                                             <div className="text-9xl opacity-5">{activeBook.emoji}</div>
                                         </div>
                                     )}
                                </div>

                                {/* RIGHT PAGE: Text */}
                                <div className="flex-1 h-[55%] md:h-full flex flex-col relative md:rounded-r-[20px] bg-[#fdfbf7]">
                                     {/* Paper Texture */}
                                     <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] opacity-40 pointer-events-none"></div>
                                     
                                     {/* Content */}
                                     <div className="flex-1 p-8 md:p-12 lg:p-16 overflow-y-auto flex flex-col justify-center text-center md:text-left">
                                         <p className="text-2xl md:text-3xl lg:text-4xl font-serif text-slate-800 leading-relaxed drop-shadow-sm whitespace-pre-wrap">
                                             {currentStory.pages[currentPage].text}
                                         </p>
                                     </div>

                                     {/* Page Number */}
                                     <div className="absolute bottom-6 left-0 right-0 text-center text-slate-400 font-serif italic text-sm">
                                         Page {currentPage + 1}
                                     </div>

                                     {/* Navigation Controls */}
                                     <div className="h-20 shrink-0 flex items-center justify-between px-6 md:px-12 z-10 relative">
                                          <button 
                                            onClick={handlePrevPage}
                                            className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:border-slate-800 transition-all hover:bg-slate-100"
                                          >
                                              <span className="text-xl">←</span>
                                          </button>
                                          
                                          <button 
                                            onClick={handleNextPage}
                                            className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all border-2 border-black flex items-center gap-2"
                                          >
                                              {currentPage === currentStory.pages.length - 1 ? 'Finish' : 'Next Page'} <span className="text-xl">→</span>
                                          </button>
                                     </div>
                                </div>
                            </div>
                        )}
                      </>
                  )}
              </div>
          </div>
      )}

    </div>
  );
};
