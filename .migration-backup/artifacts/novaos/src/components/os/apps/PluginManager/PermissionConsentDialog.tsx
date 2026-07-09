import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { PERMISSION_DESCRIPTIONS, type PluginPermission } from "./types";

interface PermissionConsentDialogProps {
  pluginName: string;
  permissions: PluginPermission[];
  open: boolean;
  onCancel: () => void;
  onConfirm: (granted: PluginPermission[]) => void;
}

export function PermissionConsentDialog({
  pluginName,
  permissions,
  open,
  onCancel,
  onConfirm,
}: PermissionConsentDialogProps) {
  const [checked, setChecked] = useState<Set<PluginPermission>>(new Set(permissions));

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Install {pluginName}?
          </DialogTitle>
          <DialogDescription>
            This plugin runs in an isolated sandbox with no access to your desktop
            or data except what you approve below. You can revoke access anytime
            from Installed Plugins.
          </DialogDescription>
        </DialogHeader>

        {permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            This plugin does not request any permissions.
          </p>
        ) : (
          <div className="space-y-3 py-2">
            {permissions.map((perm) => (
              <label key={perm} className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={checked.has(perm)}
                  onCheckedChange={(v) => {
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(perm);
                      else next.delete(perm);
                      return next;
                    });
                  }}
                />
                <div>
                  <div className="text-sm font-medium capitalize">{perm}</div>
                  <div className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[perm]}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onConfirm(Array.from(checked))}>Install</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
