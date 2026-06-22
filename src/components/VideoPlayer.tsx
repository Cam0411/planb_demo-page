import { forwardRef, useEffect, useState, useImperativeHandle, useRef, useMemo, useCallback, memo } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Scissors } from 'lucide-react';
import { VideoEdits } from '../types';
import { getYoutubeId } from '../services/db';

interface VideoPlayerProps {
  url: string;
  initialTime?: number;
  onProgress?: (state: { playedSeconds: number }) => void;
  onStateChange?: YouTubeProps['onStateChange'];
  onDuration?: (duration: number) => void;
  edits?: VideoEdits;
  isEditing?: boolean;
}

const VideoPlayer = memo(forwardRef<any, VideoPlayerProps>(({ url, initialTime, onStateChange, onDuration, edits, isEditing }, ref) => {
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [driveEmbedUrl, setDriveEmbedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // We only use initialTime ONCE during the first load of the YouTube player
  // to prevent subsequent opts changes from resetting the player.
  const stableStart = useMemo(() => initialTime ? Math.floor(initialTime) : undefined, []);

  const opts = useMemo<YouTubeProps['opts']>(() => ({
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
      controls: 1,
      start: stableStart,
      disablekb: 0,
    },
  }), [stableStart]);

  useEffect(() => {
    const getDriveEmbedUrl = (url: string) => {
      if (!url.includes('drive.google.com')) return null;
      
      // Match file ID: /file/d/[ID]/ or ?id=[ID]
      let fileId = null;
      const fileDMatch = url.match(/\/file\/d\/([^\/]+)/);
      if (fileDMatch) {
        fileId = fileDMatch[1];
      } else {
        const idMatch = url.match(/[?&]id=([^&]+)/);
        if (idMatch) fileId = idMatch[1];
      }
      
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
      return null;
    };

    const yid = getYoutubeId(url);
    if (yid) {
      setYoutubeId(yid);
      setDriveEmbedUrl(null);
    } else {
      const durl = getDriveEmbedUrl(url);
      if (durl) {
        setDriveEmbedUrl(durl);
        setYoutubeId(null);
      }
    }
  }, [url]);

  useEffect(() => {
    let interval: any;
    if (isPlaying && youtubeId) {
      interval = setInterval(() => {
        if (playerRef.current) {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);
          
          // Check for trim loops if not editing
          if (!isEditing && edits?.trimEnd && time >= edits.trimEnd) {
            playerRef.current.seekTo(edits.trimStart || 0, true);
          }
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isEditing, edits, youtubeId]);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      if (youtubeId && playerRef.current) {
        return playerRef.current.getCurrentTime();
      }
      return currentTime;
    },
    getDuration: () => {
      if (youtubeId && playerRef.current) {
        return playerRef.current.getDuration();
      }
      return duration;
    },
    seekTo: (seconds: number) => {
      if (youtubeId && playerRef.current) {
        playerRef.current.seekTo(seconds, true);
        setCurrentTime(seconds);
      }
    },
    pauseVideo: () => {
      if (youtubeId && playerRef.current) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      }
    },
    playVideo: () => {
      if (youtubeId && playerRef.current) {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    }
  }));

  const handleStateChange: YouTubeProps['onStateChange'] = useCallback((event) => {
    const state = event.data;
    // 1: playing, 2: paused, 0: ended
    if (state === 1) setIsPlaying(true);
    else if (state === 2 || state === 0) setIsPlaying(false);

    if (event.target) {
      const time = event.target.getCurrentTime();
      setCurrentTime(time);
      if (onDuration) {
        const d = event.target.getDuration();
        setDuration(d);
        onDuration(d);
      }
    }
    if (onStateChange) {
      onStateChange(event);
    }
  }, [onDuration, onStateChange]);

  const onReady: YouTubeProps['onReady'] = useCallback((event) => {
    playerRef.current = event.target;
    if (onDuration) {
      const d = event.target.getDuration();
      setDuration(d);
      onDuration(d);
    }
  }, [onDuration]);

  if (!youtubeId && !driveEmbedUrl) {
    return (
      <div className="w-full aspect-video bg-slate-900 rounded-2xl flex items-center justify-center text-white">
        Link video không hợp lệ
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-black overflow-hidden relative group"
    >
      <div className="absolute inset-0 z-0">
        {youtubeId ? (
          <YouTube 
            videoId={youtubeId} 
            opts={opts} 
            onReady={onReady} 
            onStateChange={handleStateChange}
            className="w-full h-full"
            iframeClassName="w-full h-full"
          />
        ) : driveEmbedUrl ? (
          <iframe 
            src={driveEmbedUrl} 
            className="w-full h-full border-none"
            allow="autoplay"
            title="Google Drive Video"
          />
        ) : null}
      </div>

      {/* Text Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {edits?.overlays?.map((overlay) => {
          const isActive = currentTime >= overlay.startTime && currentTime <= overlay.endTime;
          if (!isActive) return null;

          return (
            <div
              key={overlay.id}
              className="absolute p-2 rounded transition-opacity duration-300"
              style={{
                left: `${overlay.position.x}%`,
                top: `${overlay.position.y}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${overlay.style?.fontSize || 24}px`,
                color: overlay.style?.color || 'white',
                backgroundColor: overlay.style?.backgroundColor || 'rgba(0,0,0,0.4)',
                whiteSpace: 'pre-wrap',
                textAlign: 'center',
                maxWidth: '80%'
              }}
            >
              {overlay.text}
            </div>
          );
        })}
      </div>

      {/* Simplified Status Overlay for Editing Mode */}
      {isEditing && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <div className="bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg">
            <Scissors className="w-3 h-3" />
            ĐANG CHỈNH SỬA
          </div>
        </div>
      )}
    </div>
  );
}));

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
