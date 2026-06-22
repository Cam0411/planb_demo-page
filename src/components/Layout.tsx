import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, History, Menu, X, LogOut, LogIn, Bell, BellOff, Shield, Settings as SettingsIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/db';
import { User } from '../types';
import LoginModal from './LoginModal';
import NotificationPanel from './NotificationPanel';
import { useNotifications } from '../hooks/useNotifications';
import { cn } from '../lib/utils';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const location = useLocation();

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id);

  // Global title management
  useEffect(() => {
    // Only set default title if we're not on a video page
    // VideoFeedback handles its own title precisely
    if (!location.pathname.startsWith('/video')) {
      document.title = 'Feedback | PlanB Production';
    }
  }, [location.pathname]);

  // Check for approaching deadlines
  useEffect(() => {
    if (!user) return;

    const checkDeadlines = async () => {
      if (!user) return;
      const videos = await dbService.getVideos(user.id, user.role);
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      for (const video of videos) {
        // Only check if user is involved
        if (video.ownerId === user.id || video.editorIds?.includes(user.id)) {
          if (video.deadline && (video.deadline - now) > 0 && (video.deadline - now) < ONE_DAY) {
            // Check if we already notified for this deadline recently
            const alreadyNotified = notifications.find(n => n.videoId === video.id && n.type === 'deadline' && (now - n.createdAt) < ONE_DAY);
            
            if (!alreadyNotified) {
              await dbService.addNotification({
                userId: user.id,
                type: 'deadline',
                title: 'Deadline sắp tới',
                message: `Video "${video.title}" sẽ đến hạn trong vòng 24 giờ tới!`,
                videoId: video.id,
                triggerUserId: 'system'
              });
            }
          }
        }
      }
    };

    const timer = setTimeout(checkDeadlines, 5000); // Check after a few seconds
    return () => clearTimeout(timer);
  }, [user, notifications.length]); // Re-run when user or total notification count changes

  useEffect(() => {
    dbService.getCurrentUser().then(u => {
      setUser(u);
      if (!u) {
        const savedGuestName = typeof window !== 'undefined' ? localStorage.getItem('guestName') : null;
        if (savedGuestName) {
          setUser({ id: 'guest', name: savedGuestName, role: 'viewer' } as User);
        } else {
          setShowLoginModal(true);
        }
      }
    });
  }, []);

  const handleLogout = async () => {
    await dbService.logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('guestName');
    }
    setUser(null);
    setShowLoginModal(true);
  };

  const handleLogin = (u: User) => {
    setUser(u);
    setShowLoginModal(false);
  };

  // Close sidebar on route change for mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const menuGroups = [
    {
      title: "Project Management",
      items: [
        { name: "Project Dashboard", icon: LayoutDashboard, path: "/", active: location.pathname === '/' },
        { name: "Dự án đang feedback", icon: FolderOpen, path: "/active-feedback", active: location.pathname === '/active-feedback' },
      ]
    },
    {
      title: 'Hệ thống',
      items: [
        { name: 'Lịch sử comment', icon: History, path: '/comment-history', active: location.pathname === '/comment-history' },
        { name: 'Cài đặt tài khoản', icon: SettingsIcon, path: '/settings', active: location.pathname === '/settings' },
        ...(user?.role === 'admin' ? [
          { name: 'Quản lý người dùng', icon: Shield, path: '/users', active: location.pathname === '/users' }
        ] : []),
      ]
    }
  ];

  const isVideoPage = location.pathname.startsWith('/video');

  return (
    <div className="flex h-screen w-full bg-[#0e1015] font-sans text-slate-300 overflow-hidden relative">
      <AnimatePresence>
        {showLoginModal && (
          <LoginModal onLogin={handleLogin} />
        )}
      </AnimatePresence>

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-[#14151a] border-r border-[#2e3138] flex flex-col transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 shadow-2xl lg:shadow-none overflow-hidden",
        isSidebarOpen ? "translate-x-0 w-72 sm:w-64" : "-translate-x-full w-72 sm:w-64 lg:w-auto",
        isVideoPage ? "lg:w-72 sm:lg:w-64 lg:border-r" : (isSidebarCollapsed ? "lg:w-16 lg:border-r" : "lg:w-72 sm:lg:w-64")
      )}>
        <div className={cn(
          "p-4 sm:p-6 border-b border-[#2e3138] flex items-center justify-between",
          isVideoPage && isSidebarCollapsed && "lg:px-0 lg:justify-center"
        )}>
          <Link to="/" className={cn(
            "flex items-center gap-3 hover:opacity-80 transition-opacity",
            isVideoPage && isSidebarCollapsed && "lg:hidden"
          )}>
            <img 
              src="https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123" 
              alt="Plan B Production Logo" 
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
            />
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight leading-none text-white">Plan B Production</span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5 sm:mt-1">
                <div className="w-1.2 h-1.2 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400 animate-pulse ring-2 ring-emerald-400/20"></div>
                Live Cloud Sync
              </span>
            </div>
          </Link>
          
          {isVideoPage && isSidebarCollapsed && (
            <Link to="/" className="hidden lg:block">
              <img 
                src="https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123" 
                alt="Logo" 
                className="w-8 h-8 object-contain"
              />
            </Link>
          )}

          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Content Area */}
        <div id="sidebar-content" className="flex-1 overflow-hidden flex flex-col custom-scrollbar">
          {!location.pathname.startsWith('/video') && (
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-hide">
              {menuGroups.map((group, idx) => (
                <div key={idx} className="space-y-1">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] px-3 mb-2">{group.title}</h3>
                  {group.items.map((item, i) => (
                    <Link 
                      key={i}
                      to={item.path} 
                      className={`flex items-center justify-between group px-3 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                        item.active 
                        ? 'bg-indigo-600/10 text-indigo-400 shadow-sm shadow-indigo-500/5' 
                        : 'text-slate-400 hover:bg-[#1c1e23] hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${item.active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                        {item.name}
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#2e3138] bg-[#0e1015]/50 relative">
          <AnimatePresence>
            {showNotifPanel && (
              <NotificationPanel 
                notifications={notifications}
                onClose={() => setShowNotifPanel(false)}
                onMarkRead={markAsRead}
                onMarkAllRead={markAllAsRead}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 mb-3 px-2">
            <button 
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-2 rounded-xl bg-[#1c1e23] border border-[#2e3138] text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all group"
            >
              <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[#14151a] shadow-[0_0_10px_rgb(79,70,229,0.5)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className="flex-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
              Thông báo
            </div>
          </div>

          <div className="bg-[#1c1e23] border border-[#2e3138] p-3 rounded-2xl flex items-center gap-3 group relative shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold uppercase text-xs shadow-inner border border-white/10 shrink-0">
              {user?.avatar ? <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" /> : (user?.name?.charAt(0) || <LogIn className="w-4 h-4" />)}
            </div>
            {(!isVideoPage || !isSidebarCollapsed) && (
              <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-bold truncate text-white">{user?.name || 'Guest User'}</div>
                  {user?.role === 'admin' && (
                    <span className="bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-tighter">ADMIN</span>
                  )}
                </div>
                <div className="text-[10px] font-medium text-slate-400 truncate flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-indigo-400"></div>
                  Premium Plan
                </div>
              </div>
            )}
            {user ? (
              (!isVideoPage || !isSidebarCollapsed) && (
                <button 
                  onClick={handleLogout}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all animate-in fade-in duration-300"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )
            ) : (
              (!isVideoPage || !isSidebarCollapsed) && (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="p-1.5 text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all animate-in fade-in duration-300"
                  title="Đăng nhập"
                >
                  <LogIn className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full w-full overflow-hidden">
        {/* Mobile menu and notifications header (only visible on mobile) */}
        <div className="lg:hidden flex items-center justify-between p-4 z-40 bg-[#14151a]/95 backdrop-blur-md border-b border-[#2e3138] fixed top-0 left-0 right-0 h-16">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="p-2 bg-[#1c1e23] rounded-lg shadow-md border border-[#2e3138] text-slate-400 hover:text-white transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
             >
               <Menu className="w-5 h-5" />
             </button>
             <img 
                src="https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123" 
                alt="Logo" 
                className="w-7 h-7 object-contain"
              />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-2 rounded-xl bg-[#1c1e23] border border-[#2e3138] text-slate-400 hover:text-white transition-all group"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-[#14151a]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
        
        <div className="pt-16 lg:pt-0 flex-1 overflow-hidden">
          <Outlet context={{ user, setUser, isSidebarCollapsed, setIsSidebarCollapsed }} />
        </div>
      </main>
    </div>
  );
}
