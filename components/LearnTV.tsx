
import React, { useState, useEffect, useRef } from 'react';
import { generateLearnTopics, generateRelatedTopics, generateImage, generateLessonScript, generateSpeech, getWavUrl, promptForKey, hasApiKey } from '../services/gemini';
import { LearnVideo, ImageSize, ParentSettings } from '../types';
import { TvIcon, PlayIcon, PauseIcon, SparklesIcon, VolumeIcon, VolumeXIcon } from './Icons';

type PlayerState = 'IDLE' | 'GENERATING' | 'READY' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR';

export const LearnTV: React.FC = () => {
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
      
      // Load Settings
      const savedSettings = localStorage.getItem('parent_settings');
      const settings: ParentSettings | undefined = savedSettings ? JSON.parse(savedSettings) : undefined;

      try {
        const topics = await generateLearnTopics(settings);
        if (mounted) setVideos(topics);
        
        // Load one thumbnail at a time
        for (let i = 0; i < topics.length; i++) {
           if (!mounted) break;
           try {
               // Use Flash Image for thumbnails (faster/cheaper)
               const img = await generateImage(`${topics[i].title} - cute 3d render`, ImageSize.S_1K, 'gemini-2.5-flash-image');
               if (img && mounted) {
                   setVideos(prev => prev.map(v => v.id === topics[i].id ? { ...v, thumbnailUrl: img } : v));
               }
           } catch (e) {
               console.warn(`Thumb failed for ${topics[i].title}`, e);
           }
        }
      } catch (e) {
          console.error("Failed to init TV", e);
      }
      if (mounted) setLoading(false);
    };
    initFeed();
    return () => { mounted = false; if (audioUrl) URL.revokeObjectURL(audioUrl); }
  }, []);

  // Update slide based on progress
  useEffect(() => {
    if (activeVideo?.slideImages && activeVideo.slideImages.length > 0 && duration > 0) {
        const slideDuration = duration / activeVideo.slideImages.length;
        const newIndex = Math.min(
            Math.floor(currentTime / slideDuration), 
            activeVideo.slideImages.length - 1
        );
        if (newIndex !== currentSlideIndex) {
            setCurrentSlideIndex(newIndex);
        }
    }
  }, [currentTime, duration, activeVideo]);

  const handleStartGeneration = async (video: LearnVideo) => {
    setActiveVideo(video);
    setPlayerState('GENERATING');
    setShowRecs(false);
    setRelatedVideos([]);
    setCurrentTime(0);
    setDuration(0);
    setCurrentSlideIndex(0);
    setNeedsKey(false);
    
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    }

    try {
        setGenerationStep('Thinking of a story...');
        
        // 1. Generate Script & Visual Prompts
        const { script, visualPrompts } = await generateLessonScript(video.title);
        
        setGenerationStep('Drawing the scenes (this takes a moment)...');
        
        // 2. Generate Slideshow Images (Parallel)
        const imagePromises = visualPrompts.map(prompt => 
            generateImage(prompt, ImageSize.S_1K, 'gemini-3-pro-image-preview')
                .then(img => img || generateImage(prompt, ImageSize.S_1K, 'gemini-2.5-flash-image')) // Fallback
        );
        
        const generatedImages = (await Promise.all(imagePromises)).filter(img => img !== null) as string[];
        
        // Use existing thumbnail as backup if generation fails completely
        if (generatedImages.length === 0 && video.thumbnailUrl) {
            generatedImages.push(video.thumbnailUrl);
        }

        // Update video object with slides
        setActiveVideo(prev => prev ? { ...prev, slideImages: generatedImages } : null);

        setGenerationStep('Recording voiceover...');
        // 3. Generate Audio
        const audioPcm = await generateSpeech(script);

        setGenerationStep('Ready!');
        // 4. Create Audio URL
        const url = getWavUrl(audioPcm);
        setAudioUrl(url);
        
        setPlayerState('READY');
        setGenerationStep('');

    } catch (e: any) {
        console.error("Playback failed", e);
        if (e.toString().includes('403') || e.toString().includes('permission')) {
             setNeedsKey(true);
             setPlayerState('ERROR');
        } else {
             alert("Something went wrong. Trying again usually helps!");
             closePlayer();
        }
    }
  };

  const connectAccount = async () => {
      await promptForKey();
      // Retry the current video
      if (activeVideo) handleStartGeneration(activeVideo);
  };

  const handlePlayFromReady = () => {
      if (audioRef.current) {
          audioRef.current.play()
            .then(() => setPlayerState('PLAYING'))
            .catch(e => console.error("Play failed", e));
      } else {
          setPlayerState('PLAYING');
      }
  };

  const handleVideoEnd = async () => {
      setPlayerState('ENDED');
      setShowRecs(true);
      if (activeVideo) {
          await loadRecommendations(activeVideo.title);
      }
  };

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
                if (img) {
                    setRelatedVideos(prev => prev.map(v => v.id === recs[i].id ? { ...v, thumbnailUrl: img } : v));
                }
            } catch (e) {}
         }
      } catch (e) {
          setLoadingRecs(false);
      }
  };

  const closePlayer = () => {
      setActiveVideo(null);
      setPlayerState('IDLE');
      setShowRecs(false);
      if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
      }
  };

  const togglePlay = () => {
      if (audioRef.current) {
          if (playerState === 'PLAYING') {
              audioRef.current.pause();
              setPlayerState('PAUSED');
          } else {
              audioRef.current.play();
              setPlayerState('PLAYING');
          }
      }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
      }
  };

  return (
    <div className="h-full bg-slate-950 text-white flex flex-col relative overflow-hidden font-sans">
      <div className="p-4 bg-slate-900 shadow-xl flex items-center gap-3 z-10 border-b border-slate-800">
        <div className="p-2 bg-red-600 rounded-lg"><TvIcon className="w-6 h-6 text-white" /></div>
        <h1 className="text-xl font-black tracking-tight flex items-center gap-2">WonderTV <span className="text-[10px] font-bold text-slate-950 bg-yellow-400 px-2 py-0.5 rounded-full">KIDS</span></h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {loading && videos.length === 0 ? (
            <div className="h-64 flex items-center justify-center flex-col gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-700 rounded-full animate-spin"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-400 font-bold animate-pulse">Curating shows for you...</p>
            </div>
        ) : (
            <div className="space-y-8">
                {videos.length > 0 && (
                     <div onClick={() => handleStartGeneration(videos[0])} className="relative h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-2xl cursor-pointer group ring-4 ring-transparent hover:ring-red-500 transition-all">
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
                     </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.slice(1).map((video) => (
                        <div key={video.id} onClick={() => handleStartGeneration(video)} className="bg-slate-900 rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-800 transition-colors shadow-lg group border border-slate-800">
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
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

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
                        {/* Slideshow Image Logic */}
                        {activeVideo.slideImages && activeVideo.slideImages.length > 0 ? (
                             <img 
                                key={currentSlideIndex} // Force re-render for transition
                                src={activeVideo.slideImages[currentSlideIndex]} 
                                className="w-full h-full object-cover animate-in fade-in duration-1000"
                                alt="Slide"
                             />
                        ) : (
                             activeVideo.thumbnailUrl && <img src={activeVideo.thumbnailUrl} className="w-full h-full object-cover opacity-50 blur-sm" />
                        )}
                        <div className="absolute inset-0 bg-black/30"></div>
                  </div>

                  {playerState === 'ERROR' && needsKey && (
                      <div className="z-30 p-8 bg-slate-900 rounded-2xl border border-slate-700 max-w-sm text-center shadow-2xl">
                          <h3 className="text-xl font-bold mb-2">Unlock Magic ✨</h3>
                          <p className="text-slate-400 mb-6">To generate high quality videos and stories, we need to connect a Google Cloud account.</p>
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
                           <button onClick={handlePlayFromReady} className="w-24 h-24 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.6)] transition-all hover:scale-110">
                               <PlayIcon className="w-10 h-10 ml-2" />
                           </button>
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
                                      <div key={video.id} onClick={() => handleStartGeneration(video)} className="bg-slate-800/80 backdrop-blur-md rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-700 transition-all hover:scale-105 border border-slate-700">
                                          <div className="aspect-video bg-slate-900 relative">
                                              {video.thumbnailUrl && <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />}
                                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40"><PlayIcon className="w-10 h-10 text-white" /></div>
                                          </div>
                                          <div className="p-4"><h4 className="font-bold text-white leading-snug mb-1">{video.title}</h4></div>
                                      </div>
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
