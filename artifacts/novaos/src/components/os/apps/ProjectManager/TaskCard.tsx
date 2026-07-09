import React from 'react';
import { Calendar, Trash2, GripVertical } from 'lucide-react';
import type { Task } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  low: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  high: 'bg-red-500/10 text-red-600 border-red-500/20',
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDelete: () => void;
}

export default function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = dueDate && isPast(dueDate) && !isToday(dueDate) && task.status !== 'done';

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('taskId', String(task.id))}
      onClick={onClick}
      className="group bg-card border border-border/60 rounded-md p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 capitalize", PRIORITY_STYLES[task.priority])}>
          {task.priority}
        </Badge>
        {dueDate && (
          <span className={cn(
            "flex items-center gap-1 text-[11px]",
            overdue ? "text-destructive font-medium" : "text-muted-foreground",
          )}>
            <Calendar className="w-3 h-3" />
            {format(dueDate, 'MMM d')}
          </span>
        )}
      </div>
    </div>
  );
}
