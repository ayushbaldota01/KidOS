
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

// --- Types ---

export interface IBLMMetrics {
    attentionSpan: number; // Average duration in ms
    frustrationLevel: number; // 0-10
    curiosityType: 'VISUAL' | 'TEXTUAL'; // Preference
    energyLevel: 'CALM' | 'HIGH'; // Derived from scroll speed
    sessionDuration: number;
}

export interface ContentRecommendation {
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    format: 'FACT' | 'GAME' | 'STORY' | 'VIDEO';
    topicCategory: 'STANDARD' | 'HIGH_ENERGY' | 'CALM';
    reason: string; // For the Debug HUD
}

interface Interaction {
    id: string;
    startTime: number;
    type: string;
}

interface IBLMContextType {
    metrics: IBLMMetrics;
    startInteraction: (id: string, type: string) => void;
    endInteraction: (success: boolean) => void;
    reportFrustration: (amount?: number) => void;
    reportSuccess: () => void;
    decideNextContent: () => ContentRecommendation;
    // Debug helpers
    resetMetrics: () => void;
    forceFrustration: () => void;
}

const IBLMContext = createContext<IBLMContextType | undefined>(undefined);

export const IBLMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- State ---
    const [metrics, setMetrics] = useState<IBLMMetrics>({
        attentionSpan: 5000, // Start with neutral baseline
        frustrationLevel: 0,
        curiosityType: 'VISUAL',
        energyLevel: 'CALM',
        sessionDuration: 0
    });

    // --- Internal Tracking ---
    const activeInteraction = useRef<Interaction | null>(null);
    const interactionHistory = useRef<number[]>([]); // Store durations of last 5 interactions

    // Session Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setMetrics(m => ({ ...m, sessionDuration: m.sessionDuration + 1 }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Actions ---

    const startInteraction = (id: string, type: string) => {
        activeInteraction.current = {
            id,
            startTime: Date.now(),
            type
        };
    };

    const endInteraction = (success: boolean) => {
        if (!activeInteraction.current) return;

        const duration = Date.now() - activeInteraction.current.startTime;
        
        // Update History (Keep last 5)
        const newHistory = [duration, ...interactionHistory.current].slice(0, 5);
        interactionHistory.current = newHistory;

        // Calculate Average Attention Span
        const avgDuration = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;

        setMetrics(prev => {
            // Determine Energy Level based on speed
            // If avg duration < 3s, they are scrolling fast (High Energy/Bored)
            const newEnergy = avgDuration < 4000 ? 'HIGH' : 'CALM';

            return {
                ...prev,
                attentionSpan: Math.round(avgDuration),
                energyLevel: newEnergy,
                // Reduce frustration slightly on successful interaction, increase if "skipped" quickly without success signal
                frustrationLevel: success ? Math.max(0, prev.frustrationLevel - 1) : prev.frustrationLevel
            };
        });

        activeInteraction.current = null;
    };

    const reportFrustration = (amount: number = 1) => {
        setMetrics(prev => ({
            ...prev,
            frustrationLevel: Math.min(10, prev.frustrationLevel + amount)
        }));
    };

    const reportSuccess = () => {
        setMetrics(prev => ({
            ...prev,
            frustrationLevel: Math.max(0, prev.frustrationLevel - 2)
        }));
    };

    // --- THE CORE LOGIC LOOP ---
    const decideNextContent = (): ContentRecommendation => {
        const { frustrationLevel, attentionSpan } = metrics;
        const recentHistory = interactionHistory.current;

        // RULE 1: FRUSTRATION CHECK
        // If frustration is high, drop difficulty and switch to gamified content
        if (frustrationLevel > 3) {
            return {
                difficulty: 'EASY',
                format: 'GAME',
                topicCategory: 'CALM',
                reason: 'DETECTED FRUSTRATION (>3). DECREASING LOAD.'
            };
        }

        // RULE 2: BOREDOM / SHORT ATTENTION CHECK
        // If last 3 interactions were < 5 seconds
        const fastScrolls = recentHistory.slice(0, 3).filter(d => d < 5000).length;
        if (fastScrolls >= 3) {
            return {
                difficulty: 'EASY',
                format: 'VIDEO', // Switch to passive video or exciting fact
                topicCategory: 'HIGH_ENERGY',
                reason: 'LOW ATTENTION SPAN DETECTED. SWITCHING TO HIGH ENERGY.'
            };
        }

        // RULE 3: DEEP ENGAGEMENT
        // If attention span is long (> 10s), increase complexity
        if (attentionSpan > 10000) {
            return {
                difficulty: 'HARD',
                format: 'STORY',
                topicCategory: 'STANDARD',
                reason: 'HIGH ENGAGEMENT. INCREASING COMPLEXITY.'
            };
        }

        // DEFAULT
        return {
            difficulty: 'MEDIUM',
            format: 'FACT',
            topicCategory: 'STANDARD',
            reason: 'BASELINE BEHAVIOR.'
        };
    };

    // Debug
    const resetMetrics = () => {
        setMetrics({
            attentionSpan: 5000,
            frustrationLevel: 0,
            curiosityType: 'VISUAL',
            energyLevel: 'CALM',
            sessionDuration: metrics.sessionDuration
        });
        interactionHistory.current = [];
    };

    const forceFrustration = () => {
        reportFrustration(4);
    };

    return (
        <IBLMContext.Provider value={{
            metrics,
            startInteraction,
            endInteraction,
            reportFrustration,
            reportSuccess,
            decideNextContent,
            resetMetrics,
            forceFrustration
        }}>
            {children}
        </IBLMContext.Provider>
    );
};

export const useIBLM = () => {
    const context = useContext(IBLMContext);
    if (!context) throw new Error("useIBLM must be used within an IBLMProvider");
    return context;
};
