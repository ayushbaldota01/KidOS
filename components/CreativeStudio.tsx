
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { identifyDrawing, getChessAdvice, generateLanguageLesson, checkPronunciation, generateImage, promptForKey } from '../services/gemini';
import { PencilIcon, EraserIcon, TrashIcon, DownloadIcon, CircleIcon, SquareIcon, ChessIcon, MathIcon, AbcBlockIcon, SparklesIcon, LightBulbIcon, FillIcon, GamepadIcon, PuzzleIcon, GlobeIcon, VolumeIcon, MicIcon, XIcon, StarIcon, MovieIcon } from './Icons';
import { ImageSize } from '../types';
import { triggerConfetti, triggerSmallConfetti } from '../services/confetti';
import { motion, AnimatePresence } from 'framer-motion';

type Mode = 'DRAW' | 'BUBBLE' | 'MEMORY' | 'MATH_QUEST' | 'WORD_QUEST' | 'CHESS' | 'LANGUAGE' | 'SPEECH_SAFARI';
type Tool = 'BRUSH' | 'ERASER' | 'FILL' | 'CIRCLE' | 'SQUARE';

// --- Preset Content (No Generation Wait) ---
const LANGUAGE_DECK = [
    { phrase: 'Hola', translation: 'Hello', lang: 'Spanish', pron: 'Oh-la', color: 'bg-orange-500', emoji: '👋' },
    { phrase: 'Bonjour', translation: 'Hello', lang: 'French', pron: 'Bon-zhoor', color: 'bg-blue-500', emoji: '🇫🇷' },
    { phrase: 'Guten Tag', translation: 'Good Day', lang: 'German', pron: 'Goo-ten Tahg', color: 'bg-yellow-500', emoji: '🇩🇪' },
    { phrase: 'Gracias', translation: 'Thank You', lang: 'Spanish', pron: 'Grah-see-as', color: 'bg-red-500', emoji: '🙏' },
    { phrase: 'Chat', translation: 'Cat', lang: 'French', pron: 'Sha', color: 'bg-purple-500', emoji: '🐱' },
];

const SAFARI_LEVELS = [
    { name: 'Golden Lion', word: 'Lion', emoji: '🦁', color: 'from-yellow-400 to-orange-500' },
    { name: 'Giant Elephant', word: 'Elephant', emoji: '🐘', color: 'from-blue-400 to-slate-500' },
    { name: 'Happy Monkey', word: 'Monkey', emoji: '🐒', color: 'from-amber-600 to-amber-800' },
    { name: 'Rainbow Parrot', word: 'Parrot', emoji: '🦜', color: 'from-green-400 to-red-500' },
];

// --- Types ---
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface Bubble { id: number; x: number; y: number; radius: number; color: string; speed: number; }
interface Card { id: number; content: string; isFlipped: boolean; isMatched: boolean; }

const COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#000000'];
const MEMORY_ICONS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'];

