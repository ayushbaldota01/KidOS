
import React, { useEffect, useState } from 'react';
import { ShieldIcon, CheckIcon, LockIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface SafetyShieldProps {
    status: 0 | 1 | 2 | 3; // 0: Idle, 1: Scanning, 2: Verified, 3: Blocked
}

export const SafetyShield: React.FC<SafetyShieldProps> = ({ status }) => {
    // Status Text
    const getStatusText = () => {
        switch(status) {
            case 1: return "Guardian Scanning...";
            case 2: return "Safe & Verified";
            case 3: return "Content Blocked";
            default: return "";
        }
    };

    // Color Logic
    const getColor = () => {
        switch(status) {
            case 1: return "text-blue-500 border-blue-500 bg-blue-50";
            case 2: return "text-green-500 border-green-500 bg-green-50";
            case 3: return "text-red-500 border-red-500 bg-red-50";
            default: return "text-slate-300 border-slate-200 bg-white/50";
        }
    };

    return (
        <div className="flex items-center gap-2">
            <AnimatePresence>
                {status !== 0 && (
                    <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${getColor()}`}
                    >
                        {getStatusText()}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative w-10 h-10 flex items-center justify-center">
                {/* Pulse Ring for Scanning */}
                {status === 1 && (
                    <motion.div 
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 bg-blue-400 rounded-full z-0"
                    />
                )}
                
                <motion.div 
                    animate={status === 1 ? { rotate: 360 } : { rotate: 0 }}
                    transition={status === 1 ? { repeat: Infinity, ease: "linear", duration: 2 } : {}}
                    className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white shadow-sm transition-colors duration-300 ${status === 0 ? 'border-slate-200' : getColor().split(' ')[1]}`}
                >
                    <AnimatePresence mode='wait'>
                        {status === 0 && (
                            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <ShieldIcon className="w-4 h-4 text-slate-400" />
                            </motion.div>
                        )}
                        {status === 1 && (
                            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <ShieldIcon className="w-4 h-4 text-blue-500" />
                            </motion.div>
                        )}
                        {status === 2 && (
                            <motion.div key="verified" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <CheckIcon className="w-5 h-5 text-green-500" />
                            </motion.div>
                        )}
                        {status === 3 && (
                            <motion.div key="blocked" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <LockIcon className="w-4 h-4 text-red-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
};
