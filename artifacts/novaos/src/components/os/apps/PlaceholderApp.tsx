import React from 'react';
import { App } from '@workspace/api-client-react';

interface PlaceholderAppProps {
  app?: App;
  windowTitle?: string;
}

export default function PlaceholderApp({ app, windowTitle }: PlaceholderAppProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      {app?.icon ? (
        <img src={app.icon} alt={app.name} className="w-24 h-24 rounded-2xl shadow-lg mb-6 object-cover" />
      ) : (
        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg mb-6">
          <div className="w-12 h-12 rounded-lg bg-primary" />
        </div>
      )}
      
      <h2 className="text-3xl font-bold mb-2">{app?.name || windowTitle || 'App'}</h2>
      <p className="text-muted-foreground max-w-sm mx-auto">
        {app?.description || "This app is under construction in Phase 1 of NovaOS. In the future, this window will contain the fully interactive application."}
      </p>
      
      {app?.category && (
        <div className="mt-8 px-3 py-1 rounded-full bg-muted text-xs font-medium uppercase tracking-wider text-muted-foreground border">
          {app.category}
        </div>
      )}
    </div>
  );
}
