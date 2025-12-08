
import React, { useState, useRef, useEffect } from 'react';
import { askProfessor } from '../services/gemini';
import { ChatMessage } from '../types';
import { BrainIcon, SendIcon, SparklesIcon } from './Icons';

export const ChatBuddy: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: "Hoot hoot! I'm Professor Hoot. 🦉 Ask me anything! Why is the sky blue? Why do cats purr? I can draw pictures to explain too!" }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    const { text, imageUrl } = await askProfessor(input);
    
    setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: text,
        imageUrl: imageUrl || undefined
    }]);
    setIsThinking(false);
  };

  return (
    <div className="flex flex-col h-full bg-indigo-50">
      <div className="p-4 bg-indigo-600 text-white shadow-md flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 border-2 border-indigo-200">
            <BrainIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Professor Hoot</h2>
          <p className="text-xs text-indigo-200 flex items-center gap-1">
            <SparklesIcon className="w-3 h-3" />
            Visual Learning Mode
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-2xl shadow-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-500 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 rounded-tl-none border border-indigo-100'
            }`}>
              <p className="text-lg leading-snug whitespace-pre-wrap">{msg.text}</p>
              
              {/* Generated Image */}
              {msg.imageUrl && (
                  <div className="mt-4 rounded-xl overflow-hidden border-4 border-indigo-100 shadow-md">
                      <img src={msg.imageUrl} alt="Explanation" className="w-full h-auto object-cover" />
                  </div>
              )}
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
             <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-md border border-indigo-100 flex flex-col gap-2">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                  <span className="text-sm text-indigo-500 font-bold ml-1">Thinking & Drawing...</span>
               </div>
               <div className="h-32 w-48 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                   <SparklesIcon className="w-8 h-8 text-gray-300" />
               </div>
             </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-white border-t border-indigo-100">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a big question... (e.g. Why is grass green?)"
            className="flex-1 p-4 bg-gray-100 rounded-full border-2 border-transparent focus:border-indigo-400 focus:bg-white focus:outline-none text-lg transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95"
          >
            <SendIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
