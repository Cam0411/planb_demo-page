import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { dbService } from '../services/db';
import { Shield, User as UserIcon, Check, X, AlertCircle, Trash2, Edit2, Mail, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';

const UserManagement: React.FC = () => {
  const { user: currentUser } = useOutletContext<{ user: User | null }>();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('viewer');

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const fetchedUsers = await dbService.getUsers();
      setUsers(fetchedUsers);
    } catch (err) {
      setError('Không thể tải danh sách người dùng.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await dbService.updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert('Lỗi khi cập nhật quyền.');
      console.error(err);
    }
  };

  const handleUpdateName = async (userId: string) => {
    if (!editName.trim()) return;
    try {
      await dbService.updateUserName(userId, editName);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: editName } : u));
      setEditingUserId(null);
    } catch (err) {
      alert('Lỗi khi cập nhật tên.');
      console.error(err);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`Gửi email khôi phục mật khẩu tới ${email}?`)) return;
    try {
      await dbService.resetPassword(email);
      alert('Email khôi phục mật khẩu đã được gửi.');
    } catch (err) {
      alert('Lỗi khi gửi email khôi phục.');
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${userName}"?`)) return;
    
    try {
      await dbService.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      console.error('Delete User Error:', err);
      let errorMsg = 'Lỗi khi xóa người dùng.';
      try {
        const firestoreErr = JSON.parse(err.message);
        if (firestoreErr.error.includes('Missing or insufficient permissions')) {
          errorMsg = 'Bạn không có quyền xóa người dùng này (Lỗi phân quyền Firestore).';
        } else {
          errorMsg = `Lỗi: ${firestoreErr.error}`;
        }
      } catch (e) {
        errorMsg = err.message || errorMsg;
      }
      alert(errorMsg);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      alert('Vui lòng nhập tên và email.');
      return;
    }
    
    try {
      await dbService.addUser(newUserName, newUserEmail, newUserRole);
      setIsAddUserModalOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      loadUsers();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi thêm người dùng.');
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0e1015] p-8 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20">
          <Shield className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight uppercase">Truy cập bị từ chối</h1>
        <p className="text-slate-400 mt-2 max-w-md">
          Bạn không có quyền truy cập vào trang quản lý này. Tính năng này chỉ dành cho tài khoản Quản trị viên.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0e1015]">
      <header className="p-4 sm:p-8 border-b border-[#2e3138] flex items-center justify-between bg-[#14151a] shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tighter flex items-center gap-2 sm:gap-3">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
            QUẢN LÝ USER
          </h1>
          <p className="text-slate-400 text-[10px] sm:text-sm mt-0.5">Phân quyền và quản lý tài khoản</p>
        </div>
        <button 
          onClick={() => setIsAddUserModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
        >
          <Plus className="w-4 h-4" />
          Thêm User
        </button>
      </header>

      <div className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-medium">Đang tải danh sách...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-500 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(user => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#14151a] p-6 rounded-2xl border border-[#2e3138] hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                      {user.avatar ? (
                        <img src={user.avatar} alt="User Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-[#0e1015] border border-indigo-500 rounded px-2 py-1 text-sm text-white w-full outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateName(user.id)} className="text-emerald-500 hover:text-emerald-400">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingUserId(null)} className="text-red-500 hover:text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/name">
                          <h3 className="font-bold text-white leading-tight truncate">{user.name}</h3>
                          <button 
                            onClick={() => { setEditingUserId(user.id); setEditName(user.name); }}
                            className="opacity-0 group-hover/name:opacity-100 p-1 text-slate-500 hover:text-indigo-400 transition-all"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <p className="text-slate-500 text-xs truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => user.email && handleResetPassword(user.email)}
                      className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                      title="Gửi email khôi phục mật khẩu"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Xóa người dùng"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#2e3138] grid grid-cols-4 gap-2">
                  {(['admin', 'editor', 'viewer', 'guest'] as UserRole[]).map(role => (
                    <button
                      key={role}
                      onClick={() => handleUpdateRole(user.id, role)}
                      disabled={user.role === role}
                      className={`text-[10px] font-bold py-2 rounded-lg transition-all ${
                        user.role === role 
                          ? 'bg-indigo-600 text-white cursor-default'
                          : 'bg-[#0e1015] text-slate-500 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {role.toUpperCase()}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddUserModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#14151a] p-6 rounded-2xl border border-[#2e3138] w-full max-w-md shadow-2xl"
            >
              <h2 className="text-lg font-bold text-white mb-4">Thêm người dùng mới</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-[#0e1015] border border-[#2e3138] rounded-xl px-4 py-2 text-white"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-[#0e1015] border border-[#2e3138] rounded-xl px-4 py-2 text-white"
                />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-[#0e1015] border border-[#2e3138] rounded-xl px-4 py-2 text-white"
                />
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full bg-[#0e1015] border border-[#2e3138] rounded-xl px-4 py-2 text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsAddUserModalOpen(false)}
                    className="flex-1 bg-[#24262d] text-slate-400 py-2 rounded-xl font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddUser}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
