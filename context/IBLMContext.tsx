
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { FeedItem } from '../types';

export interface IBLMMetrics {
    attentionSpan: number;
    frustrationLevel: number;
    curiosityType: 'VISUAL' | 'TEXTUAL';
    energyLevel: 'CALM' | 'HIGH';
    sessionDuration: number;
    topicStickiness: number; // 0-10, how likely they are to stay on same topic
}

export interface ContentRecommendation {
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    format: 'FACT' | 'GAME' | 'STORY' | 'VIDEO';
    topicCategory: 'STANDARD' | 'HIGH_ENERGY' | 'CALM';
    reason: string;
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
    // Sequence Tracking
    contentBuffer: FeedItem[];
    setBuffer: React.Dispatch<React.SetStateAction<FeedItem[]>>;
    resetMetrics: () => void;
}

const IBLMContext = createContext<IBLMContextType | undefined>(undefined);

export const IBLMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [metrics, setMetrics] = useState<IBLMMetrics>({
        attentionSpan: 5000,
        frustrationLevel: 0,
        curiosityType: 'VISUAL',
        energyLevel: 'CALM',
        sessionDuration: 0,
        topicStickiness: 5
    });

    const [contentBuffer, setBuffer] = useState<FeedItem[]>([]);
    const activeInteraction = useRef<Interaction | null>(null);
    const interactionHistory = useRef<number[]>([]);

    useEffect(() => {
        const timer = setInterval(() => {
            setMetrics(m => ({ ...m, sessionDuration: m.sessionDuration + 1 }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const startInteraction = (id: string, type: string) => {
        activeInteraction.current = { id, startTime: Date.now(), type };
    };

    const endInteraction = (success: boolean) => {
        if (!activeInteraction.current) return;
        const duration = Date.now() - activeInteraction.current.startTime;
        const newHistory = [duration, ...interactionHistory.current].slice(0, 5);
        interactionHistory.current = newHistory;
        const avgDuration = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;

        setMetrics(prev => ({
            ...prev,
            attentionSpan: Math.round(avgDuration),
            energyLevel: avgDuration < 4000 ? 'HIGH' : 'CALM',
            frustrationLevel: success ? Math.max(0, prev.frustrationLevel - 1) : prev.frustrationLevel,
            topicStickiness: duration > 10000 ? Math.min(10, prev.topicStickiness + 1) : Math.max(0, prev.topicStickiness - 1)
        }));
        activeInteraction.current = null;
    };

    const reportFrustration = (amount: number = 1) => {
        setMetrics(prev => ({ ...prev, frustrationLevel: Math.min(10, prev.frustrationLevel + amount) }));
    };

    const reportSuccess = () => {
        setMetrics(prev => ({ ...prev, frustrationLevel: Math.max(0, prev.frustrationLevel - 2) }));
    };

    const decideNextContent = (): ContentRecommendation => {
        const { frustrationLevel, attentionSpan, topicStickiness } = metrics;
        if (frustrationLevel > 3) return { difficulty: 'EASY', format: 'GAME', topicCategory: 'CALM', reason: 'CALMING ESCAPE' };
        if (attentionSpan < 4000) return { difficulty: 'EASY', format: 'VIDEO', topicCategory: 'HIGH_ENERGY', reason: 'RECAPTURING FOCUS' };
        if (topicStickiness > 7) return { difficulty: 'HARD', format: 'STORY', topicCategory: 'STANDARD', reason: 'DEEP DIVE' };
        return { difficulty: 'MEDIUM', format: 'FACT', topicCategory: 'STANDARD', reason: 'GENERAL DISCOVERY' };
    };

    const resetMetrics = () => {
        setMetrics({ attentionSpan: 5000, frustrationLevel: 0, curiosityType: 'VISUAL', energyLevel: 'CALM', sessionDuration: 0, topicStickiness: 5 });
        interactionHistory.current = [];
        setBuffer([]);
    };

    return (
        <IBLMContext.Provider value={{ metrics, startInteraction, endInteraction, reportFrustration, reportSuccess, decideNextContent, contentBuffer, setBuffer, resetMetrics }}>
            {children}
        </IBLMContext.Provider>
    );
};

export const useIBLM = () => {
    const context = useContext(IBLMContext);
    if (!context) throw new Error("useIBLM must be used within an IBLMProvider");
    return context;
};
