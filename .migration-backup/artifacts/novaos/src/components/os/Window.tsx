import React, { useState, useEffect, useRef } from 'react';
import { useOS, WindowState } from './OSProvider';
import { X, Minus, Square, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WindowProps {
  window: WindowState;
  children: React.ReactNode;
}

export function Window({ window: win, children }: WindowProps) {
  const { focusWindow, closeWindow, minimizeWindow, maximizeWindow, restoreWindow, updateWindowBounds, activeWindowId } = useOS();
  const isActive = activeWindowId === win.id;
  
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);

  // Drag logic
  const handleTitleBarPointerDown = (e: React.PointerEvent) => {
    if (win.isMaximized) return;
    if ((e.target as HTMLElement).closest('button')) return; // Ignore window controls
    
    setIsDragging(true);
    focusWindow(win.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...win.position };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateWindowBounds(win.id, {
        position: {
          x: startPos.x + (moveEvent.clientX - startX),
          y: Math.max(0, startPos.y + (moveEvent.clientY - startY)) // Prevent dragging above screen
        }
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsDragging(false);
      (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Resize logic
  const handleResizePointerDown = (e: React.PointerEvent, handle: string) => {
    if (win.isMaximized) return;
    e.stopPropagation();
    setIsResizing(handle);
    focusWindow(win.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...win.position };
    const startSize = { ...win.size };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = startPos.x;
      let newY = startPos.y;
      let newW = startSize.width;
      let newH = startSize.height;

      if (handle.includes('e')) newW = Math.max(300, startSize.width + deltaX);
      if (handle.includes('w')) {
        const potentialW = startSize.width - deltaX;
        if (potentialW >= 300) {
          newW = potentialW;
          newX = startPos.x + deltaX;
        }
      }
      if (handle.includes('s')) newH = Math.max(200, startSize.height + deltaY);
      if (handle.includes('n')) {
        const potentialH = startSize.height - deltaY;
        if (potentialH >= 200) {
          newH = potentialH;
          newY = startPos.y + deltaY;
        }
      }

      updateWindowBounds(win.id, {
        position: { x: newX, y: Math.max(0, newY) },
        size: { width: newW, height: newH }
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsResizing(null);
      (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  if (win.isMinimized) return null;

  const style: React.CSSProperties = win.isMaximized ? {
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: win.zIndex,
    borderRadius: 0,
  } : {
    top: win.position.y,
    left: win.position.x,
    width: win.size.width,
    height: win.size.height,
    zIndex: win.zIndex,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      ref={windowRef}
      onPointerDown={() => focusWindow(win.id)}
      style={style}
      className={cn(
        "absolute flex flex-col overflow-hidden bg-card/80 backdrop-blur-xl border-border/50",
        "shadow-2xl transition-shadow",
        win.isMaximized ? "border-0" : "border rounded-xl",
        isActive ? "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-border/80" : "shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)]"
      )}
    >
      {/* Title bar */}
      <div 
        className={cn(
          "flex items-center h-12 px-4 select-none shrink-0 border-b border-border/30",
          "bg-gradient-to-b from-white/10 to-transparent dark:from-white/5",
          isActive ? "opacity-100" : "opacity-80"
        )}
        onPointerDown={handleTitleBarPointerDown}
        onDoubleClick={() => win.isMaximized ? restoreWindow(win.id) : maximizeWindow(win.id)}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden pointer-events-none">
          {win.icon ? (
            <img src={win.icon} className="w-5 h-5 rounded-sm object-cover" alt="" />
          ) : (
            <div className="w-5 h-5 rounded-sm bg-primary/20 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-primary rounded-sm" />
            </div>
          )}
          <span className="font-semibold text-sm truncate">{win.title}</span>
        </div>

        <div className="flex items-center gap-1.5 ml-4 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); minimizeWindow(win.id); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              win.isMaximized ? restoreWindow(win.id) : maximizeWindow(win.id); 
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            {win.isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-background/50 relative">
        {children}
        {(!isActive) && (
          <div className="absolute inset-0 z-50 pointer-events-none bg-background/5" />
        )}
      </div>

      {/* Resize handles */}
      {!win.isMaximized && (
        <>
          <div className="absolute top-0 left-0 w-full h-1 cursor-n-resize" onPointerDown={e => handleResizePointerDown(e, 'n')} />
          <div className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize" onPointerDown={e => handleResizePointerDown(e, 's')} />
          <div className="absolute top-0 left-0 w-1 h-full cursor-w-resize" onPointerDown={e => handleResizePointerDown(e, 'w')} />
          <div className="absolute top-0 right-0 w-2 h-full cursor-e-resize" onPointerDown={e => handleResizePointerDown(e, 'e')} />
          <div className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize z-10" onPointerDown={e => handleResizePointerDown(e, 'nw')} />
          <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-10" onPointerDown={e => handleResizePointerDown(e, 'ne')} />
          <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-10" onPointerDown={e => handleResizePointerDown(e, 'sw')} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" onPointerDown={e => handleResizePointerDown(e, 'se')} />
        </>
      )}
    </motion.div>
  );
}
