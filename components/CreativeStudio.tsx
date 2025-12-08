
import React, { useState, useRef, useEffect } from 'react';
import { generateImage, promptForKey } from '../services/gemini';
import { ImageSize } from '../types';
import { WandIcon, SparklesIcon, PencilIcon, EraserIcon, TrashIcon, DownloadIcon, PaletteIcon, BrushIcon } from './Icons';

type Mode = 'GENERATE' | 'DRAW';
type Tool = 'BRUSH' | 'ERASER';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

const COLORS = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#EAB308', // Yellow
    '#22C55E', // Green
    '#3B82F6', // Blue
    '#A855F7', // Purple
    '#EC4899', // Pink
    '#000000', // Black
];

export const CreativeStudio: React.FC = () => {
  const [mode, setMode] = useState<Mode>('GENERATE');
  
  // AI Gen State
  const [prompt, setPrompt] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<ImageSize>(ImageSize.S_1K);

  // Drawing State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#EC4899'); // Default pink
  const [tool, setTool] = useState<Tool>('BRUSH');
  const [brushSize, setBrushSize] = useState(5);
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);

  // --- AI Logic ---
  const runWithAuthCheck = async (action: () => Promise<void>) => {
      setLoading(true);
      try {
          await action();
      } catch (error: any) {
          console.error("Operation failed:", error);
          const errStr = error.toString();
          if (errStr.includes('403') || errStr.includes('permission') || errStr.includes('API key') || errStr.includes('Project')) {
              if (window.confirm("To use this magic tool, we need to connect your Google Cloud account properly. Connect now?")) {
                  await promptForKey();
                  setLoadingStep("Retrying...");
                  try {
                      await action();
                  } catch (retryErr: any) {
                      console.error("Retry failed:", retryErr);
                      alert(`Still couldn't connect. Error: ${retryErr.message || 'Unknown'}`);
                  }
              }
          } else {
              alert(`Oops! The magic didn't work. Error: ${error.message || 'Unknown error'}`);
          }
      } finally {
          setLoading(false);
      }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setResultImage(null);
    setLoadingStep('Painting your masterpiece...');
    
    await runWithAuthCheck(async () => {
        const img = await generateImage(prompt, selectedSize);
        if (img) setResultImage(img);
        else throw new Error("No image generated");
    });
  };

  // --- Drawing Logic ---

  // Handle Resize
  useEffect(() => {
      if (mode === 'DRAW' && containerRef.current && canvasRef.current && particlesCanvasRef.current) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          
          // Set internal resolution to match display size for sharpness
          canvasRef.current.width = width;
          canvasRef.current.height = height;
          particlesCanvasRef.current.width = width;
          particlesCanvasRef.current.height = height;
          
          // Set white background initially
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
          }
      }
  }, [mode]);

  // Animation Loop for Particles
  useEffect(() => {
      if (mode !== 'DRAW') return;

      const animate = () => {
          const ctx = particlesCanvasRef.current?.getContext('2d');
          if (!ctx || !particlesCanvasRef.current) return;

          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

          for (let i = particles.current.length - 1; i >= 0; i--) {
              const p = particles.current[i];
              p.x += p.vx;
              p.y += p.vy;
              p.life -= 0.02;
              p.size *= 0.95;

              if (p.life <= 0 || p.size < 0.5) {
                  particles.current.splice(i, 1);
                  continue;
              }

              ctx.globalAlpha = p.life;
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
          }
          ctx.globalAlpha = 1.0;

          animationFrameId.current = requestAnimationFrame(animate);
      };

      animate();
      return () => cancelAnimationFrame(animationFrameId.current);
  }, [mode]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      setIsDrawing(true);
      draw(e);
  };

  const stopDrawing = () => {
      setIsDrawing(false);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.beginPath(); // Reset path
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;
      if (!canvasRef.current) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const rect = canvasRef.current.getBoundingClientRect();
      let clientX, clientY;

      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      ctx.lineWidth = brushSize;
      ctx.strokeStyle = tool === 'ERASER' ? '#FFFFFF' : color;
      
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);

      // Spawn particles if drawing with brush
      if (tool === 'BRUSH') {
          spawnParticles(x, y, color);
      }
  };

  const spawnParticles = (x: number, y: number, color: string) => {
      for (let i = 0; i < 2; i++) {
          particles.current.push({
              x,
              y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 1.0,
              color: color,
              size: Math.random() * 5 + 2
          });
      }
  };

  const clearCanvas = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const downloadCanvas = () => {
      if (canvasRef.current) {
          const link = document.createElement('a');
          link.download = 'my-drawing.png';
          link.href = canvasRef.current.toDataURL();
          link.click();
      }
  };

  return (
    <div className="h-full bg-pink-50 flex flex-col overflow-y-auto">
      <div className="p-4 bg-pink-500 text-white shadow-md shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2"><WandIcon className="w-6 h-6" /> Creative Studio</h2>
      </div>

      <div className="flex justify-center gap-2 my-4 px-4 shrink-0">
        <button onClick={() => setMode('GENERATE')} className={`px-6 py-2 rounded-full font-bold transition-all ${mode === 'GENERATE' ? 'bg-pink-600 text-white shadow-lg' : 'bg-white text-pink-500'}`}>AI Wizard</button>
        <button onClick={() => setMode('DRAW')} className={`px-6 py-2 rounded-full font-bold transition-all ${mode === 'DRAW' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-purple-500'}`}>Free Paint</button>
      </div>

      <div className="flex-1 p-4 w-full h-full max-w-4xl mx-auto flex flex-col pb-24">
          
          {mode === 'GENERATE' && (
            <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-pink-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <label className="block text-gray-700 font-bold mb-2">What should I draw?</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A green dinosaur eating pizza on the moon..." className="w-full p-4 bg-gray-50 rounded-xl border-2 border-pink-100 focus:border-pink-500 focus:outline-none resize-none h-32 text-lg mb-4" />
              
              <div className="mb-6">
                <span className="text-sm font-bold text-gray-500 mr-2">Quality:</span>
                <div className="flex gap-2 mt-2">
                  {Object.values(ImageSize).map((size) => (
                    <button key={size} onClick={() => setSelectedSize(size)} className={`px-3 py-1 rounded-lg text-sm font-bold border-2 transition-colors ${selectedSize === size ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>{size}</button>
                  ))}
                </div>
              </div>

              <button onClick={handleGenerate} disabled={loading || !prompt} className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform mb-4">
                {loading ? <SparklesIcon className="animate-spin" /> : <WandIcon />} {loading ? 'Painting...' : 'Create Magic!'}
              </button>

              {loading && <div className="text-center"><p className="text-sm font-bold text-gray-500 animate-pulse">{loadingStep}</p></div>}

              {resultImage && (
                <div className="mt-6 bg-white p-2 rounded-3xl shadow-xl border-4 border-white transform transition-all animate-in zoom-in duration-300">
                    <img src={resultImage} alt="Generated" className="w-full rounded-2xl" />
                    <div className="p-4 text-center"><a href={resultImage} download="magic-art.png" className="text-pink-500 font-bold underline hover:text-pink-600">Save to device</a></div>
                </div>
              )}
            </div>
          )}

          {mode === 'DRAW' && (
            <div className="flex-1 flex flex-col h-full bg-white rounded-3xl shadow-xl border-4 border-purple-200 overflow-hidden relative animate-in fade-in duration-300">
                
                {/* Canvas Container */}
                <div ref={containerRef} className="flex-1 relative cursor-crosshair touch-none bg-white">
                    <canvas 
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="absolute inset-0 z-10"
                    />
                    {/* Particle Layer */}
                    <canvas 
                        ref={particlesCanvasRef}
                        className="absolute inset-0 z-20 pointer-events-none"
                    />
                </div>

                {/* Toolbar */}
                <div className="bg-purple-50 p-4 border-t-2 border-purple-100 flex flex-col gap-4 shrink-0 z-30">
                    
                    {/* Tools & Size */}
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setTool('BRUSH')}
                                className={`p-3 rounded-xl transition-all ${tool === 'BRUSH' ? 'bg-purple-500 text-white shadow-lg scale-110' : 'bg-white text-purple-400 hover:bg-purple-100'}`}
                            >
                                <PencilIcon className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={() => setTool('ERASER')}
                                className={`p-3 rounded-xl transition-all ${tool === 'ERASER' ? 'bg-purple-500 text-white shadow-lg scale-110' : 'bg-white text-purple-400 hover:bg-purple-100'}`}
                            >
                                <EraserIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                             <div className={`w-3 h-3 rounded-full bg-slate-300 cursor-pointer ${brushSize === 5 ? 'bg-purple-600 scale-125' : ''}`} onClick={() => setBrushSize(5)}></div>
                             <div className={`w-5 h-5 rounded-full bg-slate-300 cursor-pointer ${brushSize === 10 ? 'bg-purple-600 scale-125' : ''}`} onClick={() => setBrushSize(10)}></div>
                             <div className={`w-8 h-8 rounded-full bg-slate-300 cursor-pointer ${brushSize === 20 ? 'bg-purple-600 scale-125' : ''}`} onClick={() => setBrushSize(20)}></div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={clearCanvas} className="p-3 rounded-xl bg-red-100 text-red-500 hover:bg-red-200 transition-colors" title="Clear">
                                <TrashIcon className="w-6 h-6" />
                            </button>
                            <button onClick={downloadCanvas} className="p-3 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors" title="Save">
                                <DownloadIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {COLORS.map(c => (
                            <button 
                                key={c}
                                onClick={() => { setColor(c); setTool('BRUSH'); }}
                                className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-110 ${color === c && tool === 'BRUSH' ? 'border-purple-500 scale-110 shadow-md' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                        <button 
                             className={`w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center text-gray-400 ${tool === 'ERASER' ? 'border-purple-500 text-purple-500' : 'border-gray-200'}`}
                             onClick={() => setTool('ERASER')}
                        >
                            <EraserIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
          )}
      </div>
    </div>
  );
};
