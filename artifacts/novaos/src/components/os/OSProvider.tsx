import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type WindowState = {
  id: string;
  appId: string;
  title: string;
  icon: string;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
};

interface OSContextType {
  windows: WindowState[];
  activeWindowId: string | null;
  openWindow: (appId: string, title: string, icon: string, opts?: { allowMultiple?: boolean }) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: Partial<{ position: { x: number, y: number }, size: { width: number, height: number } }>) => void;
  
  isStartMenuOpen: boolean;
  toggleStartMenu: () => void;
  closeStartMenu: () => void;

  isNotificationCenterOpen: boolean;
  toggleNotificationCenter: () => void;
  closeNotificationCenter: () => void;
}

const OSContext = createContext<OSContextType | undefined>(undefined);

let nextZIndex = 10;
const INITIAL_WIDTH = 800;
const INITIAL_HEIGHT = 600;

/**
 * Apps in this set may open multiple simultaneous windows.
 * All other apps deduplicate: opening an already-open app focuses its existing window.
 */
const MULTI_INSTANCE_APPS = new Set(['files']);

export function OSProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  const focusWindow = useCallback((id: string) => {
    nextZIndex += 1;
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w));
    setActiveWindowId(id);
    setIsStartMenuOpen(false);
    setIsNotificationCenterOpen(false);
  }, []);

  const openWindow = useCallback((
    appId: string,
    title: string,
    icon: string,
    opts?: { allowMultiple?: boolean }
  ) => {
    const multiInstance = opts?.allowMultiple ?? MULTI_INSTANCE_APPS.has(appId);

    setWindows(prev => {
      // Single-instance apps: focus the existing window if open
      if (!multiInstance) {
        const existing = prev.find(w => w.appId === appId);
        if (existing) {
          // Use setTimeout to avoid state update during render cycle
          setTimeout(() => focusWindow(existing.id), 0);
          return prev;
        }
      }
      
      const newId = `win_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      nextZIndex += 1;
      
      // Cascade new windows so they don't stack exactly on top of each other
      const offset = (prev.length % 8) * 30;
      
      const newWin: WindowState = {
        id: newId,
        appId,
        title,
        icon,
        isMinimized: false,
        isMaximized: false,
        position: { x: 100 + offset, y: 80 + offset },
        size: { width: INITIAL_WIDTH, height: INITIAL_HEIGHT },
        zIndex: nextZIndex
      };
      
      setActiveWindowId(newId);
      setIsStartMenuOpen(false);
      return [...prev, newWin];
    });
  }, [focusWindow]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    setActiveWindowId(prevId => prevId === id ? null : prevId);
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    setActiveWindowId(prevId => prevId === id ? null : prevId);
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    focusWindow(id);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: true } : w));
  }, [focusWindow]);

  const restoreWindow = useCallback((id: string) => {
    focusWindow(id);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: false } : w));
  }, [focusWindow]);

  const updateWindowBounds = useCallback((id: string, bounds: Partial<{ position: { x: number, y: number }, size: { width: number, height: number } }>) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...bounds } : w));
  }, []);

  const toggleStartMenu = useCallback(() => {
    setIsStartMenuOpen(prev => !prev);
    if (!isStartMenuOpen) setIsNotificationCenterOpen(false);
  }, [isStartMenuOpen]);

  const closeStartMenu = useCallback(() => setIsStartMenuOpen(false), []);

  const toggleNotificationCenter = useCallback(() => {
    setIsNotificationCenterOpen(prev => !prev);
    if (!isNotificationCenterOpen) setIsStartMenuOpen(false);
  }, [isNotificationCenterOpen]);

  const closeNotificationCenter = useCallback(() => setIsNotificationCenterOpen(false), []);

  return (
    <OSContext.Provider value={{
      windows, activeWindowId,
      openWindow, closeWindow, minimizeWindow, maximizeWindow, restoreWindow, focusWindow, updateWindowBounds,
      isStartMenuOpen, toggleStartMenu, closeStartMenu,
      isNotificationCenterOpen, toggleNotificationCenter, closeNotificationCenter
    }}>
      {children}
    </OSContext.Provider>
  );
}

export function useOS() {
  const context = useContext(OSContext);
  if (!context) throw new Error('useOS must be used within OSProvider');
  return context;
}
