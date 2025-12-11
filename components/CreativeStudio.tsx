
import React, { useState, useRef, useEffect } from 'react';
import { identifyDrawing, getChessAdvice, generateLanguageLesson, checkPronunciation, generateImage, promptForKey } from '../services/gemini';
import { PencilIcon, EraserIcon, TrashIcon, DownloadIcon, CircleIcon, SquareIcon, ChessIcon, MathIcon, AbcBlockIcon, SparklesIcon, LightBulbIcon, FillIcon, GamepadIcon, PuzzleIcon, GlobeIcon, VolumeIcon, MicIcon, XIcon, StarIcon } from './Icons';
import { ImageSize } from '../types';
import { triggerConfetti, triggerSmallConfetti } from '../services/confetti';
import { motion } from 'framer-motion';

type Mode = 'DRAW' | 'BUBBLE' | 'MEMORY' | 'MATH_QUEST' | 'WORD_QUEST' | 'CHESS' | 'LANGUAGE';
type Tool = 'BRUSH' | 'ERASER' | 'FILL' | 'CIRCLE' | 'SQUARE';

// --- Types ---
interface Particle {
    x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
}
interface Bubble {
    id: number; x: number; y: number; radius: number; color: string; speed: number;
}
interface Card {
    id: number; content: string; isFlipped: boolean; isMatched: boolean;
}

// --- Colors ---
const COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#000000'];
const MEMORY_ICONS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'];

