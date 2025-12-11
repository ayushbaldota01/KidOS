
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateLearnTopics, generateRelatedTopics, generateImage, generateLessonScript, generateSpeech, getWavUrl, promptForKey } from '../services/gemini';
import { LearnVideo, ImageSize, ParentSettings } from '../types';
import { TvIcon, PlayIcon, PauseIcon, SparklesIcon, GlobeIcon } from './Icons';
import { VideoGridSkeleton } from './SkeletonLoader';
import { motion } from 'framer-motion';

type PlayerState = 'IDLE' | 'GENERATING' | 'READY' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR';
type ViewMode = 'AI' | 'DOCS';

interface Documentary {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    searchQuery: string;
}

const REAL_DOCS: Documentary[] = [
    {
        id: 'd1',
        title: 'March of the Penguins',
        description: 'Follow the amazing journey of emperor penguins in Antarctica.',
        imageUrl: 'https://images.unsplash.com/photo-1598439210625-5067c578f3f6?q=80&w=2072&auto=format&fit=crop',
        searchQuery: 'March of the Penguins documentary for kids'
    },
    {
        id: 'd2',
        title: 'A Beautiful Planet',
        description: 'Look at our home, Earth, from the International Space Station.',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
        searchQuery: 'A Beautiful Planet IMAX documentary'
    },
    {
        id: 'd3',
        title: 'Born to be Wild',
        description: 'Meet the people rescuing orphaned orangutans and elephants.',
        imageUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1932&auto=format&fit=crop',
        searchQuery: 'Born to be Wild IMAX documentary'
    },
    {
        id: 'd4',
        title: 'Oceans',
        description: 'Dive deep into the blue and meet the creatures of the sea.',
        imageUrl: 'https://images.unsplash.com/photo-1582967788606-a171f1080ca8?q=80&w=2070&auto=format&fit=crop',
        searchQuery: 'DisneyNature Oceans documentary'
    },
    {
        id: 'd5',
        title: 'Tiny Giants',
        description: 'A day in the life of the smallest animals in the world.',
        imageUrl: 'https://images.unsplash.com/photo-1452573992436-6d508f200830?q=80&w=2062&auto=format&fit=crop',
        searchQuery: 'Tiny Giants BBC Earth'
    },
    {
        id: 'd6',
        title: 'Elephant Family',
        description: 'Watch baby elephants learn and play with their families.',
        imageUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1932&auto=format&fit=crop',
        searchQuery: 'Elephant family documentary for kids'
    }
];

// --- Memoized Components ---
const VideoItem = React.memo(({ video, onClick }: { video: LearnVideo, onClick: (v: LearnVideo) => void }) => (
    <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onClick(video)} 
        className="bg-slate-900 rounded-2xl overflow-hidden cursor-pointer shadow-lg group border border-slate-800"
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
        <div className="p-4">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 block">{video.category}</span>
            <h3 className="text-lg font-bold leading-tight mb-2 text-slate-100">{video.title}</h3>
        </div>
    </motion.div>
));

