
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Plus, X } from 'lucide-react';

interface MultiSelectDropdownProps {
  label?: string;
  selectedValues: string[];
  options: string[];
  onChange: (values: string[]) => void;
  onAdd: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  selectedValues,
  options,
  onChange,
  onAdd,
  placeholder = 'Select...',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleAddNew = () => {
      const trimmed = searchValue.trim();
      if (trimmed) {
          onAdd(trimmed);
          if (!selectedValues.includes(trimmed)) {
              onChange([...selectedValues, trimmed]);
          }
          setSearchValue('');
      }
  };

  const filteredOptions = options.filter(opt => 
      opt.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">{label}</label>}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[38px] flex items-center justify-between bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 cursor-pointer focus-within:ring-2 focus-within:ring-blue-100 transition-colors"
      >
        <div className="flex flex-wrap gap-1.5 pr-6 w-full">
            {selectedValues.length > 0 ? (
                selectedValues.map(v => (
                    <span key={v} className="bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1">
                        {v}
                        <span 
                            onClick={(e) => { e.stopPropagation(); toggleValue(v); }}
                            className="hover:text-red-500 cursor-pointer rounded-full hover:bg-slate-200 p-0.5 transition-colors"
                        >
                            <X className="w-2.5 h-2.5" />
                        </span>
                    </span>
                ))
            ) : (
                <span className="text-slate-400 pl-1">{placeholder}</span>
            )}
        </div>
        <ChevronDown className={`absolute right-3 w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 min-w-[220px] overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
             <div className="flex gap-2">
                <input 
                    type="text" 
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddNew(); }}
                    className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-all"
                    placeholder="Search or add..."
                    autoFocus
                />
                <button 
                    onClick={handleAddNew}
                    disabled={!searchValue.trim()}
                    className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
             </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-200">
            {filteredOptions.length === 0 && !searchValue && <div className="px-3 py-2 text-xs text-slate-400 italic text-center">Type to add new value</div>}
            
            {filteredOptions.map((option) => {
               const isSelected = selectedValues.includes(option);
               return (
                  <div
                    key={option}
                    onClick={() => toggleValue(option)}
                    className={`
                        flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 transition-colors
                    `}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={isSelected ? 'text-slate-900 font-medium' : 'text-slate-600'}>{option}</span>
                  </div>
               );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
