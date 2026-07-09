import React, { useState } from "react";
import { Puzzle, Store, Wrench, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarketplaceTab } from "./MarketplaceTab";
import { MyPluginsTab } from "./MyPluginsTab";
import { InstalledTab } from "./InstalledTab";

export default function PluginManagerApp() {
  const [tab, setTab] = useState("marketplace");

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Puzzle className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold tracking-wide">Plugin Manager</span>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 w-fit">
          <TabsTrigger value="marketplace" className="gap-1.5">
            <Store className="w-3.5 h-3.5" /> Marketplace
          </TabsTrigger>
          <TabsTrigger value="installed" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Installed
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> My Plugins
          </TabsTrigger>
        </TabsList>
        <TabsContent value="marketplace" className="flex-1 min-h-0 m-0">
          <MarketplaceTab />
        </TabsContent>
        <TabsContent value="installed" className="flex-1 min-h-0 m-0">
          <InstalledTab />
        </TabsContent>
        <TabsContent value="mine" className="flex-1 min-h-0 m-0">
          <MyPluginsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
