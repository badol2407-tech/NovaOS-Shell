import React from 'react';
import { FolderKanban } from 'lucide-react';

export default function EmptyState({ onCreated }: { onCreated: (id: number) => void }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <FolderKanban className="w-8 h-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No project selected</h3>
        <p className="text-sm text-muted-foreground">
          Choose a project from the sidebar, or create a new one to start tracking tasks.
        </p>
      </div>
    </div>
  );
}
