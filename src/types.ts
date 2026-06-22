export type UserRole = 'admin' | 'editor' | 'viewer' | 'guest';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: UserRole;
}

export interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number };
  style?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  };
}

export interface VideoEdits {
  trimStart?: number;
  trimEnd?: number;
  overlays?: TextOverlay[];
}

export interface VideoVersion {
  id: string;
  name: string;
  edits: VideoEdits;
  createdAt: number;
  createdBy: string;
}

export interface Video {
  id: string;
  title: string;
  youtubeUrl: string;
  driveUrl?: string; // maybe just "Video URL" now
  thumbnail?: string;
  editorIds?: string[];
  ownerId?: string;
  status: 'Đang thực hiện' | 'Đang chờ duyệt' | 'Đã duyệt' | 'Đã hoàn thành' | 'Lịch feedback';
  deadline?: number;
  timeline?: { id: string; title: string; date: number; status: 'Upcoming'|'Doing'|'Done' }[];
  createdAt: number;
  edits?: VideoEdits;
  versions?: VideoVersion[];
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  version: string; // e.g., "Feedback 1"
  content: string;
  attachmentUrl?: string; // Image uploaded via ImageKit
  frameTime?: number; // Time in seconds, null if general feedback
  createdAt: number;
  resolved: boolean;
  priority?: 'Low' | 'Normal' | 'High';
  category?: 'Edit' | 'Audio' | 'Color' | 'Question' | 'General';
  parentId?: string; // ID of the parent comment
  reactions?: Record<string, string[]>; // emoji -> array of userIds
}

export interface Notification {
  id: string;
  userId: string; // Target user
  type: 'comment' | 'status' | 'deadline';
  title: string;
  message: string;
  videoId: string;
  read: boolean;
  createdAt: number;
  triggerUserId?: string; // User who triggered the notification
}

export interface SharedLink {
  id: string;
  videoId: string;
  title: string;
  createdAt: number;
  createdBy: string;
  viewCount: number;
  password?: string;
  expiresAt?: number;
}