// --- Chess Setup ---
const INITIAL_BOARD = [
    ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
    ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
    ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

export const CreativeStudio: React.FC = () => {
  const [mode, setMode] = useState<Mode | null>(null);
  
  // --- Audio Context ---
  const audioCtxRef = useRef<AudioContext | null>(null);

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
  const animationFrameId = useRef<number>(0);
  const [drawingGuess, setDrawingGuess] = useState<string>('');
  const [guessing, setGuessing] = useState(false);

  // --- Bubble State ---
  const bubbleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0); 
  const bubbles = useRef<Bubble[]>([]);
  const bubbleIdCounter = useRef(0);

  // --- Memory State ---
  const [cards, setCards] = useState<Card[]>([]);
  const [turns, setTurns] = useState(0);
  const [isGameWon, setIsGameWon] = useState(false);

  // --- Chess State ---
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [selectedPos, setSelectedPos] = useState<{r: number, c: number} | null>(null);
  const [turn, setTurn] = useState<'white' | 'black'>('white');
  const [chessAdvice, setChessAdvice] = useState<string>('');
  const [adviceLoading, setAdviceLoading] = useState(false);

  // --- Math Quest State ---
  const [mathProblem, setMathProblem] = useState({ a: 0, b: 0, ans: 0, op: '+' });
  const [mathOptions, setMathOptions] = useState<number[]>([]);
  const [mathFeedback, setMathFeedback] = useState('');

  // --- Word Quest State ---
  const [wordTarget, setWordTarget] = useState({ word: 'LION', emoji: '🦁' });
  const [wordInput, setWordInput] = useState<string[]>(['', '', '', '']);
  const [letterPool, setLetterPool] = useState<string[]>([]);
  const [wordSuccess, setWordSuccess] = useState(false);

  // --- Language Game State ---
  const [langTarget, setLangTarget] = useState('Spanish');
  const [lesson, setLesson] = useState<any>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonImage, setLessonImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<{correct: boolean, text: string} | null>(null);
  const recognitionRef = useRef<any>(null);

  // --- Sound Helper ---
  const playSound = (type: 'click' | 'success' | 'draw' | 'error' | 'magic' | 'pop') => {
      if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      switch (type) {
          case 'click': osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(now); osc.stop(now + 0.1); break;
          case 'draw': osc.type = 'triangle'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(400, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(now); osc.stop(now + 0.1); break;
          case 'magic': osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.3); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.5); osc.start(now); osc.stop(now + 0.5); break;
          case 'pop': osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(now); osc.stop(now + 0.1); break;
          case 'success': osc.type = 'square'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554, now + 0.1); osc.frequency.setValueAtTime(659, now + 0.2); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.4); osc.start(now); osc.stop(now + 0.4); break;
          case 'error': osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(100, now + 0.2); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(now); osc.stop(now + 0.2); break;
      }
  };

  const speak = (text: string, lang: string = 'en-US') => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (lang === 'Spanish') u.lang = 'es-ES';
      else if (lang === 'French') u.lang = 'fr-FR';
      else if (lang === 'German') u.lang = 'de-DE';
      else u.lang = 'en-US';
      window.speechSynthesis.speak(u);
  };

  // --- Handlers ---
  const handleIdentifyDrawing = async () => {
      playSound('magic');
      if (!canvasRef.current) return;
      setGuessing(true);
      setDrawingGuess("");
      const base64 = canvasRef.current.toDataURL('image/png');
      try {
          const guess = await identifyDrawing(base64);
          setDrawingGuess(guess);
          triggerConfetti();
      } catch(e) { console.error(e); }
      setGuessing(false);
  };

  // --- Canvas Logic ---
  useEffect(() => {
      if ((mode === 'DRAW' || mode === 'BUBBLE') && containerRef.current) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          if (mode === 'DRAW' && canvasRef.current && particlesCanvasRef.current) {
              if (canvasRef.current.width !== width) { 
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = canvasRef.current.width;
                 tempCanvas.height = canvasRef.current.height;
                 tempCanvas.getContext('2d')?.drawImage(canvasRef.current, 0, 0);
                 canvasRef.current.width = width; canvasRef.current.height = height;
                 particlesCanvasRef.current.width = width; particlesCanvasRef.current.height = height;
                 const ctx = canvasRef.current.getContext('2d');
                 if (ctx) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); ctx.lineCap='round'; ctx.drawImage(tempCanvas, 0, 0); }
              }
          } else if (mode === 'BUBBLE' && bubbleCanvasRef.current) {
              bubbleCanvasRef.current.width = width; bubbleCanvasRef.current.height = height;
          }
      }
  }, [mode]);

  useEffect(() => {
      const animate = () => {
          if (mode === 'DRAW' && particlesCanvasRef.current) {
              const ctx = particlesCanvasRef.current.getContext('2d');
              if (ctx) {
                  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                  for (let i = particles.current.length - 1; i >= 0; i--) {
                      const p = particles.current[i];
                      p.x += p.vx; p.y += p.vy; p.life -= 0.02; p.size *= 0.95;
                      if (p.life <= 0) { particles.current.splice(i, 1); continue; }
                      ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                  }
              }
          }
          if (mode === 'BUBBLE' && bubbleCanvasRef.current) {
              const ctx = bubbleCanvasRef.current.getContext('2d');
              if (ctx) {
                  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                  if (Math.random() < 0.03) {
                      bubbles.current.push({ id: bubbleIdCounter.current++, x: Math.random() * ctx.canvas.width, y: ctx.canvas.height + 50, radius: Math.random() * 20 + 20, color: COLORS[Math.floor(Math.random() * COLORS.length)], speed: Math.random() * 2 + 1 });
                  }
                  for (let i = bubbles.current.length - 1; i >= 0; i--) {
                      const b = bubbles.current[i];
                      b.y -= b.speed;
                      if (b.y + b.radius < 0) { bubbles.current.splice(i, 1); continue; }
                      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fillStyle = b.color + '88'; ctx.fill(); ctx.strokeStyle = b.color; ctx.stroke();
                      ctx.beginPath(); ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.2, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
                  }
              }
          }
          animationFrameId.current = requestAnimationFrame(animate);
      };
      animate();
      return () => cancelAnimationFrame(animationFrameId.current);
  }, [mode]);

  // Drawing Handlers
  const getCoordinates = (e: any) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const startDrawing = (e: any) => {
      if (!canvasRef.current) return;
      playSound('draw');
      const { x, y } = getCoordinates(e);
      if (tool === 'FILL') return; 
      setIsDrawing(true); startPosRef.current = { x, y };
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); if (['CIRCLE', 'SQUARE'].includes(tool)) snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height); }
      if (tool === 'BRUSH') draw(e);
  };
  const draw = (e: any) => {
      if (!isDrawing || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const { x, y } = getCoordinates(e);
      if (['CIRCLE', 'SQUARE'].includes(tool) && snapshotRef.current) {
          ctx.putImageData(snapshotRef.current, 0, 0);
          ctx.lineWidth = brushSize; ctx.strokeStyle = color;
          const sx = startPosRef.current!.x; const sy = startPosRef.current!.y;
          ctx.beginPath();
          if (tool === 'SQUARE') ctx.rect(sx, sy, x - sx, y - sy);
          else ctx.arc(sx, sy, Math.sqrt(Math.pow(x-sx,2) + Math.pow(y-sy,2)), 0, 2 * Math.PI);
          ctx.stroke(); return;
      }
      ctx.lineWidth = brushSize; ctx.strokeStyle = tool === 'ERASER' ? '#FFFFFF' : color;
      ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
      if (tool === 'BRUSH') for(let i=0;i<2;i++) particles.current.push({x, y, vx:(Math.random()-.5)*5, vy:(Math.random()-.5)*5, life:1, color, size: Math.random()*5+2});
  };
  const stopDrawing = () => { if(isDrawing) playSound('click'); setIsDrawing(false); snapshotRef.current = null; startPosRef.current = null; canvasRef.current?.getContext('2d')?.beginPath(); };
  const clearCanvas = () => { const ctx = canvasRef.current?.getContext('2d'); if(ctx) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height); } setDrawingGuess(''); playSound('click'); };
  const handleBubbleClick = (e: any) => {
      if (!bubbleCanvasRef.current) return;
      const { x, y } = getCoordinates(e);
      const rect = bubbleCanvasRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const mx = clientX - rect.left; const my = clientY - rect.top;
      for (let i = bubbles.current.length - 1; i >= 0; i--) {
          const b = bubbles.current[i];
          if (Math.sqrt(Math.pow(mx - b.x, 2) + Math.pow(my - b.y, 2)) < b.radius) {
              bubbles.current.splice(i, 1); setScore(s => s + 10);
              playSound('pop');
          }
      }
  };

  // --- Game Initialization ---
  useEffect(() => {
      setScore(0);
      if (mode === 'MEMORY') { setCards([...MEMORY_ICONS, ...MEMORY_ICONS].sort(()=>Math.random()-.5).map((c,i)=>({id:i, content:c, isFlipped:false, isMatched:false}))); setTurns(0); setIsGameWon(false); }
      if (mode === 'MATH_QUEST') generateMathProblem();
      if (mode === 'WORD_QUEST') generateWordLevel();
      if (mode === 'LANGUAGE') startLanguageLesson();
  }, [mode]);

  // --- Memory Logic ---
  const handleCardClick = (id: number) => {
      if (isGameWon) return;
      const card = cards.find(c => c.id === id);
      if (!card || card.isFlipped || card.isMatched) return;
      const flipped = cards.filter(c => c.isFlipped && !c.isMatched);
      if (flipped.length >= 2) return;
      playSound('click');
      setCards(prev => prev.map(c => c.id === id ? { ...c, isFlipped: true } : c));
      if (flipped.length === 1) {
          setTurns(t => t+1);
          if (flipped[0].content === card.content) {
             playSound('success'); setScore(s => s + 100); setCards(prev => prev.map(c => (c.id === id || c.id === flipped[0].id) ? { ...c, isMatched: true } : c));
             if (cards.filter(c=>c.isMatched).length + 2 === cards.length) {
                 setIsGameWon(true);
                 triggerConfetti();
             }
          } else {
             playSound('error'); setScore(s => Math.max(0, s - 10));
             setTimeout(() => setCards(prev => prev.map(c => (c.id === id || c.id === flipped[0].id) ? { ...c, isFlipped: false } : c)), 1000);
          }
      }
  };

  // --- Chess Logic ---
  const handleChessClick = (r: number, c: number) => {
      const piece = board[r][c];
      const isWhitePiece = '♙♖♘♗♕♔'.includes(piece);
      if (selectedPos === null) { if (piece && isWhitePiece && turn === 'white') { setSelectedPos({r, c}); playSound('click'); } return; }
      const prevPiece = board[selectedPos.r][selectedPos.c];
      if (isWhitePiece) { setSelectedPos({r, c}); playSound('click'); return; }
      playSound('click');
      const newBoard = [...board.map(row => [...row])];
      newBoard[r][c] = prevPiece; newBoard[selectedPos.r][selectedPos.c] = '';
      setBoard(newBoard); setSelectedPos(null); setTurn('black'); setChessAdvice('');
      setTimeout(() => {
          let blackMoves = [];
          for(let i=0; i<8; i++) for(let j=0; j<8; j++) if('♟♜♞♝♛♚'.includes(newBoard[i][j])) blackMoves.push({r:i, c:j});
          if(blackMoves.length > 0) {
              const move = blackMoves[Math.floor(Math.random()*blackMoves.length)];
              const destR = Math.min(7, move.r + 1);
              newBoard[destR][move.c] = newBoard[move.r][move.c]; newBoard[move.r][move.c] = '';
              setBoard([...newBoard]); setTurn('white'); playSound('click');
          }
      }, 1000);
  };
  const getHint = async () => { playSound('click'); setAdviceLoading(true); const rows = board.map(row => row.map(c => c || '.').join(' ')).join('\n'); const advice = await getChessAdvice(rows); setChessAdvice(advice); setAdviceLoading(false); };

  // --- Math Logic ---
  const generateMathProblem = () => { const a = Math.floor(Math.random()*5)+1; const b = Math.floor(Math.random()*5)+1; const ans = a+b; setMathProblem({a,b,ans,op:'+'}); const opts=new Set([ans]); while(opts.size<4) opts.add(Math.floor(Math.random()*10)+1); setMathOptions(Array.from(opts).sort(()=>Math.random()-.5)); setMathFeedback(''); };
  const handleMathAnswer = (val: number) => { 
      if(val===mathProblem.ans){ 
          playSound('success'); setScore(s=>s+50); setMathFeedback("Correct! 🎉"); 
          triggerSmallConfetti();
          setTimeout(generateMathProblem, 1500); 
      }else{ playSound('error'); setScore(s=>Math.max(0, s-10)); setMathFeedback("Try counting again!"); } 
    };

  // --- Word Logic ---
  const generateWordLevel = () => { const words=[{w:'LION',e:'🦁'},{w:'APPLE',e:'🍎'},{w:'CAR',e:'🚗'},{w:'FISH',e:'🐟'},{w:'MOON',e:'🌙'}]; const t=words[Math.floor(Math.random()*words.length)]; setWordTarget({word:t.w, emoji:t.e}); setWordInput(Array(t.w.length).fill('')); setWordSuccess(false); const letters=t.w.split(''); while(letters.length<8) letters.push(String.fromCharCode(65+Math.floor(Math.random()*26))); setLetterPool(letters.sort(()=>Math.random()-.5)); };
  const handleLetterClick = (char: string) => { 
      if(wordSuccess)return; const idx=wordInput.findIndex(l=>l===''); if(idx===-1)return; playSound('click'); const newIn=[...wordInput]; newIn[idx]=char; setWordInput(newIn); 
      if(newIn.join('')===wordTarget.word){ 
          playSound('success'); setScore(s=>s+100); setWordSuccess(true); 
          triggerConfetti();
          setTimeout(generateWordLevel,2000); 
      }else if(newIn.every(l=>l!=='')){ playSound('error'); setTimeout(()=>setWordInput(Array(wordTarget.word.length).fill('')),500); } 
    };

  // --- Language Logic ---
  const startLanguageLesson = async () => {
      setLessonLoading(true); setLesson(null); setFeedback(null); setLessonImage(null);
      try {
          const l = await generateLanguageLesson(langTarget, 'Easy');
          setLesson(l);
          if (l.imagePrompt) {
              const img = await generateImage(l.imagePrompt, ImageSize.S_1K, 'gemini-2.5-flash-image');
              setLessonImage(img);
          }
          if (l.voiceInstruction) speak(l.voiceInstruction);
      } catch (e) { console.error(e); }
      setLessonLoading(false);
  };
  
  const handleListen = () => {
      if(lesson) speak(lesson.phrase, langTarget);
  };
  
  const handleMic = () => {
      if ('webkitSpeechRecognition' in window) {
          const SpeechRecognition = (window as any).webkitSpeechRecognition;
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.lang = langTarget === 'Spanish' ? 'es-ES' : langTarget === 'French' ? 'fr-FR' : 'en-US';
          recognitionRef.current.onstart = () => setIsListening(true);
          recognitionRef.current.onend = () => setIsListening(false);
          recognitionRef.current.onresult = async (event: any) => {
              const transcript = event.results[0][0].transcript;
              setIsListening(false);
              const assessment = await checkPronunciation(lesson.phrase, transcript);
              if (assessment.correct) {
                  playSound('success');
                  setScore(s => s + 50);
                  triggerSmallConfetti();
              } else {
                  playSound('error');
              }
              setFeedback({ correct: assessment.correct, text: assessment.feedback });
          };
          recognitionRef.current.start();
      } else {
          alert("Voice recognition not supported in this browser.");
      }
  };

  // --- Mode Selector Card Component ---
  const GameCard = ({ m, title, icon, color, bg }: any) => (
      <motion.button 
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => { setMode(m); playSound('click'); }} 
        className={`relative aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border-4 border-white ${bg}`}
      >
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
              <div className="mb-2 p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  {icon}
              </div>
              <h3 className="font-black text-xl drop-shadow-md">{title}</h3>
          </div>
          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
      </motion.button>
  );

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-y-auto">
      {/* HEADER */}
      <div className="p-4 bg-slate-900 text-white shadow-md shrink-0 flex items-center justify-between z-50">
        <h2 className="text-xl font-black font-sans flex items-center gap-2 tracking-tight">
             Wonder Games <span className="text-[10px] bg-yellow-400 text-black px-2 rounded-full font-bold">ARCADE</span>
        </h2>
        {mode && <button onClick={() => setMode(null)} className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold">Back to Lobby</button>}
      </div>

      <div className="flex-1 w-full h-full max-w-5xl mx-auto flex flex-col relative">

          {/* LOBBY */}
          {mode === null && (
              <div className="p-6 grid grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                  <GameCard m="LANGUAGE" title="Speak World" icon={<GlobeIcon className="w-8 h-8"/>} bg="bg-gradient-to-br from-indigo-400 to-indigo-600" />
                  <GameCard m="DRAW" title="Magic Paint" icon={<FillIcon className="w-8 h-8"/>} bg="bg-gradient-to-br from-purple-400 to-purple-600" />
                  <GameCard m="BUBBLE" title="Bubble Pop" icon={<CircleIcon className="w-8 h-8"/>} bg="bg-gradient-to-br from-blue-400 to-blue-600" />
                  <GameCard m="MEMORY" title="Memory Zoo" icon={<PuzzleIcon className="w-8 h-8"/>} bg="bg-gradient-to-br from-green-400 to-green-600" />
                  <GameCard m="MATH_QUEST" title="Space Math" icon={<MathIcon className="w-8 h-8"/>} bg="bg-gradient-to-br from-orange-400 to-orange-600" />
                  <GameCard m="WORD_QUEST" title="Word Hunter" icon={<AbcBlockIcon className="w-8 h-8"/>} bg="bg-gradient-to-br from-teal-400 to-teal-600" />
                  <GameCard m="CHESS" title="Chess Coach" icon={<ChessIcon className="w-8 h-8"/>} bg="bg-gradient-to-br from-slate-500 to-slate-700" />
              </div>
          )}

          {/* LANGUAGE GAME */}
          {mode === 'LANGUAGE' && (
              <div className="flex-1 bg-indigo-50 p-6 flex flex-col items-center justify-center relative">
                   <div className="absolute top-4 right-4 bg-indigo-600 text-white px-6 py-2 rounded-full font-black text-xl shadow-lg">Score: {score}</div>
                   
                   <div className="flex gap-2 mb-8 bg-white p-1 rounded-xl shadow-sm">
                       {['Spanish', 'French', 'German'].map(l => (
                           <button key={l} onClick={() => setLangTarget(l)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${langTarget === l ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{l}</button>
                       ))}
                   </div>

                   <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center border-b-8 border-indigo-100 relative overflow-hidden">
                       {lessonLoading ? (
                           <div className="h-64 flex items-center justify-center flex-col gap-4">
                               <SparklesIcon className="w-12 h-12 text-indigo-400 animate-spin" />
                               <p className="font-bold text-slate-400">Loading lesson...</p>
                           </div>
                       ) : lesson ? (
                           <>
                               <div className="w-full h-48 bg-slate-100 rounded-2xl mb-6 overflow-hidden relative">
                                    {lessonImage ? <img src={lessonImage} className="w-full h-full object-cover animate-in fade-in" /> : <div className="flex items-center justify-center h-full text-4xl">🌍</div>}
                               </div>
                               
                               <h2 className="text-4xl font-black text-slate-800 mb-2">{lesson.phrase}</h2>
                               <p className="text-indigo-500 font-bold text-lg mb-1">{lesson.pronunciation}</p>
                               <p className="text-slate-400 font-medium italic mb-8">"{lesson.translation}"</p>

                               <div className="grid grid-cols-2 gap-4">
                                   <motion.button whileTap={{scale:0.95}} onClick={handleListen} className="py-4 rounded-xl bg-blue-100 text-blue-600 font-bold flex flex-col items-center justify-center gap-2 hover:bg-blue-200 transition-colors">
                                       <VolumeIcon className="w-6 h-6" /> Listen
                                   </motion.button>
                                   <motion.button whileTap={{scale:0.95}} onClick={handleMic} className={`py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                                       <MicIcon className="w-6 h-6" /> {isListening ? 'Listening...' : 'Speak'}
                                   </motion.button>
                               </div>

                               {feedback && (
                                   <div className={`mt-6 p-4 rounded-xl font-bold animate-in slide-in-from-bottom-2 ${feedback.correct ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                       {feedback.text}
                                   </div>
                               )}
                           </>
                       ) : null}
                   </div>
                   
                   <motion.button whileTap={{scale:0.95}} onClick={startLanguageLesson} className="mt-8 px-12 py-4 bg-indigo-600 text-white font-bold rounded-full shadow-lg transition-transform">
                       Next Card →
                   </motion.button>
              </div>
          )}

          {/* OTHER MODES (Reuse Logic) */}
          {mode === 'DRAW' && (
            <div className="flex-1 flex flex-col h-full bg-white relative">
                {drawingGuess && (
                    <div className="absolute top-4 left-4 right-4 bg-purple-600 text-white p-4 rounded-xl shadow-lg z-40 animate-in slide-in-from-top fade-in flex items-center justify-between">
                        <div className="flex items-center gap-3"><LightBulbIcon className="w-6 h-6 text-yellow-300" /><p className="font-bold">{drawingGuess}</p></div>
                        <button onClick={() => setDrawingGuess('')}><XIcon className="w-5 h-5 opacity-50" /></button>
                    </div>
                )}
                <div ref={containerRef} className="flex-1 relative cursor-crosshair bg-white">
                    <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="absolute inset-0 z-10" />
                    <canvas ref={particlesCanvasRef} className="absolute inset-0 z-20 pointer-events-none" />
                </div>
                <div className="bg-purple-50 p-4 border-t-2 border-purple-100 flex flex-col gap-4 z-30">
                    <div className="flex justify-between items-center">
                         <div className="flex gap-2">
                             {['BRUSH', 'FILL', 'CIRCLE', 'SQUARE', 'ERASER'].map(t => (
                                 <motion.button whileTap={{scale:0.9}} key={t} onClick={() => { setTool(t as Tool); playSound('click'); }} className={`p-3 rounded-xl transition-all ${tool === t ? 'bg-purple-500 text-white scale-110 shadow-lg' : 'bg-white text-purple-400'}`}>
                                     {t === 'BRUSH' && <PencilIcon className="w-6 h-6" />}
                                     {t === 'FILL' && <FillIcon className="w-6 h-6" />}
                                     {t === 'CIRCLE' && <CircleIcon className="w-6 h-6" />}
                                     {t === 'SQUARE' && <SquareIcon className="w-6 h-6" />}
                                     {t === 'ERASER' && <EraserIcon className="w-6 h-6" />}
                                 </motion.button>
                             ))}
                         </div>
                         <div className="flex gap-2">
                            <motion.button whileTap={{scale:0.95}} onClick={handleIdentifyDrawing} disabled={guessing} className="p-3 bg-yellow-400 text-black rounded-xl font-bold flex gap-2">{guessing ? '...' : <><LightBulbIcon className="w-6 h-6"/> Guess</>}</motion.button>
                            <motion.button whileTap={{scale:0.95}} onClick={clearCanvas} className="p-3 bg-red-100 text-red-500 rounded-xl"><TrashIcon className="w-6 h-6"/></motion.button>
                            <motion.button whileTap={{scale:0.95}} onClick={() => {if(canvasRef.current){const l=document.createElement('a');l.download='art.png';l.href=canvasRef.current.toDataURL();l.click();}}} className="p-3 bg-green-100 text-green-600 rounded-xl"><DownloadIcon className="w-6 h-6"/></motion.button>
                         </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {COLORS.map(c => <motion.button whileTap={{scale:0.9}} key={c} onClick={() => { setColor(c); playSound('click'); }} className={`w-10 h-10 rounded-full border-4 ${color === c ? 'border-purple-500 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}
                    </div>
                </div>
            </div>
          )}

          {mode === 'CHESS' && (
              <div className="flex-1 bg-slate-200 p-4 flex flex-col md:flex-row gap-8 items-center justify-center">
                  <div className="bg-[#b58863] p-4 rounded-lg shadow-2xl">
                      <div className="grid grid-cols-8 gap-0 border-4 border-[#5d4037]">
                          {board.map((row, r) => row.map((piece, c) => {
                              const isBlack = (r + c) % 2 === 1;
                              const isSelected = selectedPos?.r === r && selectedPos?.c === c;
                              return (
                                  <motion.div 
                                    whileTap={{ scale: 0.9 }}
                                    key={`${r}-${c}`} 
                                    onClick={() => handleChessClick(r, c)}
                                    className={`w-10 h-10 md:w-16 md:h-16 flex items-center justify-center text-3xl md:text-5xl cursor-pointer
                                        ${isBlack ? 'bg-[#8b4513]' : 'bg-[#f0d9b5]'}
                                        ${isSelected ? 'ring-4 ring-yellow-400 z-10' : ''}
                                    `}
                                  >
                                      <span className={['♟','♜','♞','♝','♛','♚'].includes(piece) ? 'text-black drop-shadow-sm' : 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]'}>
                                          {piece}
                                      </span>
                                  </motion.div>
                              );
                          }))}
                      </div>
                  </div>
                  <div className="flex flex-col gap-4 w-full md:w-64">
                      <div className="bg-white p-6 rounded-2xl shadow-lg">
                          <h3 className="font-black text-slate-800 text-lg mb-2">Chess Coach 🦉</h3>
                          <div className="min-h-[80px] text-slate-600 text-sm italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                              {chessAdvice || "Click 'Hint' and I'll help you find a great move!"}
                          </div>
                          <motion.button whileTap={{scale:0.95}} onClick={getHint} disabled={adviceLoading} className="w-full mt-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                              {adviceLoading ? <SparklesIcon className="animate-spin"/> : <LightBulbIcon />} 
                              {adviceLoading ? 'Analyzing...' : 'Give me a Hint!'}
                          </motion.button>
                      </div>
                  </div>
              </div>
          )}

          {mode === 'MATH_QUEST' && (
              <div className="flex-1 bg-orange-50 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                   <div className="absolute top-4 right-4 bg-orange-600 text-white px-6 py-2 rounded-full font-black text-xl shadow-lg">Score: {score}</div>
                   <div className="flex items-center gap-8 mb-12">
                       <div className="flex flex-col items-center">
                           <div className="text-6xl font-black text-slate-800 mb-2">{mathProblem.a}</div>
                       </div>
                       <div className="text-6xl font-black text-orange-400">+</div>
                       <div className="flex flex-col items-center">
                           <div className="text-6xl font-black text-slate-800 mb-2">{mathProblem.b}</div>
                       </div>
                       <div className="text-6xl font-black text-orange-400">=</div>
                       <div className="w-24 h-24 bg-white rounded-2xl border-4 border-dashed border-orange-300 flex items-center justify-center text-4xl text-orange-200 font-bold">?</div>
                   </div>
                   <div className="grid grid-cols-4 gap-4 w-full max-w-2xl">
                       {mathOptions.map((opt, i) => (
                           <motion.button whileTap={{scale:0.9}} key={i} onClick={() => handleMathAnswer(opt)} className="py-6 bg-white border-b-4 border-orange-200 hover:border-orange-500 rounded-2xl text-4xl font-black text-slate-700 hover:bg-orange-50 transition-all shadow-sm">
                               {opt}
                           </motion.button>
                       ))}
                   </div>
                   <div className="h-10 mt-8 font-bold text-orange-600 text-xl">{mathFeedback}</div>
              </div>
          )}

          {mode === 'WORD_QUEST' && (
              <div className="flex-1 bg-teal-50 p-6 flex flex-col items-center justify-center relative">
                  <div className="absolute top-4 right-4 bg-teal-600 text-white px-6 py-2 rounded-full font-black text-xl shadow-lg">Score: {score}</div>
                  <div className="bg-white p-8 rounded-full shadow-xl mb-8 animate-bounce-slow border-4 border-teal-100"><span className="text-8xl">{wordTarget.emoji}</span></div>
                  <div className="flex gap-3 mb-12">
                      {wordInput.map((char, i) => (
                          <div key={i} className={`w-16 h-20 bg-white border-b-8 ${char ? 'border-teal-500 text-teal-800' : 'border-slate-200'} rounded-xl flex items-center justify-center text-4xl font-black shadow-sm transition-all`}>{char}</div>
                      ))}
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                      {letterPool.map((char, i) => (
                          <motion.button whileTap={{scale:0.9}} key={i} onClick={() => handleLetterClick(char)} disabled={wordSuccess} className="w-16 h-16 bg-teal-600 text-white rounded-xl text-3xl font-bold shadow-[0_4px_0_rgba(13,148,136,1)] hover:bg-teal-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{char}</motion.button>
                      ))}
                  </div>
              </div>
          )}

          {mode === 'BUBBLE' && (
              <div className="flex-1 bg-gradient-to-b from-blue-300 to-blue-500 relative overflow-hidden">
                  <div className="absolute top-4 right-4 z-10 bg-white/20 backdrop-blur-md px-6 py-2 rounded-full text-white font-black text-2xl shadow-lg border border-white/20">Score: {score}</div>
                  <div ref={containerRef} className="absolute inset-0 cursor-crosshair">
                      <canvas ref={bubbleCanvasRef} onMouseDown={handleBubbleClick} onTouchStart={handleBubbleClick} className="w-full h-full block"/>
                  </div>
              </div>
          )}

          {mode === 'MEMORY' && (
               <div className="flex-1 bg-green-50 p-6 overflow-y-auto">
                   <div className="flex justify-between mb-6 items-center">
                       <span className="font-bold text-green-800 text-lg">Moves: {turns}</span>
                       <div className="bg-green-600 text-white px-6 py-2 rounded-full font-black text-xl shadow-lg">Score: {score}</div>
                       <motion.button whileTap={{scale:0.95}} onClick={() => { setCards([...MEMORY_ICONS, ...MEMORY_ICONS].sort(()=>Math.random()-.5).map((c,i)=>({id:i, content:c, isFlipped:false, isMatched:false}))); setTurns(0); setScore(0); setIsGameWon(false); playSound('click'); }} className="bg-white text-green-600 px-4 py-2 rounded-lg font-bold shadow-md hover:bg-green-50">Restart</motion.button>
                   </div>
                   {isGameWon ? (
                       <div className="h-full flex flex-col items-center justify-center animate-in zoom-in">
                           <div className="text-9xl mb-4">🏆</div>
                           <h2 className="text-4xl font-black text-green-700 mb-2">VICTORY!</h2>
                           <p className="text-2xl font-bold text-green-600 bg-white px-8 py-4 rounded-xl shadow-md border-2 border-green-200">Final Score: {score}</p>
                       </div>
                   ) : (
                       <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                           {cards.map(c => (
                               <motion.button whileTap={{scale:0.9}} key={c.id} onClick={() => handleCardClick(c.id)} className={`aspect-square rounded-2xl text-4xl shadow-md transition-all transform duration-500 ${c.isFlipped || c.isMatched ? 'bg-white rotate-y-180' : 'bg-green-400 hover:bg-green-500'}`}>
                                   {(c.isFlipped || c.isMatched) ? c.content : <PuzzleIcon className="w-8 h-8 text-green-800 mx-auto opacity-50"/>}
                               </motion.button>
                           ))}
                       </div>
                   )}
               </div>
          )}

      </div>
    </div>
  );
};
