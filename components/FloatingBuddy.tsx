
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

    // --- 3D CSS Styles ---
    const carGradient = "bg-gradient-to-r from-red-500 via-red-400 to-red-600";
    const carShadow = "shadow-[0_10px_20px_rgba(0,0,0,0.3),inset_0_2px_5px_rgba(255,255,255,0.4)]";
    const wheelGradient = "bg-gradient-to-br from-gray-800 to-black";

    return (
        <>
            {isActive && <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm animate-in fade-in duration-300" onClick={toggleActive}></div>}

            <div 
                className={`fixed z-[100] transition-all duration-700 ease-in-out cursor-pointer ${
                    isActive 
                    ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[3]' 
                    : 'top-4 left-4 scale-100 hover:scale-110' 
                }`}
                // NOTE: Changed right-4 to left-4 above
                onClick={!isActive ? toggleActive : undefined}
            >
                <div className={`relative group perspective-1000 ${animationMode === 'spin' ? 'animate-spin-y' : animationMode === 'excited' ? 'animate-bounce' : 'animate-float'}`}>
                    
                    {/* Message Bubble */}
                    {message && (
                        <div className={`absolute bottom-full mb-6 left-1/2 -translate-x-1/2 bg-white text-slate-800 p-3 rounded-2xl shadow-xl border-4 border-white min-w-[140px] text-center animate-in fade-in slide-in-from-bottom-2 z-20 ${isActive ? 'text-[6px] leading-tight w-40' : 'text-xs w-32'}`}>
                            <p className="font-bold">{message}</p>
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white transform rotate-45"></div>
                        </div>
                    )}

                    {/* 3D CAR BODY */}
                    <div className={`relative w-24 h-14 ${carGradient} rounded-2xl rounded-t-lg ${carShadow} flex items-center justify-center transform preserve-3d`}>
                        {/* Glossy Reflection */}
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg pointer-events-none"></div>

                        {/* Wheels (3D effect) */}
                        <div className={`absolute -bottom-3 left-2 w-7 h-7 ${wheelGradient} rounded-full border-4 border-gray-600 shadow-lg flex items-center justify-center ${isActive ? 'animate-spin' : ''}`}>
                            <div className="w-2 h-2 bg-gray-400 rounded-full shadow-inner"></div>
                        </div>
                        <div className={`absolute -bottom-3 right-2 w-7 h-7 ${wheelGradient} rounded-full border-4 border-gray-600 shadow-lg flex items-center justify-center ${isActive ? 'animate-spin' : ''}`}>
                            <div className="w-2 h-2 bg-gray-400 rounded-full shadow-inner"></div>
                        </div>

                        {/* Headlights */}
                        <div className="absolute top-3 -left-1 w-2 h-4 bg-yellow-300 rounded-l-full shadow-[0_0_10px_rgba(253,224,71,0.8)] border border-yellow-500"></div>
                        <div className="absolute top-3 -right-1 w-2 h-4 bg-yellow-300 rounded-r-full shadow-[0_0_10px_rgba(253,224,71,0.8)] border border-yellow-500"></div>

                        {/* HOOT AVATAR (3D Sphere Look) */}
                        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 rounded-full border-2 border-indigo-400 shadow-[0_5px_15px_rgba(0,0,0,0.4),inset_0_5px_10px_rgba(255,255,255,0.3)] flex items-center justify-center overflow-hidden transition-transform ${isSpeaking ? 'animate-pulse scale-105' : ''}`}>
                            {/* Eyes */}
                            <div className="flex gap-1 mt-1 z-10">
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden">
                                    <div className={`w-3 h-3 bg-black rounded-full transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                                        <div className="w-1 h-1 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                                    </div>
                                </div>
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden">
                                    <div className={`w-3 h-3 bg-black rounded-full transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                                        <div className="w-1 h-1 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                                    </div>
                                </div>
                            </div>
                            {/* Beak (3D) */}
                            <div className="absolute top-7 w-3 h-3 bg-gradient-to-b from-orange-400 to-orange-600 rotate-45 shadow-sm z-10 rounded-sm"></div>
                            {/* Belly */}
                            <div className="absolute -bottom-4 w-10 h-10 bg-indigo-300 rounded-full opacity-80"></div>
                        </div>
                        
                        {/* Windshield */}
                         <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-16 h-8 bg-blue-300/30 rounded-t-full border-t border-white/40 backdrop-blur-[1px]"></div>
                    </div>
                </div>

                {isActive && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <button 
                            onClick={toggleListening}
                            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-4 border-white transition-all hover:scale-110 active:scale-95 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-indigo-500 to-indigo-700'}`}
                        >
                            <MicIcon className="w-8 h-8 text-white" />
                        </button>
                        {isListening && <p className="text-[8px] text-white font-bold bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">I'm Listening...</p>}
                        
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleActive(); }}
                            className="mt-4 text-[8px] font-bold text-white/80 hover:text-white bg-white/20 px-4 py-2 rounded-full hover:bg-white/30 transition-colors"
                        >
                            Close Hoot
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};
