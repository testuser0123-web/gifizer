'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun, faFilm } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return (
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faFilm} className="text-white text-sm sm:text-lg" />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">Gifizer</h1>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faFilm} className="text-white text-sm sm:text-lg" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">Gifizer</h1>
            <span className="text-xs sm:text-sm text-secondary hidden md:block">
              動画をGIFに変換
            </span>
          </div>
          
          <button
            onClick={toggleTheme}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-muted hover:bg-muted-dark transition-colors flex items-center justify-center"
            aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
          >
            <FontAwesomeIcon 
              icon={theme === 'dark' ? faSun : faMoon} 
              className="text-foreground text-sm sm:text-base"
            />
          </button>
        </div>
      </div>
    </header>
  );
}