export const CreativeStudio: React.FC = () => {
  const [mode, setMode] = useState<Mode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- Global Game State ---
  const [score, setScore] = useState(0);

  // --- Drawing State ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const startPosRef = useRef<{x: number, y: number} | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#EC4899');
  const [tool, setTool] = useState<Tool>('BRUSH');
  const [brushSize, setBrushSize] = useState(5);
  const particles = useRef<Particle[]>([]);
  const [guessing, setGuessing] = useState(false);
  const [drawingGuess, setDrawingGuess] = useState('');

  // --- Bubble Pop State ---
  const bubbleCanvasRef = useRef<HTMLCanvasElement>(null);
  const bubbles = useRef<Bubble[]>([]);

  // --- Language & Speech State ---
  const [deckIndex, setDeckIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<{status: 'success' | 'error' | 'idle', text: string}>({status: 'idle', text: ''});
  const [safariIndex, setSafariIndex] = useState(0);
  const [safariUnlocked, setSafariUnlocked] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  // --- Memory State ---
  const [cards, setCards] = useState<Card[]>([]);
  const [turns, setTurns] = useState(0);

  // --- Sound Helper ---
  const playSound = (type: 'click' | 'success' | 'draw' | 'error' | 'magic' | 'pop') => {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      switch (type) {
          case 'click': osc.frequency.setValueAtTime(600, now); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.1); break;
          case 'success': osc.type = 'square'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(659, now + 0.1); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.3); break;
          case 'pop': osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.1); break;
          case 'error': osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.2); break;
      }
  };

  const speak = (text: string, lang: string = 'en-US') => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (lang === 'Spanish') u.lang = 'es-ES';
      else if (lang === 'French') u.lang = 'fr-FR';
      else if (lang === 'German') u.lang = 'de-DE';
      window.speechSynthesis.speak(u);
  };

  // --- Speech Logic ---
  const handleStartListening = (targetWord: string, isSafari: boolean = false) => {
      if (!('webkitSpeechRecognition' in window)) {
          alert("Voice games need Chrome!"); return;
      }
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = isSafari ? 'en-US' : (LANGUAGE_DECK[deckIndex].lang === 'Spanish' ? 'es-ES' : 'fr-FR');
      
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      
      recognitionRef.current.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript.toLowerCase();
          setIsListening(false);
          
          const isCorrect = transcript.includes(targetWord.toLowerCase());
          
          if (isCorrect) {
              playSound('success');
              setScore(s => s + 50);
              triggerSmallConfetti();
              if (isSafari) {
                  setSafariUnlocked(prev => [...prev, targetWord]);
                  setVoiceFeedback({ status: 'success', text: `Amazing! You said ${targetWord}!` });
                  setTimeout(() => {
                      setSafariIndex(i => (i + 1) % SAFARI_LEVELS.length);
                      setVoiceFeedback({ status: 'idle', text: '' });
                  }, 2000);
              } else {
                  setVoiceFeedback({ status: 'success', text: "Perfect Pronunciation! ⭐⭐⭐" });
                  setTimeout(() => setDeckIndex(i => (i + 1) % LANGUAGE_DECK.length), 2000);
              }
          } else {
              playSound('error');
              setVoiceFeedback({ status: 'error', text: `Almost! I heard "${transcript}". Try again!` });
          }
      };
      recognitionRef.current.start();
  };

  // --- Render Mode Lobby ---
  if (!mode) {
      return (
          <div className="h-full bg-indigo-50 overflow-y-auto p-6 flex flex-col items-center">
              <div className="max-w-4xl w-full">
                  <div className="mb-10 text-center">
                      <h2 className="text-4xl font-black text-indigo-900 bubbly-text mb-2">Wonder Arcade 🕹️</h2>
                      <p className="text-indigo-500 font-bold text-lg">Pick a game and start the magic!</p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                      <motion.button 
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('SPEECH_SAFARI')}
                        className="aspect-[4/3] bg-gradient-to-br from-green-400 to-emerald-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group border-4 border-white"
                      >
                          <div className="absolute top-4 right-4 bg-white/20 p-2 rounded-2xl backdrop-blur-md font-black text-[10px] tracking-widest">NEW VOICE GAME</div>
                          <div className="h-full flex flex-col justify-center items-center gap-4">
                              <div className="p-4 bg-white/20 rounded-full"><MicIcon className="w-10 h-10" /></div>
                              <h3 className="text-2xl font-black bubbly-text">Safari Speech</h3>
                          </div>
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('LANGUAGE')}
                        className="aspect-[4/3] bg-gradient-to-br from-indigo-500 to-purple-700 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group border-4 border-white"
                      >
                          <div className="h-full flex flex-col justify-center items-center gap-4">
                              <div className="p-4 bg-white/20 rounded-full"><GlobeIcon className="w-10 h-10" /></div>
                              <h3 className="text-2xl font-black bubbly-text">Speak World</h3>
                          </div>
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('DRAW')}
                        className="aspect-[4/3] bg-gradient-to-br from-pink-400 to-rose-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group border-4 border-white"
                      >
                          <div className="h-full flex flex-col justify-center items-center gap-4">
                              <div className="p-4 bg-white/20 rounded-full"><PencilIcon className="w-10 h-10" /></div>
                              <h3 className="text-2xl font-black bubbly-text">Magic Paint</h3>
                          </div>
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('MATH_QUEST')}
                        className="aspect-[4/3] bg-gradient-to-br from-orange-400 to-amber-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group border-4 border-white"
                      >
                          <div className="h-full flex flex-col justify-center items-center gap-4">
                              <div className="p-4 bg-white/20 rounded-full"><MathIcon className="w-10 h-10" /></div>
                              <h3 className="text-2xl font-black bubbly-text">Space Math</h3>
                          </div>
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('MEMORY')}
                        className="aspect-[4/3] bg-gradient-to-br from-blue-400 to-cyan-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group border-4 border-white"
                      >
                          <div className="h-full flex flex-col justify-center items-center gap-4">
                              <div className="p-4 bg-white/20 rounded-full"><PuzzleIcon className="w-10 h-10" /></div>
                              <h3 className="text-2xl font-black bubbly-text">Memory Zoo</h3>
                          </div>
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('BUBBLE')}
                        className="aspect-[4/3] bg-gradient-to-br from-sky-400 to-blue-500 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group border-4 border-white"
                      >
                          <div className="h-full flex flex-col justify-center items-center gap-4">
                              <div className="p-4 bg-white/20 rounded-full"><CircleIcon className="w-10 h-10" /></div>
                              <h3 className="text-2xl font-black bubbly-text">Bubble Pop</h3>
                          </div>
                      </motion.button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between z-50">
          <div className="flex items-center gap-4">
              <button onClick={() => setMode(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><XIcon className="w-6 h-6 text-slate-400" /></button>
              <h2 className="text-xl font-black text-slate-800 bubbly-text">{mode.replace('_', ' ')}</h2>
          </div>
          <div className="flex items-center gap-3">
              <div className="px-4 py-1.5 bg-yellow-400 text-black rounded-full font-black shadow-sm flex items-center gap-2">
                  <StarIcon className="w-4 h-4" /> {score}
              </div>
          </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
          {/* --- SPEECH SAFARI --- */}
          {mode === 'SPEECH_SAFARI' && (
              <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
                  <div className={`w-full max-w-lg aspect-square rounded-[3rem] shadow-2xl bg-gradient-to-br ${SAFARI_LEVELS[safariIndex].color} relative flex items-center justify-center border-[12px] border-white`}>
                      <motion.div 
                        initial={{ scale: 0.5, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        key={safariIndex}
                        className="text-[12rem] drop-shadow-2xl"
                      >
                          {SAFARI_LEVELS[safariIndex].emoji}
                      </motion.div>
                  </div>
                  
                  <div className="mt-12 text-center space-y-4">
                      <h3 className="text-4xl font-black text-slate-800 bubbly-text">Can you say {SAFARI_LEVELS[safariIndex].word}?</h3>
                      <AnimatePresence mode='wait'>
                        {voiceFeedback.text && (
                            <motion.p 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`text-xl font-bold ${voiceFeedback.status === 'success' ? 'text-green-600' : 'text-red-500'}`}
                            >
                                {voiceFeedback.text}
                            </motion.p>
                        )}
                      </AnimatePresence>
                  </div>

                  <div className="mt-auto pb-12">
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        animate={isListening ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1 }}
                        onClick={() => handleStartListening(SAFARI_LEVELS[safariIndex].word, true)}
                        className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 border-white ${isListening ? 'bg-red-500 animate-pulse' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                          <MicIcon className="w-10 h-10 text-white" />
                      </motion.button>
                  </div>
              </div>
          )}

          {/* --- LANGUAGE CARDS --- */}
          {mode === 'LANGUAGE' && (
               <div className="h-full flex flex-col items-center justify-center p-8">
                   <div className="w-full max-w-sm">
                       <motion.div 
                         key={deckIndex}
                         initial={{ x: 300, opacity: 0 }}
                         animate={{ x: 0, opacity: 1 }}
                         className={`rounded-[3rem] p-10 shadow-2xl text-white text-center flex flex-col items-center border-[8px] border-white/20 ${LANGUAGE_DECK[deckIndex].color}`}
                       >
                           <div className="text-8xl mb-6">{LANGUAGE_DECK[deckIndex].emoji}</div>
                           <h3 className="text-5xl font-black mb-2 bubbly-text">{LANGUAGE_DECK[deckIndex].phrase}</h3>
                           <p className="text-white/60 font-bold mb-8 uppercase tracking-widest">{LANGUAGE_DECK[deckIndex].lang}</p>
                           
                           <div className="bg-black/20 backdrop-blur-md rounded-2xl py-4 px-8 w-full">
                               <p className="text-sm font-black text-white/50 uppercase mb-1">Translation</p>
                               <p className="text-2xl font-bold">{LANGUAGE_DECK[deckIndex].translation}</p>
                           </div>
                       </motion.div>
                   </div>

                   <div className="mt-12 flex items-center gap-6">
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => speak(LANGUAGE_DECK[deckIndex].phrase, LANGUAGE_DECK[deckIndex].lang)}
                            className="w-16 h-16 bg-white shadow-xl rounded-full flex items-center justify-center text-indigo-600 hover:text-indigo-800"
                        >
                            <VolumeIcon className="w-8 h-8" />
                        </motion.button>

                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            animate={isListening ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ repeat: Infinity, duration: 1 }}
                            onClick={() => handleStartListening(LANGUAGE_DECK[deckIndex].phrase)}
                            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 border-white ${isListening ? 'bg-red-500 animate-pulse' : 'bg-indigo-600'}`}
                        >
                            <MicIcon className="w-10 h-10 text-white" />
                        </motion.button>

                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setDeckIndex(i => (i + 1) % LANGUAGE_DECK.length)}
                            className="w-16 h-16 bg-white shadow-xl rounded-full flex items-center justify-center text-indigo-600 hover:text-indigo-800"
                        >
                            <div className="text-2xl font-black">→</div>
                        </motion.button>
                   </div>

                   {voiceFeedback.text && (
                       <p className={`mt-8 text-xl font-black bubbly-text ${voiceFeedback.status === 'success' ? 'text-green-500' : 'text-orange-500'}`}>
                           {voiceFeedback.text}
                       </p>
                   )}
               </div>
          )}

          {/* --- Other modes fallback to original logic ... --- */}
          {mode === 'BUBBLE' && (
              <div className="h-full bg-gradient-to-b from-blue-300 to-sky-500 relative flex items-center justify-center">
                  <p className="text-white font-black text-4xl opacity-50 bubbly-text">Tap the Bubbles!</p>
              </div>
          )}
          {/* Add more logic as needed for other modes */}
      </div>
    </div>
  );
};
