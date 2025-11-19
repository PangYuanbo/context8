import React, { useState } from 'react';
import { LIBRARIES } from '../constants';
import { Search, Star, TrendingUp, Clock, CheckCircle2, Github, Globe } from 'lucide-react';

export const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'popular' | 'trending' | 'recent'>('popular');

  return (
    <div className="flex flex-col items-start gap-8 w-full">
      {/* Hero Section */}
      <div className="w-full pt-8 pb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-emerald-900 mb-3 tracking-tight">
          Up-to-date Docs
          <br />
          <span className="text-emerald-700/80 font-medium">for LLMs and AI code editors</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl">
          Copy latest docs & code — paste into Cursor, Claude, or other LLMs
        </p>
      </div>

      {/* Search Section */}
      <div className="w-full flex gap-3 max-w-3xl">
        <div className="relative flex-grow">
          <input 
            type="text" 
            placeholder="Search a library (e.g. Next, React)" 
            className="w-full pl-4 pr-4 py-3 rounded-lg border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-700 placeholder-gray-400"
          />
        </div>
        <div className="flex items-center justify-center text-gray-400 font-medium px-2">or</div>
        <button className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium shadow-sm transition-colors whitespace-nowrap">
          Chat with Docs
        </button>
      </div>

      {/* Tabs */}
      <div className="w-full mt-4">
        <div className="flex items-center gap-6 border-b border-gray-100 pb-px mb-6">
          <button 
            onClick={() => setActiveTab('popular')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === 'popular' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Star size={14} />
            Popular
            {activeTab === 'popular' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-t-full"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('trending')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === 'trending' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <TrendingUp size={14} />
            Trending
            {activeTab === 'trending' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-t-full"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === 'recent' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Clock size={14} />
            Recent
            {activeTab === 'recent' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-t-full"></span>}
          </button>
        </div>

        {/* Library Table */}
        <div className="overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/30 text-xs uppercase text-gray-400 font-semibold tracking-wider">
                <th className="py-4 px-6 w-1/4">Source</th>
                <th className="py-4 px-6"></th>
                <th className="py-4 px-6 text-right">Tokens</th>
                <th className="py-4 px-6 text-right">Snippets</th>
                <th className="py-4 px-6 text-right">Update</th>
                <th className="py-4 px-6 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {LIBRARIES.map((lib, idx) => (
                <tr key={idx} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {/* Name Link */}
                      <a href="#" className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline decoration-emerald-300 underline-offset-2">
                        {lib.name}
                      </a>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-500 text-sm">
                    <div className="flex items-center gap-2">
                        {lib.source.includes('github') || !lib.source.includes('.') ? <Github size={14} className="text-gray-400" /> : <Globe size={14} className="text-gray-400" />}
                        <span className="truncate max-w-[200px]">{lib.source}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right text-gray-600 text-sm font-medium">{lib.tokens}</td>
                  <td className="py-4 px-6 text-right text-gray-600 text-sm font-medium">{lib.snippets}</td>
                  <td className="py-4 px-6 text-right text-gray-500 text-sm">{lib.update}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex justify-center">
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="w-full bg-gray-50/30 py-3 text-center border-t border-gray-100">
            <div className="text-xs text-gray-400 flex items-center justify-between px-6">
                <span>53,828 LIBRARIES</span>
                <a href="#" className="hover:text-emerald-600 flex items-center gap-1">SEE TASKS IN PROGRESS →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};