
import React, { useState, useEffect } from 'react';
import { searchCurriculum, generateParentInsights } from '../services/gemini';
import { GroundingChunk, ParentSettings, ActivityLog } from '../types';
import { ShieldIcon, BrainIcon, SparklesIcon } from './Icons';

// Mock initial activity log if none exists
const MOCK_LOGS: ActivityLog[] = [
    { id: '1', type: 'video', details: 'Watched "Why is the sky blue?"', timestamp: Date.now() - 100000, category: 'Science' },
    { id: '2', type: 'chat', details: 'Asked "Do T-Rex sleep?"', timestamp: Date.now() - 200000, category: 'Animals' },
    { id: '3', type: 'create', details: 'Drew a picture of a robot', timestamp: Date.now() - 300000, category: 'Creativity' },
    { id: '4', type: 'video', details: 'Watched "Counting Stars"', timestamp: Date.now() - 400000, category: 'Math' },
    { id: '5', type: 'fact', details: 'Learned about Octopus hearts', timestamp: Date.now() - 500000, category: 'Animals' },
];

export const ParentZone: React.FC = () => {
  // Lock State
  const [isLocked, setIsLocked] = useState(true);
  const [inputPin, setInputPin] = useState('');
  
  // Settings State
  const [settings, setSettings] = useState<ParentSettings>({
      pin: '0000',
      childName: 'Kiddo',
      childAge: 5,
      focusTopics: []
  });

  // Insights State
  const [activeTab, setActiveTab] = useState<'INSIGHTS' | 'SETTINGS' | 'SEARCH'>('INSIGHTS');
  const [insightText, setInsightText] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  
  // Search State
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string>('');
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    // Load settings from local storage
    const savedSettings = localStorage.getItem('parent_settings');
    if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
    }
    // Generate initial insight
    setLoadingInsight(true);
    generateParentInsights(MOCK_LOGS, savedSettings ? JSON.parse(savedSettings) : settings)
        .then(setInsightText)
        .finally(() => setLoadingInsight(false));
  }, []);

  const handlePinInput = (num: string) => {
      const newPin = inputPin + num;
      setInputPin(newPin);
      if (newPin.length === 4) {
          if (newPin === settings.pin) {
              setIsLocked(false);
              setInputPin('');
          } else {
              alert("Incorrect PIN");
              setInputPin('');
          }
      }
  };

  const handleSaveSettings = () => {
      localStorage.setItem('parent_settings', JSON.stringify(settings));
      alert("Settings Saved! The app will now customize content for " + settings.childName);
      // Refresh insights with new name/age
      setLoadingInsight(true);
      generateParentInsights(MOCK_LOGS, settings).then(setInsightText).finally(() => setLoadingInsight(false));
  };

  const toggleTopic = (topic: string) => {
      setSettings(prev => {
          const exists = prev.focusTopics.includes(topic);
          return {
              ...prev,
              focusTopics: exists 
                 ? prev.focusTopics.filter(t => t !== topic)
                 : [...prev.focusTopics, topic]
          };
      });
  };

  const handleSearch = async () => {
    if (!query) return;
    setLoadingSearch(true);
    setResult('');
    setSources([]);

    try {
      const data = await searchCurriculum(query);
      setResult(data.text || '');
      setSources(data.sources || []);
    } catch (error) {
      setResult("Sorry, I couldn't verify that information right now.");
    }
    setLoadingSearch(false);
  };

  if (isLocked) {
      return (
          <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
              <ShieldIcon className="w-16 h-16 text-slate-400 mb-6" />
              <h2 className="text-2xl font-bold mb-8">Parent Zone Locked</h2>
              <div className="flex gap-4 mb-8">
                  {[0,1,2,3].map(i => (
                      <div key={i} className={`w-4 h-4 rounded-full ${inputPin.length > i ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                  ))}
              </div>
              <div className="grid grid-cols-3 gap-6">
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                      <button key={num} onClick={() => handlePinInput(num.toString())} className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 text-2xl font-bold transition-colors">{num}</button>
                  ))}
                  <div className="w-16 h-16"></div>
                  <button onClick={() => handlePinInput('0')} className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 text-2xl font-bold transition-colors">0</button>
                  <button onClick={() => setInputPin('')} className="w-16 h-16 flex items-center justify-center text-sm font-bold text-slate-500">CLR</button>
              </div>
              <p className="mt-8 text-slate-500 text-xs">Default PIN: 0000</p>
          </div>
      );
  }

  return (
    <div className="h-full bg-slate-100 flex flex-col">
        {/* Header */}
        <div className="bg-white p-4 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-2">
                 <ShieldIcon className="w-6 h-6 text-slate-700" />
                 <h2 className="font-bold text-slate-800">Dashboard</h2>
             </div>
             <button onClick={() => setIsLocked(true)} className="text-xs font-bold text-red-500 border border-red-200 px-3 py-1 rounded-full">LOCK</button>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border-b border-slate-200">
            <button onClick={() => setActiveTab('INSIGHTS')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'INSIGHTS' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Insights</button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'SETTINGS' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Controls</button>
            <button onClick={() => setActiveTab('SEARCH')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'SEARCH' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Fact Check</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
            
            {activeTab === 'INSIGHTS' && (
                <div className="space-y-6">
                    {/* Weekly Report Card */}
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <SparklesIcon className="w-5 h-5 text-yellow-300" />
                            <h3 className="font-bold text-lg">Weekly AI Report</h3>
                        </div>
                        {loadingInsight ? (
                            <p className="animate-pulse opacity-80">Analyzing learning patterns...</p>
                        ) : (
                            <p className="leading-relaxed opacity-95 text-sm md:text-base">{insightText}</p>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4">Topic Breakdown</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Science & Nature', val: 65, color: 'bg-green-500' },
                                { label: 'Creativity', val: 40, color: 'bg-pink-500' },
                                { label: 'Logic & Math', val: 25, color: 'bg-blue-500' },
                            ].map(stat => (
                                <div key={stat.label}>
                                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                        <span>{stat.label}</span>
                                        <span>{stat.val}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${stat.color}`} style={{ width: `${stat.val}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Logs */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4">Recent Activity</h3>
                        <div className="space-y-3">
                            {MOCK_LOGS.map(log => (
                                <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold 
                                        ${log.type === 'video' ? 'bg-red-100 text-red-600' : 
                                          log.type === 'chat' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                        {log.type[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-700">{log.details}</p>
                                        <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleTimeString()} • {log.category}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'SETTINGS' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4">Child Profile</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">NAME</label>
                                <input 
                                    type="text" 
                                    value={settings.childName} 
                                    onChange={(e) => setSettings({...settings, childName: e.target.value})}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">AGE</label>
                                <input 
                                    type="number" 
                                    value={settings.childAge} 
                                    onChange={(e) => setSettings({...settings, childAge: parseInt(e.target.value)})}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-2">Focus Topics</h3>
                        <p className="text-xs text-slate-500 mb-4">Select topics you want the AI to prioritize in the feed.</p>
                        <div className="flex flex-wrap gap-2">
                            {['Math', 'Science', 'Kindness', 'Animals', 'Space', 'Art', 'Reading', 'Dinosaurs'].map(topic => (
                                <button 
                                    key={topic}
                                    onClick={() => toggleTopic(topic)}
                                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                        settings.focusTopics.includes(topic) 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {topic}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4">Security</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">CHANGE PIN</label>
                            <input 
                                type="text" 
                                maxLength={4}
                                value={settings.pin} 
                                onChange={(e) => setSettings({...settings, pin: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 tracking-widest"
                            />
                        </div>
                    </div>

                    <button onClick={handleSaveSettings} className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform">Save Changes</button>
                </div>
            )}

            {activeTab === 'SEARCH' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                        <h3 className="font-bold text-lg mb-2">Fact Checker</h3>
                        <p className="text-slate-500 mb-4 text-sm">Verify facts or find educational resources using Google Search Grounding.</p>
                        
                        <div className="flex gap-2">
                            <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g. Best montessori activities..."
                            className="flex-1 border p-3 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                            />
                            <button 
                            onClick={handleSearch}
                            disabled={loadingSearch}
                            className="bg-slate-800 text-white px-6 rounded-lg font-bold disabled:opacity-50"
                            >
                            {loadingSearch ? '...' : 'Search'}
                            </button>
                        </div>
                    </div>

                    {result && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="prose prose-slate">
                            <h4 className="font-bold text-lg">AI Answer</h4>
                            <p className="whitespace-pre-wrap text-slate-700 text-sm">{result}</p>
                            </div>

                            {sources.length > 0 && (
                            <div className="border-t pt-4 mt-4">
                                <h4 className="font-bold text-sm text-slate-500 uppercase mb-2">Sources</h4>
                                <ul className="space-y-2">
                                {sources.map((source, idx) => (
                                    source.web?.uri && (
                                    <li key={idx}>
                                        <a 
                                        href={source.web.uri} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center gap-2 text-blue-600 hover:underline bg-blue-50 p-2 rounded-lg text-sm truncate"
                                        >
                                        <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-[10px]">🔗</span>
                                        {source.web.title || source.web.uri}
                                        </a>
                                    </li>
                                    )
                                ))}
                                </ul>
                            </div>
                            )}
                        </div>
                    )}
                </div>
            )}

        </div>
    </div>
  );
};
