
import React from 'react';
import { View } from '../types';
import { HomeIcon, GamepadIcon, BrainIcon, ShieldIcon, TvIcon } from './Icons';

interface LayoutProps {
  currentView: View;
  onNavigate: (view: View) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  const NavItem = ({ view, icon, label, color }: { view: View; icon: React.ReactNode; label: string; color: string }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => onNavigate(view)}
        className="group flex-1 h-full flex flex-col items-center justify-center relative touch-manipulation active:scale-95 transition-transform duration-200"
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
      >
        <div className={`
          relative z-10 p-3 rounded-2xl transition-all duration-300 ease-out
          ${isActive 
            ? `${color} shadow-lg -translate-y-2 scale-110 ring-4 ring-white` 
            : 'bg-transparent hover:bg-slate-100'
          }
        `}>
          <div className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
            {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { 
              className: `w-7 h-7 stroke-[2.5px] ${isActive ? 'animate-bounce-short' : ''}` 
            })}
          </div>
        </div>
        <span className={`
          text-[11px] font-bold mt-1 transition-all duration-300
          ${isActive ? 'text-slate-900 translate-y-[-4px] opacity-100' : 'text-slate-400 opacity-80'}
        `}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-slate-50 overflow-hidden relative">
      {/* Main Content Area - Safe area top is handled by children if needed */}
      <main className="flex-1 relative overflow-hidden flex flex-col w-full max-w-lg mx-auto md:max-w-none bg-slate-50">
        {children}
      </main>

      {/* Bottom Navigation - Fixed Height + Safe Area */}
      {/* pb-[env(safe-area-inset-bottom)] ensures compatibility with iPhone Home Indicator */}
      <nav className="shrink-0 bg-white border-t border-slate-200 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="h-[80px] w-full max-w-3xl mx-auto flex justify-between items-stretch px-2">
          <NavItem 
            view={View.FEED} 
            icon={<HomeIcon />} 
            label="Home" 
            color="bg-blue-500" 
          />
           <NavItem 
            view={View.TV} 
            icon={<TvIcon />} 
            label="TV" 
            color="bg-red-500" 
          />
          <NavItem 
            view={View.GAMES} 
            icon={<GamepadIcon />} 
            label="Play" 
            color="bg-pink-500" 
          />
          <NavItem 
            view={View.CHAT} 
            icon={<BrainIcon />} 
            label="Ask" 
            color="bg-indigo-600" 
          />
          <NavItem 
            view={View.PARENTS} 
            icon={<ShieldIcon />} 
            label="Parents" 
            color="bg-slate-700" 
          />
        </div>
      </nav>
    </div>
  );
};
