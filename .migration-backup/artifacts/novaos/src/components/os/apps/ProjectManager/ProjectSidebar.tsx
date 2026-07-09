import React, { useState } from 'react';
import { Plus, FolderKanban, Archive, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  useListProjects,
  useCreateProject,
  useDeleteProject,
  getListProjectsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'];

interface ProjectSidebarProps {
  selectedProjectId: number | null;
  onSelectProject: (id: number | null) => void;
}

export default function ProjectSidebar({ selectedProjectId, onSelectProject }: ProjectSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const queryClient = useQueryClient();
  const { data: projects = [] } = useListProjects();
  const createProject = useCreateProject({
    mutation: {
      onSuccess: (project) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setDialogOpen(false);
        setName('');
        setDescription('');
        onSelectProject(project.id);
      },
    },
  });
  const deleteProject = useDeleteProject({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        if (selectedProjectId === variables.id) {
          onSelectProject(null);
        }
      },
    },
  });

  const activeProjects = projects.filter(p => p.status === 'active');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  const handleCreate = () => {
    if (!name.trim()) return;
    createProject.mutate({ data: { name: name.trim(), description: description.trim() || undefined, color } });
  };

  return (
    <div className="w-64 shrink-0 border-r border-border/50 flex flex-col bg-muted/10">
      <div className="p-3 border-b border-border/50">
        <Button size="sm" className="w-full gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          New Project
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">
            Active
          </div>
          {activeProjects.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">No active projects yet.</div>
          )}
          {activeProjects.map(project => (
            <ProjectItem
              key={project.id}
              project={project}
              selected={selectedProjectId === project.id}
              onSelect={() => onSelectProject(project.id)}
              onDelete={() => deleteProject.mutate({ id: project.id })}
            />
          ))}

          {archivedProjects.length > 0 && (
            <>
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 mt-2 uppercase tracking-wide flex items-center gap-1.5">
                <Archive className="w-3 h-3" /> Archived
              </div>
              {archivedProjects.map(project => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  selected={selectedProjectId === project.id}
                  onSelect={() => onSelectProject(project.id)}
                  onDelete={() => deleteProject.mutate({ id: project.id })}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full transition-transform",
                      color === c && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || createProject.isPending}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectItem({
  project, selected, onSelect, onDelete,
}: {
  project: { id: number; name: string; color: string; taskCount: number };
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm transition-colors",
        selected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50",
      )}
      onClick={onSelect}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
      <span className="flex-1 truncate">{project.name}</span>
      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
        {project.taskCount}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
          <button className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded shrink-0">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