const DocItem = React.memo(({ doc, onClick }: { doc: Documentary, onClick: (d: Documentary) => void }) => (
    <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClick(doc)} 
        className="bg-slate-900 rounded-2xl overflow-hidden cursor-pointer shadow-lg group border border-slate-800"
    >
        <div className="aspect-[16/10] bg-slate-800 relative">
            <img src={doc.imageUrl} className="w-full h-full object-cover" alt={doc.title} />
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-md">REAL DOC</div>
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform border-2 border-white/50">
                    <PlayIcon className="w-6 h-6 text-white ml-1" />
                </div>
            </div>
        </div>
        <div className="p-5">
            <h3 className="text-xl font-bold text-white mb-2">{doc.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{doc.description}</p>
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
  
  // Recommendations State
  const [showRecs, setShowRecs] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<LearnVideo[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let mounted = true;
    const initFeed = async () => {
      setLoading(true);
      const savedSettings = localStorage.getItem('parent_settings');
      const settings: ParentSettings | undefined = savedSettings ? JSON.parse(savedSettings) : undefined;

      try {
        const topics = await generateLearnTopics(settings);
        if (mounted) setVideos(topics);
        
        for (let i = 0; i < topics.length; i++) {
           if (!mounted) break;
           try {
               const img = await generateImage(`${topics[i].title} - cute 3d render`, ImageSize.S_1K, 'gemini-2.5-flash-image');
               if (img && mounted) {
                   setVideos(prev => prev.map(v => v.id === topics[i].id ? { ...v, thumbnailUrl: img } : v));
               }
           } catch (e) {}
        }
      } catch (e) { console.error("Failed to init TV", e); }
      if (mounted) setLoading(false);
    };
    initFeed();
    return () => { mounted = false; if (audioUrl) URL.revokeObjectURL(audioUrl); }
  }, []);

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
    } catch (e: any) {
        if (e.toString().includes('403') || e.toString().includes('permission')) { setNeedsKey(true); setPlayerState('ERROR'); } 
        else { alert("Something went wrong."); closePlayer(); }
    }
  }, [audioUrl]);

  const connectAccount = async () => { await promptForKey(); if (activeVideo) handleStartGeneration(activeVideo); };

  const handlePlayFromReady = () => { if (audioRef.current) audioRef.current.play().then(() => setPlayerState('PLAYING')); else setPlayerState('PLAYING'); };

  const handleVideoEnd = async () => { setPlayerState('ENDED'); setShowRecs(true); if (activeVideo) loadRecommendations(activeVideo.title); };

  const loadRecommendations = async (currentTopic: string) => {
      setLoadingRecs(true);
      try {
          const recs = await generateRelatedTopics(currentTopic);
          setRelatedVideos(recs);
          setLoadingRecs(false);
          for (let i = 0; i < recs.length; i++) {
            if (!showRecs) break; 
            try {
                const img = await generateImage(`${recs[i].title} - cute 3d render`, ImageSize.S_1K, 'gemini-2.5-flash-image');
                if (img) setRelatedVideos(prev => prev.map(v => v.id === recs[i].id ? { ...v, thumbnailUrl: img } : v));
            } catch (e) {}
         }
      } catch (e) { setLoadingRecs(false); }
  };

  const closePlayer = () => { setActiveVideo(null); setPlayerState('IDLE'); setShowRecs(false); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); } };

  const togglePlay = () => { if (audioRef.current) { if (playerState === 'PLAYING') { audioRef.current.pause(); setPlayerState('PAUSED'); } else { audioRef.current.play(); setPlayerState('PLAYING'); } } };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => { const time = parseFloat(e.target.value); if (audioRef.current) { audioRef.current.currentTime = time; setCurrentTime(time); } };

  const handleDocClick = useCallback((doc: Documentary) => {
      // Open safe search for documentary
      window.open(`https://www.google.com/search?q=${encodeURIComponent(doc.searchQuery)}&tbm=vid`, '_blank');
  }, []);

  return (
    <div className="h-full bg-slate-950 text-white flex flex-col relative overflow-hidden font-sans">
      <div className="p-4 bg-slate-900 shadow-xl flex items-center justify-between z-10 border-b border-slate-800">
        <div className="flex items-center gap-3">
             <div className="p-2 bg-red-600 rounded-lg"><TvIcon className="w-6 h-6 text-white" /></div>
             <h1 className="text-xl font-black tracking-tight flex items-center gap-2">WonderTV <span className="text-[10px] font-bold text-slate-950 bg-yellow-400 px-2 py-0.5 rounded-full">KIDS</span></h1>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-full">
            <button onClick={() => setViewMode('AI')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'AI' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>AI Magic</button>
            <button onClick={() => setViewMode('DOCS')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'DOCS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><GlobeIcon className="w-3 h-3"/> Real Docs</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {viewMode === 'AI' && (
            <>
                {loading && videos.length === 0 ? (
                   <VideoGridSkeleton />
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        {videos.length > 0 && (
                            <motion.div 
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleStartGeneration(videos[0])} 
                                className="relative h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-2xl cursor-pointer group ring-4 ring-transparent hover:ring-red-500 transition-all"
                            >
                                {videos[0].thumbnailUrl ? (
                                    <img src={videos[0].thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center"><SparklesIcon className="w-12 h-12 opacity-20" /></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                                <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
                                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block shadow-sm">FEATURED</span>
                                    <h2 className="text-3xl md:text-4xl font-black mb-2 leading-tight drop-shadow-lg">{videos[0].title}</h2>
                                    <p className="text-slate-200 line-clamp-1 opacity-90">{videos[0].description}</p>
                                    <div className="mt-4 flex items-center gap-2 text-sm font-bold text-white/80"><PlayIcon className="w-5 h-5 fill-current" /><span>Tap to Watch</span></div>
                                </div>
                            </motion.div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {videos.slice(1).map((video) => (
                                <VideoItem key={video.id} video={video} onClick={handleStartGeneration} />
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}

        {viewMode === 'DOCS' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                 <div className="bg-blue-900/30 border border-blue-500/30 p-6 rounded-2xl flex items-center gap-4">
                     <div className="p-3 bg-blue-500 rounded-full"><GlobeIcon className="w-6 h-6 text-white"/></div>
                     <div>
                         <h2 className="text-xl font-bold text-blue-100">Real World Explorers</h2>
                         <p className="text-blue-200/60 text-sm">Hand-picked, safe documentaries about our amazing planet.</p>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {REAL_DOCS.map((doc) => (
                         <DocItem key={doc.id} doc={doc} onClick={handleDocClick} />
                     ))}
                 </div>
             </div>
        )}
      </div>

      {/* Video Player Modal (Reuse logic from previous step, only show for AI videos) */}
      {activeVideo && (
          <div className="absolute inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom duration-500">
              {audioUrl && (
                  <audio ref={audioRef} src={audioUrl} onTimeUpdate={() => { if(audioRef.current) setCurrentTime(audioRef.current.currentTime); }} onLoadedMetadata={() => { if(audioRef.current) setDuration(audioRef.current.duration); }} onEnded={handleVideoEnd} />
              )}
              
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
                  <button onClick={closePlayer} className="text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-colors">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>

              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden group">
                  <div className="absolute inset-0 transition-opacity duration-1000">
                        {activeVideo.slideImages && activeVideo.slideImages.length > 0 ? (
                             <img key={currentSlideIndex} src={activeVideo.slideImages[currentSlideIndex]} className="w-full h-full object-cover animate-in fade-in duration-1000" alt="Slide" />
                        ) : (
                             activeVideo.thumbnailUrl && <img src={activeVideo.thumbnailUrl} className="w-full h-full object-cover opacity-50 blur-sm" />
                        )}
                        <div className="absolute inset-0 bg-black/30"></div>
                  </div>

                  {playerState === 'ERROR' && needsKey && (
                      <div className="z-30 p-8 bg-slate-900 rounded-2xl border border-slate-700 max-w-sm text-center shadow-2xl">
                          <h3 className="text-xl font-bold mb-2">Unlock Magic ✨</h3>
                          <p className="text-slate-400 mb-6">Connect your Google Cloud account to generate magic videos.</p>
                          <button onClick={connectAccount} className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white mb-3">Connect Account</button>
                          <button onClick={closePlayer} className="text-slate-500 text-sm hover:text-white">Cancel</button>
                      </div>
                  )}

                  {playerState === 'GENERATING' && (
                      <div className="text-center z-10 p-8">
                          <div className="w-20 h-20 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                          <h2 className="font-bold text-2xl text-white mb-2">{activeVideo.title}</h2>
                          <p className="text-slate-400 animate-pulse">{generationStep}</p>
                      </div>
                  )}

                  {playerState === 'READY' && (
                      <div className="z-10 flex flex-col items-center animate-bounce-in">
                           <motion.button 
                                whileTap={{ scale: 0.9 }}
                                whileHover={{ scale: 1.1 }}
                                onClick={handlePlayFromReady} 
                                className="w-24 h-24 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.6)]"
                            >
                               <PlayIcon className="w-10 h-10 ml-2" />
                           </motion.button>
                           <h2 className="mt-6 text-2xl font-black text-white">Tap to Watch!</h2>
                      </div>
                  )}

                  {(playerState === 'PLAYING' || playerState === 'PAUSED') && !showRecs && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 opacity-100 md:opacity-0 group-hover:opacity-100 z-30">
                            <div className="max-w-3xl mx-auto space-y-4">
                                <div className="flex items-center gap-3 text-xs font-bold font-mono text-slate-400">
                                    <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                                    <input type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek} className="flex-1 h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer accent-red-600 hover:accent-red-500" />
                                    <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <button onClick={togglePlay} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                                        {playerState === 'PLAYING' ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-1" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                   )}

                  {showRecs && (
                      <div className="relative z-40 w-full h-full p-8 flex flex-col items-center justify-center overflow-y-auto animate-in fade-in duration-500 bg-black/90 backdrop-blur-md">
                          <h3 className="text-2xl font-bold mb-8 text-white">More Like This</h3>
                          {loadingRecs ? (
                              <div className="flex flex-col items-center gap-2"><SparklesIcon className="w-8 h-8 animate-spin text-blue-400" /><p className="text-sm text-slate-300">Finding cool videos...</p></div>
                          ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                                  {relatedVideos.map((video) => (
                                      <motion.div 
                                        whileTap={{ scale: 0.95 }}
                                        key={video.id} 
                                        onClick={() => handleStartGeneration(video)} 
                                        className="bg-slate-800/80 backdrop-blur-md rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-700 transition-all border border-slate-700"
                                      >
                                          <div className="aspect-video bg-slate-900 relative">
                                              {video.thumbnailUrl && <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />}
                                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40"><PlayIcon className="w-10 h-10 text-white" /></div>
                                          </div>
                                          <div className="p-4"><h4 className="font-bold text-white leading-snug mb-1">{video.title}</h4></div>
                                      </motion.div>
                                  ))}
                              </div>
                          )}
                          <button onClick={closePlayer} className="mt-12 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold text-white transition-colors">Back to Home</button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
