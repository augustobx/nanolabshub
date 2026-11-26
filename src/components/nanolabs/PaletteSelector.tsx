'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, X } from 'lucide-react';
import { PALETTES } from './palettes';
import { useERPTheme } from './ThemeContext';

export function PaletteSelector() {
  const { palette, setPalette } = useERPTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-xs cursor-pointer"
        title="Elegir paleta de color del sistema"
      >
        <span
          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10"
          style={{ background: palette.gradient }}
        />
        <span className="hidden sm:inline text-xs">{palette.badge}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Paleta de color
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-1">
            {Object.values(PALETTES).map((p) => {
              const active = p.id === palette.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPalette(p.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-xs ring-2 ring-white/50 dark:ring-slate-900"
                      style={{ background: p.gradient }}
                    />
                    <span>{p.name}</span>
                  </div>
                  {active && <Check size={14} className="text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
