
import React, { useState, useEffect, useRef } from 'react';
import { generateLearnTopics, generateImage, generateLessonFast, generateSpeech, getWavUrl } from '../services/gemini';
import { LearnVideo, ImageSize } from '../types';
import { TvIcon, PlayIcon, PauseIcon, SparklesIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

export const LearnTV: React.FC = () => {
  const [videos, setVideos] = useState<LearnVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<LearnVideo | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'READY'>('IDLE');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    generateLearnTopics().then(setVideos);
  }, []);

  const startLearning = async (video: LearnVideo) => {
    setActiveVideo(video);
    setStatus('LOADING');
    
    // 1. Get script immediately (Flash-lite)
    const { script, visualPrompts } = await generateLessonFast(video.title);
    
    // 2. Parallelize Image & Audio
    const imgPromise = generateImage(visualPrompts[0], ImageSize.S_1K);
    const audioPromise = generateSpeech(script);

    // As soon as the FIRST image and audio are ready, we go!
    const [img, audio] = await Promise.all([imgPromise, audioPromise]);
    
    setAudioUrl(getWavUrl(audio));
    setActiveVideo(prev => ({ ...prev!, slideImages: [img!] }));
    setStatus('READY');
    
    // Load remaining images in background
    visualPrompts.slice(1).forEach(async (p, idx) => {
        const nextImg = await generateImage(p, ImageSize.S_1K);
        if (nextImg) setActiveVideo(v => ({ ...v!, slideImages: [...(v!.slideImages || []), nextImg] }));
    });
  };

  const close = () => { setActiveVideo(null); setStatus('IDLE'); if (audioUrl) URL.revokeObjectURL(audioUrl); };

  return (
    <div className="h-full bg-slate-950 text-white flex flex-col p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black bubbly-text flex items-center gap-2"><TvIcon /> WonderTV</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {videos.map(v => (
            <motion.div 
                whileTap={{ scale: 0.95 }}
                key={v.id} 
                onClick={() => startLearning(v)}
                className="bg-slate-900 rounded-[2rem] p-4 border-2 border-slate-800 hover:border-red-500 cursor-pointer"
            >
                <div className="aspect-video bg-slate-800 rounded-xl mb-4 flex items-center justify-center">
                    <PlayIcon className="w-10 h-10 opacity-20" />
                </div>
                <h3 className="font-bold text-lg">{v.title}</h3>
            </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {activeVideo && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 bg-black z-50 flex flex-col">
                <button onClick={close} className="absolute top-6 right-6 z-50 text-white bg-white/20 p-2 rounded-full">✕</button>
                
                <div className="flex-1 flex items-center justify-center relative">
                    {status === 'LOADING' ? (
                        <div className="text-center">
                            <SparklesIcon className="w-12 h-12 animate-spin mx-auto mb-4" />
                            <p className="font-black bubbly-text">Preparing Magic...</p>
                        </div>
                    ) : (
                        <div className="w-full h-full">
                            {activeVideo.slideImages?.[currentSlide] && (
                                <img src={activeVideo.slideImages[currentSlide]} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute bottom-10 left-0 right-0 p-8 bg-gradient-to-t from-black text-center">
                                <button 
                                    onClick={() => audioRef.current?.play()}
                                    className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"
                                >
                                    <PlayIcon className="w-8 h-8 ml-1" />
                                </button>
                                <h2 className="text-2xl font-black">{activeVideo.title}</h2>
                            </div>
                        </div>
                    )}
                </div>
                {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={close} autoPlay />}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
