

import React from 'react';
import { View } from '../types';
import { HomeIcon, GamepadIcon, BrainIcon, ShieldIcon, TvIcon } from './Icons';

interface LayoutProps {
  currentView: View;
  onNavigate: (view: View) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  const NavItem = ({ view, icon, label, color }: { view: View; icon: React.ReactNode; label: string; color: string }) => (
    <button
      onClick={() => onNavigate(view)}
      className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
        currentView === view ? 'translate-y-[-8px]' : 'opacity-60'
      }`}
    >
      <div className={`p-3 rounded-2xl shadow-lg mb-1 ${currentView === view ? color : 'bg-gray-200 text-gray-500'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold ${currentView === view ? 'text-gray-800' : 'text-gray-400'}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-20 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
        <div className="h-full max-w-lg mx-auto flex justify-between items-center px-2">
          <NavItem 
            view={View.FEED} 
            icon={<HomeIcon className="w-6 h-6 text-white" />} 
            label="Home" 
            color="bg-blue-500" 
          />
           <NavItem 
            view={View.TV} 
            icon={<TvIcon className="w-6 h-6 text-white" />} 
            label="LearnTV" 
            color="bg-red-500" 
          />
          <NavItem 
            view={View.GAMES} 
            icon={<GamepadIcon className="w-6 h-6 text-white" />} 
            label="Games" 
            color="bg-pink-500" 
          />
          <NavItem 
            view={View.CHAT} 
            icon={<BrainIcon className="w-6 h-6 text-white" />} 
            label="Ask Hoot" 
            color="bg-indigo-600" 
          />
          <NavItem 
            view={View.PARENTS} 
            icon={<ShieldIcon className="w-6 h-6 text-white" />} 
            label="Parents" 
            color="bg-slate-700" 
          />
        </div>
      </nav>
    </div>
  );
};
