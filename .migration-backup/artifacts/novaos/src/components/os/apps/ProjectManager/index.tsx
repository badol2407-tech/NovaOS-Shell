import React, { useState } from 'react';
import ProjectSidebar from './ProjectSidebar';
import KanbanBoard from './KanbanBoard';
import EmptyState from './EmptyState';

export default function ProjectManagerApp() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  return (
    <div className="flex h-full bg-background">
      <ProjectSidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
      />
      <div className="flex-1 min-w-0">
        {selectedProjectId === null ? (
          <EmptyState onCreated={setSelectedProjectId} />
        ) : (
          <KanbanBoard projectId={selectedProjectId} />
        )}
      </div>
    </div>
  );
}
