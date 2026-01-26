
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateLearnTopics, generateRelatedTopics, generateImage, generateLessonScript, generateSpeech, getWavUrl, promptForKey } from '../services/gemini';
import { LearnVideo, ImageSize, ParentSettings } from '../types';
import { TvIcon, PlayIcon, PauseIcon, SparklesIcon, GlobeIcon, ShieldIcon, CheckIcon } from './Icons';
import { VideoGridSkeleton } from './SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';

type PlayerState = 'IDLE' | 'GENERATING' | 'READY' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR';
type ViewMode = 'AI' | 'DOCS';

interface Documentary {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    searchQuery: string;
    learningGoal: string;
}

const REAL_DOCS: Documentary[] = [
    {
        id: 'd1',
        title: 'March of the Penguins',
        description: 'Follow the amazing journey of emperor penguins in Antarctica.',
        imageUrl: 'https://images.unsplash.com/photo-1598439210625-5067c578f3f6?q=80&w=2072&auto=format&fit=crop',
        searchQuery: 'March of the Penguins documentary for kids',
        learningGoal: 'Animal Life Cycles & Persistence'
    },
    {
        id: 'd2',
        title: 'A Beautiful Planet',
        description: 'Look at our home, Earth, from the International Space Station.',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
        searchQuery: 'A Beautiful Planet IMAX documentary',
        learningGoal: 'Geography & Astronomy'
    },
    {
        id: 'd3',
        title: 'Born to be Wild',
        description: 'Meet the people rescuing orphaned orangutans and elephants.',
        imageUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1932&auto=format&fit=crop',
        searchQuery: 'Born to be Wild IMAX documentary',
        learningGoal: 'Animal Conservation & Empathy'
    }
];

// --- Memoized Components ---
const VideoItem = React.memo(({ video, onClick, isChildFriendly }: { video: LearnVideo, onClick: (v: LearnVideo) => void, isChildFriendly: boolean }) => (
    <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onClick(video)} 
        className="bg-slate-900 rounded-[2rem] overflow-hidden cursor-pointer shadow-lg group border-2 border-slate-800 hover:border-red-500 transition-all"
    >
        <div className="aspect-video bg-slate-800 relative overflow-hidden">
            {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 animate-pulse"><SparklesIcon className="w-8 h-8 opacity-50" /></div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl transform scale-0 group-hover:scale-100 transition-transform"><PlayIcon className="w-5 h-5 text-black ml-1" /></div>
            </div>
        </div>
        <div className="p-5">
            <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.1em] mb-1 block bubbly-text">{video.category}</span>
            <h3 className={`font-black leading-tight mb-2 text-slate-100 bubbly-text ${isChildFriendly ? 'text-xl' : 'text-lg'}`}>{video.title}</h3>
        </div>
    </motion.div>
));

