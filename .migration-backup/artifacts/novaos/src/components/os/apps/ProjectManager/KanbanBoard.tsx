import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import {
  useGetProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getGetProjectQueryKey,
  getListProjectsQueryKey,
} from '@workspace/api-client-react';
import type { Task } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import TaskCard from './TaskCard';
import TaskDialog from './TaskDialog';

const COLUMNS: { status: Task['status']; label: string; accent: string }[] = [
  { status: 'todo', label: 'To Do', accent: 'bg-slate-400' },
  { status: 'in_progress', label: 'In Progress', accent: 'bg-amber-400' },
  { status: 'done', label: 'Done', accent: 'bg-emerald-400' },
];

export default function KanbanBoard({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useGetProject(projectId);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Task['status'] | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<Task['status']>('todo');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };

  const updateTask = useUpdateTask({ mutation: { onSuccess: invalidate } });
  const deleteTask = useDeleteTask({ mutation: { onSuccess: invalidate } });

  if (isLoading || !project) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tasksByStatus = (status: Task['status']) =>
    project.tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position);

  const handleDrop = (status: Task['status'], e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId = Number(e.dataTransfer.getData('taskId'));
    const task = project.tasks.find(t => t.id === taskId);
    if (!task || task.status === status) return;

    const targetTasks = tasksByStatus(status);
    updateTask.mutate({
      id: projectId,
      taskId,
      data: { status, position: targetTasks.length },
    });
  };

  const openNewTask = (status: Task['status']) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 shrink-0">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <div>
          <h2 className="font-semibold text-lg leading-tight">{project.name}</h2>
          {project.description && (
            <p className="text-sm text-muted-foreground leading-tight mt-0.5">{project.description}</p>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0 flex gap-4 p-4 overflow-x-auto">
        {COLUMNS.map(col => {
          const tasks = tasksByStatus(col.status);
          return (
            <div
              key={col.status}
              className="flex flex-col w-72 shrink-0 bg-muted/20 rounded-lg"
              onDragOver={e => { e.preventDefault(); setDragOverStatus(col.status); }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={e => handleDrop(col.status, e)}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.accent}`} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs text-muted-foreground">{tasks.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => openNewTask(col.status)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div
                className={`flex-1 min-h-[100px] px-2 pb-2 space-y-2 overflow-y-auto rounded-md transition-colors ${
                  dragOverStatus === col.status ? 'bg-primary/5 ring-1 ring-primary/30' : ''
                }`}
              >
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => openEditTask(task)}
                    onDelete={() => deleteTask.mutate({ id: projectId, taskId: task.id })}
                  />
                ))}
                {tasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        projectId={projectId}
        task={editingTask}
        defaultStatus={defaultStatus}
        onSaved={invalidate}
      />
    </div>
  );
}
