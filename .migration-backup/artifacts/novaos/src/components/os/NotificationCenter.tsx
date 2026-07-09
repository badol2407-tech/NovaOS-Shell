import React, { useMemo } from 'react';
import { useOS } from './OSProvider';
import { cn } from '@/lib/utils';
import { Bell, X, Check, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { 
  useListNotifications, 
  useMarkAllNotificationsRead, 
  useMarkNotificationRead, 
  useDeleteNotification,
  useGetNotificationsSummary,
  getListNotificationsQueryKey,
  getGetNotificationsSummaryQueryKey
} from '@workspace/api-client-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export function NotificationCenter() {
  const { isNotificationCenterOpen, toggleNotificationCenter, closeNotificationCenter } = useOS();
  const queryClient = useQueryClient();
  
  const { data: notifications = [] } = useListNotifications();
  const { data: summary } = useGetNotificationsSummary();
  
  const markAllRead = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNotificationsSummaryQueryKey() });
      }
    }
  });
  
  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNotificationsSummaryQueryKey() });
      }
    }
  });
  
  const deleteNotif = useDeleteNotification({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNotificationsSummaryQueryKey() });
      }
    }
  });

  const unreadCount = summary?.unreadCount || 0;

  const getIcon = (type: string) => {
    switch(type) {
      case 'success': return <Check className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      <div className="fixed top-2 right-2 z-[101] flex items-center gap-2">
        <div className="glass-panel px-4 h-10 rounded-xl flex items-center gap-2 text-sm font-medium">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <button 
          onClick={toggleNotificationCenter}
          className={cn(
            "glass-panel relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
            isNotificationCenterOpen ? "bg-white/20 dark:bg-white/10" : "hover:bg-white/10 dark:hover:bg-white/5"
          )}
        >
          <Bell className="w-5 h-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {isNotificationCenterOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/10" 
              onClick={closeNotificationCenter}
            />
            
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-14 right-2 w-80 h-[calc(100vh-4.5rem)] flex flex-col z-[100] glass-panel-heavy rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-border/30 flex items-center justify-between bg-black/5 dark:bg-white/5">
                <h2 className="font-semibold">Notifications</h2>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <ScrollArea className="flex-1 p-2">
                <AnimatePresence>
                  {notifications.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3"
                    >
                      <Bell className="w-8 h-8 opacity-20" />
                      <p className="text-sm">You're all caught up.</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map(n => (
                        <motion.div
                          key={n.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className={cn(
                            "relative group p-3 rounded-xl border transition-colors",
                            n.read ? "bg-card/50 border-transparent" : "bg-card border-primary/20 shadow-sm"
                          )}
                          onPointerEnter={() => { if (!n.read) markRead.mutate({ id: n.id }); }}
                        >
                          <div className="flex gap-3">
                            <div className="shrink-0 mt-0.5">
                              {getIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className={cn("text-sm font-semibold truncate", !n.read && "text-primary")}>
                                  {n.title}
                                </h4>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {n.body}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteNotif.mutate({ id: n.id })}
                            className="absolute top-2 right-2 w-6 h-6 rounded-md bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
