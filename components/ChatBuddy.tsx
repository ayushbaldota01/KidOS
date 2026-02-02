
import React, { useState, useRef, useEffect } from 'react';
import { askProfessorStream } from '../services/gemini';
import { ChatMessage } from '../types';
import { BrainIcon, SendIcon, SparklesIcon, MicIcon } from './Icons';
import { motion } from 'framer-motion';

export const ChatBuddy: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: "Hoot hoot! I'm Professor Hoot. 🦉 Ask me anything!" }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSend = async (textOverride?: string) => {
    const text = typeof textOverride === 'string' ? textOverride : input;
    if (!text.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: text };
    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInput('');
    setIsStreaming(true);

    // Create placeholder message for streaming
    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }]);

    const { text: finalText, imageUrl } = await askProfessorStream(text, (streamedText) => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: streamedText } : m));
    });
    
    if (imageUrl) {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, imageUrl } : m));
    }
    setIsStreaming(false);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if ('webkitSpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.onstart = () => setIsListening(true);
        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.onresult = (event: any) => handleSend(event.results[0][0].transcript);
        recognitionRef.current.start();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-indigo-50">
      <div className="p-4 bg-indigo-600 text-white shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600">
                <BrainIcon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold font-kids">Professor Hoot</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-800 shadow-sm'
            }`}>
              <p className="text-lg font-medium">{msg.text || (isStreaming && msg.role === 'model' ? '...' : '')}</p>
              {msg.imageUrl && <img src={msg.imageUrl} className="mt-2 rounded-lg w-full" />}
            </div>
          </motion.div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-white border-t border-indigo-100 flex gap-2">
        <button onClick={toggleListening} className={`w-12 h-12 rounded-full flex items-center justify-center ${isListening ? 'bg-red-500 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
          <MicIcon className="w-5 h-5" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 p-3 bg-gray-100 rounded-full outline-none"
          placeholder="Ask me anything..."
        />
        <button onClick={() => handleSend()} className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center">
          <SendIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
