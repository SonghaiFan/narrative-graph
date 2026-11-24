
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react';

interface DropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAdd?: () => void;
  onDelete?: (option: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  onAdd,
  onDelete,
  placeholder = 'Select...',
  className = '',
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wider">{label}</label>}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-neutral-200 hover:border-neutral-300 rounded px-3 py-1.5 text-sm font-medium text-neutral-800 focus:outline-none transition-colors"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 min-w-[180px]">
          <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-neutral-200">
            {options.map((option) => (
              <div
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`
                    group flex items-center justify-between px-3 py-2 cursor-pointer text-sm
                    ${option === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-neutral-700 hover:bg-neutral-50'}
                `}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                    {option === value && <Check className="w-3.5 h-3.5 shrink-0" />}
                    <span className={option === value ? '' : 'pl-5.5'}>{option}</span>
                </div>
                
                {onDelete && options.length > 1 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(option);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Delete option"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
              </div>
            ))}
            
            {onAdd && (
                <div 
                    onClick={() => {
                        onAdd();
                        setIsOpen(false);
                    }}
                    className="border-t border-neutral-100 mt-1 px-3 py-2 flex items-center gap-2 text-sm text-blue-600 font-medium hover:bg-blue-50 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    <span>Create New...</span>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
