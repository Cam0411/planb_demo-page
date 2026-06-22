import { useState, useEffect } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import VideoFeedback from './pages/VideoFeedback';
import SharedVideoFeedback from './pages/SharedVideoFeedback';
import ActiveFeedback from './pages/ActiveFeedback';
import CommentHistory from './pages/CommentHistory';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'video/:id',
        element: <VideoFeedback />,
      },
      {
        path: 'video/shared/:shareId',
        element: <SharedVideoFeedback />,
      },
      {
        path: 'active-feedback',
        element: <ActiveFeedback />,
      },
      {
        path: 'comment-history',
        element: <CommentHistory />,
      },
      {
        path: 'users',
        element: <UserManagement />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
]);

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mô phỏng quá trình khởi tạo ứng dụng
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0e1015] font-sans text-slate-300">
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
           <div className="w-24 h-24 bg-[#14151a] rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgb(79,70,229,0.2)] border border-[#2e3138] relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 animate-pulse"></div>
             <img 
               src="https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123" 
               alt="Plan B Production Logo" 
               className="w-16 h-16 object-contain z-10 animate-bounce" 
               style={{animationDuration: '2s'}}
             />
           </div>
           <div className="flex flex-col items-center gap-2">
             <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Plan B Production</h1>
             <div className="flex items-center gap-2 text-xs text-indigo-400 font-black uppercase tracking-[0.3em] opacity-80">
               <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
               Initializing system
             </div>
           </div>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