export const LearnTV: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('AI');
  const [videos, setVideos] = useState<LearnVideo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active Video State
  const [activeVideo, setActiveVideo] = useState<LearnVideo | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('IDLE');
  const [generationStep, setGenerationStep] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  // Audio Playback State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [needsKey, setNeedsKey] = useState(false);
  
  // Recommendations & Pre-fetching State
  const [showRecs, setShowRecs] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<LearnVideo[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const prefetchQueue = useRef<Set<string>>(new Set());

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const [settings, setSettings] = useState<ParentSettings | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('parent_settings');
    if (saved) setSettings(JSON.parse(saved));

    let mounted = true;
    const initFeed = async () => {
      setLoading(true);
      const settingsObj: ParentSettings | undefined = saved ? JSON.parse(saved) : undefined;

      try {
        const topics = await generateLearnTopics(settingsObj);
        if (mounted) setVideos(topics);
        
        // Background pre-fetch thumbnails for initial list
        topics.forEach(async (topic) => {
            if (!mounted) return;
            try {
                const img = await generateImage(`${topic.title} - cute 3d render for kids`, ImageSize.S_1K, 'gemini-2.5-flash-image');
                if (img && mounted) {
                    setVideos(prev => prev.map(v => v.id === topic.id ? { ...v, thumbnailUrl: img } : v));
                }
            } catch (e) {}
        });
      } catch (e) { console.error("Failed to init TV", e); }
      if (mounted) setLoading(false);
    };
    initFeed();
    return () => { mounted = false; if (audioUrl) URL.revokeObjectURL(audioUrl); }
  }, []);

  // --- PRE-FETCHING LOGIC ---
  useEffect(() => {
    // When a video starts playing, pre-fetch images for related videos
    if (playerState === 'PLAYING' && relatedVideos.length > 0) {
        relatedVideos.forEach(async (video) => {
            if (prefetchQueue.current.has(video.id) || video.thumbnailUrl) return;
            prefetchQueue.current.add(video.id);
            try {
                const img = await generateImage(`${video.title} - bright kids 3d illustration`, ImageSize.S_1K, 'gemini-2.5-flash-image');
                if (img) {
                    setRelatedVideos(prev => prev.map(v => v.id === video.id ? { ...v, thumbnailUrl: img } : v));
                }
            } catch (e) { prefetchQueue.current.delete(video.id); }
        });
    }
  }, [playerState, relatedVideos]);

  useEffect(() => {
    if (activeVideo?.slideImages && activeVideo.slideImages.length > 0 && duration > 0) {
        const slideDuration = duration / activeVideo.slideImages.length;
        const newIndex = Math.min(Math.floor(currentTime / slideDuration), activeVideo.slideImages.length - 1);
        if (newIndex !== currentSlideIndex) setCurrentSlideIndex(newIndex);
    }
  }, [currentTime, duration, activeVideo]);

  const handleStartGeneration = useCallback(async (video: LearnVideo) => {
    setActiveVideo(video);
    setPlayerState('GENERATING');
    setShowRecs(false);
    setRelatedVideos([]);
    setCurrentTime(0);
    setDuration(0);
    setCurrentSlideIndex(0);
    setNeedsKey(false);
    
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }

    try {
        setGenerationStep('Thinking of a story...');
        const { script, visualPrompts } = await generateLessonScript(video.title);
        
        setGenerationStep('Drawing the scenes...');
        const imagePromises = visualPrompts.map(prompt => 
            generateImage(prompt, ImageSize.S_1K, 'gemini-3-pro-image-preview')
                .then(img => img || generateImage(prompt, ImageSize.S_1K, 'gemini-2.5-flash-image'))
        );
        const generatedImages = (await Promise.all(imagePromises)).filter(img => img !== null) as string[];
        if (generatedImages.length === 0 && video.thumbnailUrl) generatedImages.push(video.thumbnailUrl);

        setActiveVideo(prev => prev ? { ...prev, slideImages: generatedImages } : null);
        setGenerationStep('Recording voiceover...');
        const audioPcm = await generateSpeech(script);

        setGenerationStep('Ready!');
        const url = getWavUrl(audioPcm);
        setAudioUrl(url);
        setPlayerState('READY');
        setGenerationStep('');
        
        // Start loading related topics in background while user is READY
        loadRecommendations(video.title);
    } catch (e: any) {
        if (e.toString().includes('403') || e.toString().includes('permission')) { setNeedsKey(true); setPlayerState('ERROR'); } 
        else { alert("Something went wrong."); closePlayer(); }
    }
  }, [audioUrl]);

  const connectAccount = async () => { await promptForKey(); if (activeVideo) handleStartGeneration(activeVideo); };

  const handlePlayFromReady = () => { if (audioRef.current) audioRef.current.play().then(() => setPlayerState('PLAYING')); else setPlayerState('PLAYING'); };

  const handleVideoEnd = async () => { setPlayerState('ENDED'); setShowRecs(true); };

  const loadRecommendations = async (currentTopic: string) => {
      setLoadingRecs(true);
      try {
          const recs = await generateRelatedTopics(currentTopic);
          setRelatedVideos(recs);
          setLoadingRecs(false);
      } catch (e) { setLoadingRecs(false); }
  };

  const closePlayer = () => { setActiveVideo(null); setPlayerState('IDLE'); setShowRecs(false); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); } };

  const togglePlay = () => { if (audioRef.current) { if (playerState === 'PLAYING') { audioRef.current.pause(); setPlayerState('PAUSED'); } else { audioRef.current.play(); setPlayerState('PLAYING'); } } };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => { const time = parseFloat(e.target.value); if (audioRef.current) { audioRef.current.currentTime = time; setCurrentTime(time); } };

  const handleDocClick = useCallback((doc: Documentary) => {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(doc.searchQuery)}&tbm=vid`, '_blank');
  }, []);

  const isYoungChild = settings ? settings.childAge <= 4 : false;

  return (
    <div className="h-full bg-slate-950 text-white flex flex-col relative overflow-hidden font-sans">
      {/* Dynamic Font Header */}
      <div className="p-4 bg-slate-900 shadow-xl flex items-center justify-between z-10 border-b border-slate-800">
        <div className="flex items-center gap-3">
             <div className="p-2 bg-red-600 rounded-2xl shadow-lg shadow-red-500/20"><TvIcon className="w-6 h-6 text-white" /></div>
             <h1 className={`font-black tracking-tight flex items-center gap-2 bubbly-text ${isYoungChild ? 'text-2xl' : 'text-xl'}`}>WonderTV <span className="text-[10px] font-black text-slate-950 bg-yellow-400 px-2 py-0.5 rounded-full shadow-sm">KIDS</span></h1>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-full">
            <button onClick={() => setViewMode('AI')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'AI' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>AI Magic</button>
            <button onClick={() => setViewMode('DOCS')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'DOCS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><GlobeIcon className="w-3 h-3"/> Real Docs</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24 no-scrollbar">
        {viewMode === 'AI' && (
            <>
                {loading && videos.length === 0 ? (
                   <VideoGridSkeleton />
                ) : (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                        {videos.length > 0 && (
                            <motion.div 
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleStartGeneration(videos[0])} 
                                className="relative h-72 md:h-96 w-full rounded-[2.5rem] overflow-hidden shadow-2xl cursor-pointer group ring-4 ring-transparent hover:ring-red-500 transition-all border-4 border-slate-900"
                            >
                                {videos[0].thumbnailUrl ? (
                                    <img src={videos[0].thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center"><SparklesIcon className="w-12 h-12 opacity-20" /></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                                <div className="absolute bottom-0 left-0 p-8 w-full">
                                    <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full mb-3 inline-block shadow-lg bubbly-text tracking-widest">NEXT EPISODE</span>
                                    <h2 className={`font-black mb-2 leading-tight drop-shadow-xl bubbly-text ${isYoungChild ? 'text-4xl' : 'text-3xl'}`}>{videos[0].title}</h2>
                                    <p className="text-slate-200 line-clamp-2 opacity-90 text-lg font-medium max-w-xl">{videos[0].description}</p>
                                    <div className="mt-6 flex items-center gap-3 text-lg font-black text-white bg-white/10 w-fit px-6 py-2 rounded-full backdrop-blur-md border border-white/20"><PlayIcon className="w-5 h-5 fill-current" /><span>Watch Now!</span></div>
                                </div>
                            </motion.div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {videos.slice(1).map((video) => (
                                <VideoItem key={video.id} video={video} onClick={handleStartGeneration} isChildFriendly={isYoungChild} />
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}

        {viewMode === 'DOCS' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-right-4 max-w-5xl mx-auto">
                 <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 shadow-2xl">
                     <div className="p-5 bg-blue-500 rounded-3xl shadow-lg shadow-blue-500/40"><GlobeIcon className="w-10 h-10 text-white"/></div>
                     <div className="text-center md:text-left">
                         <h2 className="text-2xl font-black text-white bubbly-text mb-1">Explorer Theater</h2>
                         <p className="text-blue-200/80 text-lg font-medium leading-snug">We found some amazing real-world movies just for you!</p>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {REAL_DOCS.map((doc) => (
                         <motion.div 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            key={doc.id}
                            onClick={() => handleDocClick(doc)}
                            className="bg-slate-900 rounded-[2.5rem] overflow-hidden cursor-pointer shadow-xl border-2 border-slate-800 hover:border-blue-500 group flex flex-col"
                         >
                            <div className="aspect-video relative overflow-hidden">
                                <img src={doc.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={doc.title} />
                                <div className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg bubbly-text tracking-widest">REAL MOVIE</div>
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 transition-transform border-4 border-white/50 shadow-2xl">
                                        <PlayIcon className="w-8 h-8 text-white ml-1" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 flex-1 flex flex-col">
                                <h3 className="text-2xl font-black text-white bubbly-text mb-2">{doc.title}</h3>
                                <p className="text-slate-400 text-lg font-medium mb-6 leading-relaxed flex-1">{doc.description}</p>
                                
                                <div className="mt-auto pt-6 border-t border-slate-800 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-blue-400 bg-blue-400/10 w-fit px-4 py-1 rounded-full">
                                        <ShieldIcon className="w-4 h-4" /> Learning: {doc.learningGoal}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-black text-green-400 uppercase tracking-widest">
                                        <CheckIcon className="w-4 h-4" /> Parent Verified Safe Content
                                    </div>
                                </div>
                            </div>
                         </motion.div>
                     ))}
                 </div>
             </div>
        )}
      </div>

      <AnimatePresence>
      {activeVideo && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
          >
              {audioUrl && (
                  <audio ref={audioRef} src={audioUrl} onTimeUpdate={() => { if(audioRef.current) setCurrentTime(audioRef.current.currentTime); }} onLoadedMetadata={() => { if(audioRef.current) setDuration(audioRef.current.duration); }} onEnded={handleVideoEnd} />
              )}
              
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
                  <button onClick={closePlayer} className="text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-colors border border-white/10">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>

              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden group">
                  <div className="absolute inset-0 transition-opacity duration-1000">
                        {activeVideo.slideImages && activeVideo.slideImages.length > 0 ? (
                             <img key={currentSlideIndex} src={activeVideo.slideImages[currentSlideIndex]} className="w-full h-full object-cover animate-in fade-in duration-1000" alt="Slide" />
                        ) : (
                             activeVideo.thumbnailUrl && <img src={activeVideo.thumbnailUrl} className="w-full h-full object-cover opacity-50 blur-sm" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>
                  </div>

                  {playerState === 'ERROR' && needsKey && (
                      <div className="z-30 p-10 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 max-w-sm text-center shadow-2xl">
                          <div className="w-16 h-16 bg-red-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg"><ShieldIcon className="w-10 h-10 text-white"/></div>
                          <h3 className="text-2xl font-black mb-3 bubbly-text">Unlock Magic ✨</h3>
                          <p className="text-slate-400 mb-8 text-lg font-medium">Ask a parent to connect their account to watch AI movies.</p>
                          <button onClick={connectAccount} className="w-full py-5 bg-red-600 hover:bg-red-700 rounded-2xl font-black text-xl text-white mb-4 shadow-xl active:scale-95 transition-all">Connect Now</button>
                          <button onClick={closePlayer} className="text-slate-500 font-black hover:text-white uppercase tracking-widest text-xs">Back to TV</button>
                      </div>
                  )}

                  {playerState === 'GENERATING' && (
                      <div className="text-center z-10 p-8 max-w-md">
                          <div className="relative w-32 h-32 mx-auto mb-8">
                               <div className="absolute inset-0 border-[6px] border-red-600/20 rounded-full"></div>
                               <div className="absolute inset-0 border-[6px] border-red-600 border-t-transparent rounded-full animate-spin"></div>
                               <div className="absolute inset-0 flex items-center justify-center"><TvIcon className="w-12 h-12 text-red-500"/></div>
                          </div>
                          <h2 className="font-black text-3xl text-white mb-3 bubbly-text">{activeVideo.title}</h2>
                          <div className="bg-white/10 backdrop-blur-md rounded-2xl py-3 px-6 border border-white/20">
                               <p className="text-white font-black animate-pulse uppercase tracking-[0.2em] text-[10px]">{generationStep}</p>
                          </div>
                      </div>
                  )}

                  {playerState === 'READY' && (
                      <div className="z-10 flex flex-col items-center">
                           <motion.button 
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 12 }}
                                whileTap={{ scale: 0.9 }}
                                whileHover={{ scale: 1.1 }}
                                onClick={handlePlayFromReady} 
                                className="w-32 h-32 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(220,38,38,0.5)] border-4 border-white"
                            >
                               <PlayIcon className="w-12 h-12 ml-2" />
                           </motion.button>
                           <h2 className="mt-8 text-3xl font-black text-white bubbly-text drop-shadow-lg">Let's Watch!</h2>
                      </div>
                  )}

                  {(playerState === 'PLAYING' || playerState === 'PAUSED') && !showRecs && (
                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 opacity-100 md:opacity-0 group-hover:opacity-100 z-30">
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-black text-white/60 tracking-widest">
                                        {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                                    </span>
                                    <div className="flex-1 relative h-2 group/slider">
                                        <input 
                                            type="range" 
                                            min={0} 
                                            max={duration || 100} 
                                            value={currentTime} 
                                            onChange={handleSeek} 
                                            className="absolute inset-0 w-full h-full bg-slate-800 rounded-full appearance-none cursor-pointer accent-red-600 z-10" 
                                        />
                                        <div className="absolute left-0 top-0 h-full bg-red-600 rounded-full pointer-events-none" style={{ width: `${(currentTime/duration)*100}%` }}></div>
                                    </div>
                                    <span className="text-xs font-black text-white/60 tracking-widest">
                                        {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-center">
                                    <button onClick={togglePlay} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl">
                                        {playerState === 'PLAYING' ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7 ml-1" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                   )}

                  {showRecs && (
                      <div className="relative z-40 w-full h-full p-8 flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-500 bg-black/90 backdrop-blur-xl">
                          <h3 className="text-3xl font-black mb-10 text-white bubbly-text">What's Next?</h3>
                          <div className="w-full max-w-5xl overflow-x-auto no-scrollbar pb-8 px-4 flex gap-8">
                                {loadingRecs ? (
                                    <div className="w-full h-48 flex flex-col items-center justify-center gap-4">
                                        <SparklesIcon className="w-12 h-12 animate-spin text-red-500" />
                                        <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Finding more movies...</p>
                                    </div>
                                ) : (
                                    relatedVideos.map((video) => (
                                        <motion.div 
                                            whileTap={{ scale: 0.95 }}
                                            key={video.id} 
                                            onClick={() => handleStartGeneration(video)} 
                                            className="flex-shrink-0 w-72 bg-slate-900 rounded-[2.5rem] overflow-hidden cursor-pointer border-2 border-slate-800 hover:border-red-500 transition-all shadow-2xl"
                                        >
                                            <div className="aspect-video bg-slate-950 relative">
                                                {video.thumbnailUrl && <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
                                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50">
                                                        <PlayIcon className="w-6 h-6 text-white ml-1" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <h4 className="font-black text-white text-xl bubbly-text line-clamp-2 leading-tight">{video.title}</h4>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                          </div>
                          <button onClick={closePlayer} className="mt-8 px-10 py-4 bg-white/10 hover:bg-white/20 rounded-full font-black text-white transition-all border border-white/20 uppercase tracking-[0.2em] text-xs">Back to TV</button>
                      </div>
                  )}
              </div>
          </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};
