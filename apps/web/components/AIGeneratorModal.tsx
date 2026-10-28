import React, { useState } from 'react';
import { Sparkles, X, Loader2, Play, Globe, Feather } from 'lucide-react';
import { loadApiKey, saveApiKey, loadModel, saveModel } from '../utils/apiKey';
import { DEFAULT_MODEL, SUGGESTED_MODELS } from '../services/ai';

interface AIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, useSearch: boolean, apiKey: string, model: string) => Promise<void>;
  isGenerating: boolean;
}

export const AIGeneratorModal: React.FC<AIGeneratorModalProps> = ({ 
  isOpen, 
  onClose, 
  onGenerate,
  isGenerating 
}) => {
  const [prompt, setPrompt] = useState('');
  const [useSearch, setUseSearch] = useState(true);
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [model, setModel] = useState(() => loadModel() || DEFAULT_MODEL);

  if (!isOpen) return null;

  const handlePreset = (type: 'musk_trump') => {
    if (type === 'musk_trump') {
      const p = "Generate a narrative graph comparing Elon Musk and Donald Trump. Focus on INTERACTION: Find events where they met, argued, or collaborated (Merging/Branching). Don't just list separate events. Look for the 2024 Election endorsements, the Twitter reinstatement, and advisory councils. Use 'Entity' as the linking attribute.";
      setPrompt(p);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[600px] max-w-[90vw] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                <Sparkles className="w-4 h-4" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">AI Graph Generator</h2>
                <p className="text-xs text-slate-500">Powered by OpenRouter</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
             <button 
                onClick={() => setUseSearch(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${useSearch ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <Globe className="w-4 h-4" />
                Real News (Search)
             </button>
             <button 
                onClick={() => setUseSearch(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${!useSearch ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <Feather className="w-4 h-4" />
                Creative Fiction
             </button>
          </div>

          <div className="mb-4">
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Quick Presets
             </label>
             <div className="flex gap-2">
                <button 
                    onClick={() => handlePreset('musk_trump')}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-medium text-slate-700 hover:text-indigo-700 transition-all text-left"
                >
                    <span>🇺🇸 vs 🚀</span>
                    <span>Elon & Donald (Interactions)</span>
                </button>
             </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={useSearch 
                ? "e.g., Research the key interactions between Apple and Microsoft from 1980 to 2000..." 
                : "e.g., Create a story about three rival houses in a fantasy kingdom forming an alliance..."
              }
              className="w-full h-32 p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none bg-slate-50/30"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Model
              </label>
              <input
                type="text"
                list="ttng-models"
                value={model}
                onChange={(e) => { setModel(e.target.value); saveModel(e.target.value); }}
                autoComplete="off"
                spellCheck={false}
                placeholder="vendor/model"
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/30"
              />
              <datalist id="ttng-models">
                {SUGGESTED_MODELS.map((id) => <option key={id} value={id} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Your OpenRouter API key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); saveApiKey(e.target.value); }}
                autoComplete="off"
                placeholder="sk-or-..."
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/30"
              />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Any model id from openrouter.ai/models. The key stays in this browser tab and goes only to OpenRouter.
          </p>

          <div className="mt-4 bg-blue-50 text-blue-800 text-xs p-3 rounded border border-blue-100 flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
                {useSearch 
                    ? "AI will search for real events. To get branching/merging graphs, ask for 'shared events' or 'interactions'."
                    : "AI will invent a story. It works best if you explicitly ask for characters to 'meet' or 'conflict' across tracks."
                }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onGenerate(prompt, useSearch, apiKey, model)}
            disabled={!prompt.trim() || !apiKey.trim() || !model.trim() || isGenerating}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isGenerating ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                </>
            ) : (
                <>
                    <Play className="w-4 h-4 fill-current" />
                    Generate Graph
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};