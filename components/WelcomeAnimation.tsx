
import React, { useEffect, useState } from 'react';
import { SparklesIcon, PlayIcon } from './Icons';

interface WelcomeAnimationProps {
    onComplete: () => void;
}

export const WelcomeAnimation: React.FC<WelcomeAnimationProps> = ({ onComplete }) => {
    // Phase 0: Cover Screen (Waiting for User)
    // Phase 1: Fade out UI, Zoom into Hoot
    // Phase 2: Hoot Waves/Greets (Speech Bubble)
    // Phase 3: Car Appears (Hoot jumps in)
    // Phase 4: Fly to Top Left
    const [phase, setPhase] = useState(0);

    const handleStart = () => {
        setPhase(1); // Start sequence
        
        // Sequence Timeline
        setTimeout(() => setPhase(2), 600);  // Hoot greets
        setTimeout(() => setPhase(3), 3000); // Car appears
        setTimeout(() => setPhase(4), 4500); // Fly away
        setTimeout(onComplete, 5500);      // End overlay
    };

    // --- 3D Styles (Shared with FloatingBuddy) ---
    const carGradient = "bg-gradient-to-r from-red-500 via-red-400 to-red-600";
    const carShadow = "shadow-[0_20px_40px_rgba(0,0,0,0.6)]";
    const wheelGradient = "bg-gradient-to-br from-gray-800 to-black";

    return (
        <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-black transition-opacity duration-700 ${phase === 4 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {/* Cinematic Background */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop" 
                    alt="Space Background" 
                    className={`w-full h-full object-cover opacity-60 animate-pan-slow transition-all duration-[3000ms] ${phase > 0 ? 'scale-110 blur-md' : ''}`}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/80 via-purple-900/60 to-black/90"></div>
                
                {/* Floating Elements */}
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center px-4 w-full h-full justify-center perspective-1000">
                
                {/* --- HOOT CHARACTER CONTAINER --- */}
                {/* Transform origin center to create the fly-away effect to top-left */}
                <div className={`relative transition-all duration-1000 ease-in-out flex flex-col items-center
                    ${phase === 0 ? 'scale-100 translate-y-0' : ''}
                    ${phase === 1 ? 'scale-125 translate-y-10' : ''}
                    ${phase === 2 ? 'scale-125 translate-y-10' : ''}
                    ${phase === 3 ? 'scale-110 translate-y-20' : ''}
                    ${phase === 4 ? '-translate-x-[45vw] -translate-y-[45vh] scale-[0.5] rotate-[-15deg]' : ''}
                `}>
                    
                    {/* Speech Bubble (Phase 2 Only) */}
                    <div className={`absolute -top-40 left-1/2 -translate-x-1/2 bg-white text-slate-900 p-6 rounded-3xl shadow-2xl border-4 border-yellow-400 w-72 text-center transition-all duration-300 transform origin-bottom z-50
                        ${phase === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}
                    `}>
                        <p className="font-black text-2xl mb-2">Hoot Hoot! 🦉</p>
                        <p className="font-bold text-slate-600 text-lg">I'm Hoot! I'll be your guide. Let's go!</p>
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-4 border-b-4 border-yellow-400 transform rotate-45"></div>
                    </div>

                    {/* The Car (Appears Phase 3) */}
                    <div className={`absolute bottom-[-20px] transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) transform
                        ${phase >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-40 scale-50'}
                    `}>
                         {/* 3D Car Body - Scaled x2 compared to FloatingBuddy */}
                        <div className={`relative w-48 h-28 ${carGradient} rounded-3xl rounded-t-2xl ${carShadow} flex items-center justify-center`}>
                            {/* Gloss */}
                            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-2xl pointer-events-none"></div>

                            {/* Wheels */}
                            <div className={`absolute -bottom-5 left-4 w-12 h-12 ${wheelGradient} rounded-full border-4 border-gray-600 shadow-lg flex items-center justify-center animate-spin-slow`}>
                                <div className="w-4 h-4 bg-gray-400 rounded-full shadow-inner"></div>
                            </div>
                            <div className={`absolute -bottom-5 right-4 w-12 h-12 ${wheelGradient} rounded-full border-4 border-gray-600 shadow-lg flex items-center justify-center animate-spin-slow`}>
                                <div className="w-4 h-4 bg-gray-400 rounded-full shadow-inner"></div>
                            </div>

                             {/* Headlights */}
                            <div className="absolute top-6 -left-2 w-3 h-6 bg-yellow-300 rounded-l-full shadow-[0_0_15px_rgba(253,224,71,0.8)] border border-yellow-500"></div>
                            <div className="absolute top-6 -right-2 w-3 h-6 bg-yellow-300 rounded-r-full shadow-[0_0_15px_rgba(253,224,71,0.8)] border border-yellow-500"></div>

                            {/* Windshield */}
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-32 h-16 bg-blue-300/40 rounded-t-full border-t-2 border-white/50 backdrop-blur-[2px]"></div>
                        </div>
                    </div>

                    {/* Hoot Avatar */}
                    {/* He jumps 'in' the car in Phase 3+ */}
                    <div className={`relative w-40 h-40 transition-all duration-500 transform z-10
                         ${phase >= 3 ? 'translate-y-8 scale-90' : 'translate-y-0 animate-float'}
                    `}>
                        {/* Glowing Aura (Phase 0/1/2) */}
                        <div className={`absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse ${phase >= 3 ? 'opacity-0' : 'opacity-100'}`}></div>
                        
                        {/* Body */}
                        <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 to-indigo-800 rounded-full border-4 border-white/30 shadow-2xl flex items-center justify-center overflow-hidden">
                             {/* Gloss */}
                             <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full"></div>
                             
                             {/* Face */}
                             <div className="relative z-10 flex flex-col items-center mt-4">
                                  <div className="flex gap-2">
                                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden">
                                        <div className="w-6 h-6 bg-black rounded-full relative">
                                            <div className="w-2 h-2 bg-white rounded-full absolute top-1 right-1"></div>
                                        </div>
                                      </div>
                                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden">
                                        <div className="w-6 h-6 bg-black rounded-full relative">
                                            <div className="w-2 h-2 bg-white rounded-full absolute top-1 right-1"></div>
                                        </div>
                                      </div>
                                  </div>
                                  <div className="w-6 h-6 bg-orange-500 rotate-45 rounded-sm mt-[-5px] shadow-sm"></div>
                             </div>

                             {/* Belly */}
                             <div className="absolute -bottom-8 w-24 h-24 bg-indigo-300 rounded-full opacity-50"></div>
                        </div>
                    </div>

                </div>

                {/* --- UI ELEMENTS (Fade out in Phase 1) --- */}
                <div className={`transition-all duration-500 absolute bottom-20 left-0 right-0 flex flex-col items-center ${phase > 0 ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                    {/* Title Sequence */}
                    <div className="mb-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-indigo-300 mb-2 tracking-tight drop-shadow-lg font-serif">
                            WonderNest
                        </h1>
                        <p className="text-xl md:text-2xl text-indigo-100 font-medium max-w-lg leading-relaxed drop-shadow-md mx-auto">
                            Explore. Learn. Dream.
                        </p>
                    </div>

                    {/* Start Button */}
                    <button 
                        onClick={handleStart}
                        className="group relative px-16 py-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-indigo-950 rounded-full font-black text-2xl shadow-[0_0_40px_rgba(250,204,21,0.4)] hover:shadow-[0_0_60px_rgba(250,204,21,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center gap-4 ring-4 ring-white/20 backdrop-blur-sm animate-pulse-slow"
                    >
                        <span>Let's Go!</span>
                        <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center group-hover:bg-white/50 transition-colors">
                            <PlayIcon className="w-6 h-6 text-indigo-950 ml-1" />
                        </div>
                        
                        {/* Sparkles */}
                        <div className="absolute -top-3 -right-3 text-yellow-200 animate-spin-slow">
                            <SparklesIcon className="w-10 h-10" />
                        </div>
                    </button>
                </div>

                <div className="absolute bottom-8 left-0 right-0 text-center animate-in fade-in delay-1000 flex flex-col items-center">
                    <p className="text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase">
                        Powered by Gemini 2.5
                    </p>
                    <p className="text-white/30 text-[8px] font-bold tracking-[0.15em] uppercase mt-1">
                        INDIVIDUAL BEHAVIOUR LEARNING MODEL
                    </p>
                </div>
            </div>
        </div>
    );
};
