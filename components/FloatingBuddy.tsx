
import React, { useState, useEffect, useRef } from 'react';
import { MicIcon, SparklesIcon } from './Icons';
import { getBuddyMessage, logActivity } from '../services/gemini';
import { ParentSettings, View } from '../types';

interface FloatingBuddyProps {
    currentView: View;
}

export const FloatingBuddy: React.FC<FloatingBuddyProps> = ({ currentView }) => {
    const [isActive, setIsActive] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [settings, setSettings] = useState<ParentSettings | null>(null);
    const [animationMode, setAnimationMode] = useState<'idle' | 'excited' | 'spin'>('idle');

    // Speech Recognition Setup
    const recognitionRef = useRef<any>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('parent_settings');
        if (saved) setSettings(JSON.parse(saved));
        
        logActivity('fact', `Navigated to ${currentView}`, 'Navigation');

        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                handleVoiceQuery(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = () => {
                setIsListening(false);
                setMessage("I didn't quite catch that. Try again?");
            };
        }

        resetIdleTimer();
        return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
    }, [currentView]);

    const resetIdleTimer = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        const delay = Math.random() * 30000 + 60000;
        idleTimerRef.current = setTimeout(async () => {
            if (!isActive && !isSpeaking) {
                const tip = await getBuddyMessage(currentView, settings);
                setMessage(tip);
                setAnimationMode('excited');
                setTimeout(() => { setMessage(null); setAnimationMode('idle'); }, 5000);
            }
        }, delay);
    };

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            setIsSpeaking(true);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;
            utterance.pitch = 1.2;
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        }
    };

    const handleVoiceQuery = async (query: string) => {
        setMessage("Thinking...");
        setAnimationMode('spin');
        const response = await getBuddyMessage(query, settings, true);
        setAnimationMode('excited');
        setMessage(response);
        speak(response);
        logActivity('chat', `Asked Hoot: ${query}`, 'Voice Chat');
        resetIdleTimer();
        setTimeout(() => setAnimationMode('idle'), 2000);
    };

    const toggleListening = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setMessage("I'm listening...");
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const toggleActive = () => {
        resetIdleTimer();
        if (isActive) {
            setIsActive(false);
            setMessage(null);
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            setIsActive(true);
            setAnimationMode('spin');
            setTimeout(() => setAnimationMode('idle'), 1000);
            const greeting = `Hi ${settings?.childName || 'friend'}! I'm here to help.`;
            setMessage(greeting);
            speak(greeting);
        }
    };

    return (
        <>
            {isActive && <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm animate-in fade-in duration-300" onClick={toggleActive}></div>}

            <div 
                className={`fixed z-[100] transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer origin-center ${
                    isActive 
                    ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[3.5]' 
                    : 'bottom-[calc(80px+env(safe-area-inset-bottom)+0.5rem)] left-3 scale-100 hover:scale-110 active:scale-95' 
                }`}
                onClick={!isActive ? toggleActive : undefined}
            >
                <div className={`relative group ${animationMode === 'spin' ? 'animate-spin-y' : animationMode === 'excited' ? 'animate-bounce' : 'animate-float'}`}>
                    
                    {/* Message Bubble */}
                    {message && (
                        <div className={`absolute bottom-full mb-3 left-0 bg-white text-slate-800 p-3 rounded-2xl rounded-bl-none shadow-[0_8px_20px_rgba(0,0,0,0.15)] border-2 border-slate-100 min-w-[140px] text-left animate-in fade-in slide-in-from-bottom-2 z-40 ${isActive ? 'text-[6px] leading-tight w-32 -translate-y-4' : 'text-xs w-48'}`}>
                            <p className="font-bold">{message}</p>
                        </div>
                    )}

                    {/* COMPOSITE CAR & CHARACTER STRUCTURE */}
                    <div className="relative w-32 h-24">
                        
                        {/* 1. BACK WHEELS (Behind body) */}
                        <div className={`absolute bottom-1 right-6 w-7 h-7 bg-black rounded-full border-4 border-slate-700 shadow-lg z-0 ${isActive ? 'animate-spin-slow' : ''}`}>
                             <div className="w-2 h-2 bg-slate-400 rounded-full m-auto mt-1.5"></div>
                        </div>

                        {/* 2. INTERIOR/BACK SEAT (Behind Hoot) */}
                        <div className="absolute bottom-6 left-4 w-20 h-12 bg-red-900 rounded-t-2xl z-0 border-2 border-red-800 shadow-inner"></div>

                        {/* 3. HOOT (SITTING) - Pops up when active */}
                        <div className={`absolute bottom-8 left-6 w-14 h-14 z-10 transition-all duration-700 ease-out ${isActive ? '-translate-y-3 scale-110' : ''} ${isSpeaking ? 'animate-pulse' : ''}`}>
                             {/* Body/Head */}
                             <div className="w-full h-full bg-indigo-600 rounded-full border-[3px] border-indigo-400 shadow-inner flex items-center justify-center relative">
                                  {/* Eyes */}
                                  <div className="flex gap-1.5 -mt-2">
                                      <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                                          <div className={`w-2 h-2 bg-black rounded-full transition-transform ${isActive ? 'scale-125' : ''}`}>
                                              <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-white rounded-full"></div>
                                          </div>
                                      </div>
                                      <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                                          <div className={`w-2 h-2 bg-black rounded-full transition-transform ${isActive ? 'scale-125' : ''}`}>
                                              <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-white rounded-full"></div>
                                          </div>
                                      </div>
                                  </div>
                                  {/* Beak */}
                                  <div className="absolute top-8 w-2 h-2 bg-orange-400 rotate-45 rounded-[1px] shadow-sm"></div>
                                  {/* Tummy (Visible Part) */}
                                  <div className="absolute bottom-1 w-8 h-4 bg-indigo-300 rounded-t-full opacity-60"></div>
                             </div>
                        </div>

                        {/* 4. CAR BODY FRONT (Masks Hoot's lower half) */}
                        <div className="absolute bottom-3 left-0 w-full h-12 bg-gradient-to-b from-red-500 to-red-700 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.3)] z-20 flex items-center overflow-hidden border-t border-white/20">
                             {/* Reflection Highlight */}
                             <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
                             
                             {/* Headlight */}
                             <div className={`absolute top-3 right-1 w-2 h-5 bg-yellow-300 rounded-l-full shadow-[0_0_8px_rgba(253,224,71,0.9)] border border-yellow-500 ${isActive ? 'animate-pulse' : ''}`}></div>
                             
                             {/* Door Handle */}
                             <div className="absolute top-4 left-10 w-4 h-1 bg-red-900/50 rounded-full"></div>
                             
                             {/* License Plate (Tiny detail) */}
                             <div className="absolute bottom-2 right-8 w-6 h-2 bg-yellow-400 rounded-[1px] opacity-80"></div>
                        </div>

                        {/* 5. WINDSHIELD */}
                        <div className="absolute bottom-11 right-6 w-14 h-8 bg-blue-300/40 border-2 border-white/40 rounded-tr-2xl skew-x-[-15deg] backdrop-blur-[1px] z-10">
                            {/* Reflection on windshield */}
                            <div className="absolute top-1 right-2 w-8 h-1 bg-white/40 rotate-[-15deg] rounded-full"></div>
                        </div>

                        {/* 6. STEERING WHEEL */}
                        <div className={`absolute bottom-10 right-10 w-1 h-6 bg-black/70 rotate-[-20deg] z-10 origin-bottom ${isActive ? 'rotate-[-30deg]' : 'rotate-[-20deg]'} transition-transform duration-1000`}>
                            <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full border-[3px] border-black/80"></div>
                        </div>

                        {/* 7. HOOT'S WING (Resting on door) */}
                        <div className={`absolute bottom-12 left-2 w-5 h-4 bg-indigo-700 rounded-full rotate-[-15deg] z-30 shadow-sm border border-indigo-500 transition-all duration-700 ${isActive ? '-translate-y-2 -rotate-[45deg]' : ''}`}></div>

                        {/* 8. FRONT WHEELS */}
                        <div className={`absolute bottom-0 left-4 w-9 h-9 bg-black rounded-full border-[4px] border-slate-700 shadow-xl z-30 flex items-center justify-center ${isActive ? 'animate-spin-slow' : ''}`}>
                             <div className="w-3 h-3 bg-slate-400 rounded-full shadow-inner"></div>
                        </div>
                        <div className={`absolute bottom-0 right-4 w-9 h-9 bg-black rounded-full border-[4px] border-slate-700 shadow-xl z-30 flex items-center justify-center ${isActive ? 'animate-spin-slow' : ''}`}>
                             <div className="w-3 h-3 bg-slate-400 rounded-full shadow-inner"></div>
                        </div>

                    </div>
                </div>

                {isActive && (
                    <div className="absolute top-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-4 w-max z-[100]">
                        <button 
                            onClick={toggleListening}
                            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-[3px] border-white transition-all hover:scale-110 active:scale-95 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-indigo-500 to-indigo-700'}`}
                        >
                            <MicIcon className="w-6 h-6 text-white" />
                        </button>
                        {isListening && <p className="text-[6px] text-white font-bold bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-md">Listening...</p>}
                        
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleActive(); }}
                            className="mt-2 text-[6px] font-bold text-white/80 hover:text-white bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};
