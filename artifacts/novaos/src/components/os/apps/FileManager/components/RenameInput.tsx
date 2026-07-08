import React, { useEffect, useRef, useState } from 'react';
import { useFileManager } from '../FileManagerProvider';

interface RenameInputProps {
  id: string;
  initialName: string;
  onDone?: () => void;
  className?: string;
}

export function RenameInput({ id, initialName, onDone, className }: RenameInputProps) {
  const { renameItem } = useFileManager();
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Select name without extension
    const dotIdx = initialName.lastIndexOf('.');
    if (dotIdx > 0) {
      input.setSelectionRange(0, dotIdx);
    } else {
      input.select();
    }
  }, [initialName]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      renameItem(id, trimmed);
    } else {
      renameItem(id, initialName); // triggers SET_RENAMING null without rename
    }
    onDone?.();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      renameItem(id, initialName);
      onDone?.();
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onClick={e => e.stopPropagation()}
      className={`bg-background border border-primary rounded px-1 text-sm text-foreground outline-none ring-1 ring-primary w-full min-w-0 ${className ?? ''}`}
    />
  );
}
