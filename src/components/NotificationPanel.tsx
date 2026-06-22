import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, MessageSquare, Activity, Clock, Check } from 'lucide-react';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead }: NotificationPanelProps) {
  const navigate = useNavigate();

  const handleNotificationClick = (notif: Notification) => {
    onMarkRead(notif.id);
    navigate(`/video/${notif.videoId}`);
    onClose();
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'comment': return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      case 'status': return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'deadline': return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="fixed bottom-20 left-4 sm:absolute sm:bottom-full sm:mb-4 sm:left-0 w-[calc(100vw-2rem)] sm:w-80 max-h-[400px] bg-[#1c1e23] border border-[#2e3138] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 ring-1 ring-white/5"
    >
      <div className="p-4 border-b border-[#2e3138] flex items-center justify-between bg-[#14151a]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-sm text-white">Thông báo</span>
        </div>
        <div className="flex items-center gap-2">
          {notifications.some(n => !n.read) && (
            <button 
              onClick={onMarkAllRead}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Đánh dấu đã đọc
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0e1015]/50">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 text-slate-700 mx-auto mb-3 opacity-20" />
            <p className="text-xs text-slate-500 font-medium">Không có thông báo nào</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2e3138]">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 hover:bg-[#1c1e23] transition-colors cursor-pointer group relative ${!notif.read ? 'bg-indigo-500/5' : ''}`}
              >
                {!notif.read && (
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgb(79,70,229,0.5)]"></div>
                )}
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    notif.type === 'comment' ? 'bg-indigo-500/10' : 
                    notif.type === 'status' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  }`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white mb-0.5">{notif.title}</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-1 line-clamp-2">{notif.message}</p>
                    <p className="text-[9px] text-slate-500 font-medium italic">
                      {formatDistanceToNow(notif.createdAt, { addSuffix: true, locale: vi })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
