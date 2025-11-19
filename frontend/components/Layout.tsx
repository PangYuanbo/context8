import React, { useState } from 'react';
import { 
  ChevronDown, 
  Plus, 
  Terminal, 
  Bug, 
  X as XIcon, // Renamed to avoid confusion if needed, but lucide exports X for close icon usually. Using basic svg for Twitter X.
  ExternalLink,
  Github
} from 'lucide-react';
import { View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#ecfdf5] to-white text-slate-800 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-sm bg-opacity-80 border-b border-emerald-100/50 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div 
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:border-emerald-300 transition-colors shadow-sm"
            onClick={() => onViewChange('home')}
          >
            <div className="bg-black rounded-sm p-0.5">
               <Terminal size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm">Context7</span>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-gray-100/50 rounded-md px-3 py-1.5 text-sm border border-transparent hover:border-gray-200 cursor-pointer transition-colors">
            <span className="text-gray-600">Personal</span>
            <ChevronDown size={14} className="text-gray-400" />
            <span 
                className={`ml-2 text-gray-400 hover:text-emerald-600 transition-colors ${currentView === 'dashboard' ? 'text-emerald-600 font-medium' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onViewChange('dashboard');
                }}
            >
                Dashboard
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <nav className="hidden md:flex items-center gap-6 text-gray-500 font-medium">
            <a href="#" className="hover:text-emerald-600 transition-colors decoration-emerald-500/30 hover:underline underline-offset-4">Plans</a>
            <a href="#" className="hover:text-emerald-600 transition-colors decoration-emerald-500/30 hover:underline underline-offset-4">Learn</a>
            <a href="#" className="hover:text-emerald-600 transition-colors decoration-emerald-500/30 hover:underline underline-offset-4">Try Live</a>
            <a href="#" className="hover:text-emerald-600 transition-colors decoration-emerald-500/30 hover:underline underline-offset-4">Install</a>
          </nav>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-200">
            <Plus size={16} />
            Add Docs
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-auto border-t border-gray-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>© 2025, Context7 is an <a href="#" className="underline decoration-gray-300 hover:text-gray-800">Upstash</a> project</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-emerald-600 transition-colors">About</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Contact</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Legal</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Follow on X</a>
          </div>
        </div>
      </footer>

      {/* Floating Action Button */}
      <button className="fixed bottom-6 right-6 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-transform hover:-translate-y-1 z-50">
        <Bug size={16} />
        Report Issue
      </button>
    </div>
  );
};