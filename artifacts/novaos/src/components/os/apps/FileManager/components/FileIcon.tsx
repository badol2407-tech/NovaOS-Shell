import React from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Code2,
  File,
  FileSpreadsheet,
  Presentation,
  Database,
} from 'lucide-react';
import { VFSNode } from '../types';
import { cn } from '@/lib/utils';

interface FileIconProps {
  node: VFSNode;
  size?: number;
  isOpen?: boolean;
  className?: string;
}

function getIconColor(node: VFSNode): string {
  if (node.type === 'folder') {
    return node.color ?? 'text-sky-400';
  }
  switch (node.mimeCategory) {
    case 'image':   return 'text-pink-400';
    case 'video':   return 'text-purple-400';
    case 'audio':   return 'text-emerald-400';
    case 'document':return 'text-blue-400';
    case 'archive': return 'text-amber-400';
    case 'code':    return 'text-cyan-400';
    default:        return 'text-zinc-400';
  }
}

function getIconComponent(node: VFSNode, isOpen = false) {
  if (node.type === 'folder') return isOpen ? FolderOpen : Folder;
  switch (node.mimeCategory) {
    case 'image':    return Image;
    case 'video':    return Film;
    case 'audio':    return Music;
    case 'archive':  return Archive;
    case 'code':     return Code2;
    case 'document': {
      const m = node.mimeType;
      if (m.includes('excel') || m.includes('spreadsheet') || m === 'text/csv') return FileSpreadsheet;
      if (m.includes('powerpoint') || m.includes('presentation')) return Presentation;
      return FileText;
    }
    default:         return File;
  }
}

export function FileIcon({ node, size = 20, isOpen = false, className }: FileIconProps) {
  const Icon = getIconComponent(node, isOpen);
  const color = getIconColor(node);
  return <Icon size={size} className={cn(color, className)} strokeWidth={1.5} />;
}
