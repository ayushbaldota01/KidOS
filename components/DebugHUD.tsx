
import React, { useState, useEffect } from 'react';
import { useIBLM, ContentRecommendation } from '../context/IBLMContext';

// Simple Icons for the HUD to avoid dependency issues if Lucide isn't installed in environment
const Activity = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
const Brain = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/></svg>;
const Alert = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

export const DebugHUD: React.FC = () => {
    const { metrics, decideNextContent, resetMetrics, reportFrustration } = useIBLM();
    const [isOpen, setIsOpen] = useState(false);
    const [recommendation, setRecommendation] = useState<ContentRecommendation | null>(null);

    // Update recommendation whenever metrics change
    useEffect(() => {
        setRecommendation(decideNextContent());
    }, [metrics]);

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-green-400 p-2 rounded-full border border-green-500/50 shadow-lg hover:scale-110 transition-transform font-mono text-xs"
            >
                IBLM_DEBUG
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-black/90 backdrop-blur-md border border-green-500/30 rounded-lg shadow-2xl font-mono text-xs text-green-400 p-4 overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 border-b border-green-500/30 pb-2">
                <div className="flex items-center gap-2">
                    <Brain />
                    <span className="font-bold tracking-wider">IBLM CORE v2.5</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-green-600 hover:text-green-400">[X]</button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-green-900/10 p-2 rounded border border-green-500/10">
                    <div className="text-green-600 mb-1 flex items-center gap-1"><Activity /> ATTENTION</div>
                    <div className="text-xl font-bold">{metrics.attentionSpan}ms</div>
                    <div className="w-full h-1 bg-green-900 mt-1">
                        <div 
                            className="h-full bg-green-500 transition-all duration-500" 
                            style={{ width: `${Math.min(100, (metrics.attentionSpan / 10000) * 100)}%` }}
                        />
                    </div>
                </div>

                <div className={`bg-green-900/10 p-2 rounded border border-green-500/10 ${metrics.frustrationLevel > 3 ? 'animate-pulse bg-red-900/20 border-red-500/50' : ''}`}>
                    <div className={`${metrics.frustrationLevel > 3 ? 'text-red-400' : 'text-green-600'} mb-1 flex items-center gap-1`}>
                        <Alert /> FRUSTRATION
                    </div>
                    <div className={`text-xl font-bold ${metrics.frustrationLevel > 3 ? 'text-red-500' : 'text-green-400'}`}>
                        {metrics.frustrationLevel}/10
                    </div>
                    <div className="w-full h-1 bg-green-900 mt-1">
                        <div 
                            className={`h-full transition-all duration-500 ${metrics.frustrationLevel > 3 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${(metrics.frustrationLevel / 10) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Derived State */}
            <div className="flex justify-between mb-4 text-[10px] uppercase tracking-widest text-green-600">
                <span>ENERGY: <span className="text-white">{metrics.energyLevel}</span></span>
                <span>TYPE: <span className="text-white">{metrics.curiosityType}</span></span>
            </div>

            {/* AI Decision Output */}
            <div className="bg-green-900/20 p-3 rounded border-l-2 border-green-500 mb-4">
                <div className="text-[10px] text-green-600 mb-1">NEXT CONTENT DECISION LOGIC:</div>
                <div className="text-white font-bold mb-1">{recommendation?.reason}</div>
                <div className="flex gap-2 mt-2">
                    <span className="bg-black/50 px-2 py-1 rounded text-yellow-400 border border-yellow-400/20">{recommendation?.difficulty}</span>
                    <span className="bg-black/50 px-2 py-1 rounded text-blue-400 border border-blue-400/20">{recommendation?.topicCategory}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => reportFrustration(2)}
                    className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/30 py-2 rounded transition-colors text-center"
                >
                    + STRESS TEST
                </button>
                <button 
                    onClick={resetMetrics}
                    className="bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-500/30 py-2 rounded transition-colors text-center"
                >
                    RESET
                </button>
            </div>
        </div>
    );
};
