import { motion } from 'framer-motion';
import { Comment } from '../types';
import { formatTime } from '../lib/utils';
import { Clock } from 'lucide-react';

interface VideoTimelineProps {
  comments: Comment[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export default function VideoTimeline({ comments, duration, currentTime, onSeek }: VideoTimelineProps) {
  const frameComments = comments.filter(c => c.frameTime !== undefined);
  
  // Calculate percentage for a given time
  const getProgress = (time: number) => {
    if (!duration) return 0;
    return (time / duration) * 100;
  };

  const currentPercent = getProgress(currentTime);

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'High': return 'bg-red-500';
      case 'Low': return 'bg-slate-400';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-hidden mt-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
          Feedback Timeline
        </h3>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
           <span className="text-blue-600 font-mono">{formatTime(currentTime)}</span>
           <span className="font-mono">/</span>
           <span className="font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="relative h-12 flex items-center group">
        {/* Background Track */}
        <div className="absolute inset-x-0 h-2 bg-slate-100 rounded-full"></div>
        
        {/* Progress Fill */}
        <motion.div 
          className="absolute left-0 h-2 bg-blue-600/20 rounded-full"
          style={{ width: `${currentPercent}%` }}
        />

        {/* Current Time Marker */}
        <motion.div 
          className="absolute w-1 h-8 bg-blue-600 z-10 -translate-x-1/2 pointer-events-none rounded-full"
          style={{ left: `${currentPercent}%` }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">
            {formatTime(currentTime)}
          </div>
        </motion.div>

        {/* Feedback Markers */}
        <div className="absolute inset-x-0 h-full flex items-center pointer-events-none">
          {frameComments.map((comment) => {
            const percent = getProgress(comment.frameTime!);
            return (
              <button
                key={comment.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(comment.frameTime!);
                }}
                className="absolute w-3 h-3 -translate-x-1/2 pointer-events-auto group/marker flex flex-col items-center justify-center transition-all hover:scale-150 z-20"
                style={{ left: `${percent}%` }}
              >
                <div 
                  className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ring-2 ring-white ${getPriorityColor(comment.priority)} ${comment.resolved ? 'opacity-40 grayscale' : ''}`}
                ></div>
                
                {/* Tooltip Content */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-slate-800 text-white p-3 rounded-xl shadow-xl z-50 pointer-events-none w-48 border border-slate-700">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="text-[10px] font-bold text-blue-400 font-mono tracking-wider">{formatTime(comment.frameTime!)}</span>
                  </div>
                  <div className="text-[11px] font-medium leading-relaxed line-clamp-3">
                    {comment.content}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Clickable Area for Seeking */}
        <div 
          className="absolute inset-x-0 h-full cursor-pointer z-0"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const clickedPercent = x / rect.width;
            onSeek(clickedPercent * duration);
          }}
        ></div>
      </div>

      <div className="mt-8 flex gap-8">
        <div className="ml-auto text-[10px] font-bold text-slate-400 italic">
          Hover vào các điểm màu để xem nội dung chi tiết
        </div>
      </div>
    </div>
  );
}
