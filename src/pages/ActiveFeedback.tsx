import { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Video, User } from '../types';
import { Link, useOutletContext } from 'react-router-dom';
import { FolderOpen, Clock } from 'lucide-react';

export default function ActiveFeedback() {
  const { user } = useOutletContext<{ user: User | null }>();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchActiveVideos() {
      const allVideos = await dbService.getVideos(user?.id, user?.role);
      // Assume "Đang chờ duyệt" or "Lịch feedback" are active
      const activeVideos = allVideos.filter(v => v.status === 'Đang chờ duyệt' || v.status === 'Lịch feedback' || v.status === 'Đang thực hiện');
      setVideos(activeVideos.length > 0 ? activeVideos : allVideos.slice(0, 3)); // Fallback
      setIsLoading(false);
    }
    fetchActiveVideos();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Đang tải...</div>;
  }

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-[#0e1015]">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 pl-12 lg:pl-0">
            <FolderOpen className="text-indigo-400" />
            Dự án đang feedback
          </h1>
          <p className="text-slate-400 mt-2 pl-12 lg:pl-0">Danh sách các dự án đang trong quá trình nhận feedback và chỉnh sửa.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map(video => (
            <Link key={video.id} to={`/video/${video.id}`} className="block group">
              <div className="bg-[#1c1e23] border border-[#2e3138] rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 relative">
                <div className="aspect-video bg-slate-800 relative">
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      Chưa có video
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-amber-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded shadow">
                    {video.status}
                  </div>
                </div>
                <div className="p-4 bg-[#1c1e23] group-hover:bg-[#24262d] transition-colors">
                  <h3 className="text-white font-semibold mb-3 group-hover:text-amber-400 transition-colors line-clamp-2">{video.title}</h3>
                  <div className="flex flex-col gap-2 border-t border-[#2e3138] pt-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                       <span className="flex items-center text-slate-400"><Clock className="w-3.5 h-3.5 mr-1"/> {new Date(video.createdAt).toLocaleDateString()}</span>
                    </div>
                    {video.deadline && (
                      <div className="flex items-center justify-between text-xs font-medium mt-1">
                        <span className="text-slate-500">Deadline: {new Date(video.deadline).toLocaleDateString('vi-VN')}</span>
                        {(() => {
                          const daysLeft = Math.ceil((new Date(video.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                          if (daysLeft > 3) return <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Còn {daysLeft} ngày</span>;
                          if (daysLeft > 0) return <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">Còn {daysLeft} ngày</span>;
                          if (daysLeft === 0) return <span className="text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">Hôm nay</span>;
                          return <span className="text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">Trễ hạn {-daysLeft} ngày</span>;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {videos.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              Không có dự án nào đang cần feedback.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
