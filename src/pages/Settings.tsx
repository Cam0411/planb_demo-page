import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { dbService } from '../services/db';
import { Settings as SettingsIcon, User as UserIcon, Mail, Lock, Check, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Settings: React.FC = () => {
  const { user, setUser } = useOutletContext<{ user: User | null, setUser: (u: User) => void }>();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await dbService.updateUserName(user.id, name);
      setUser({ ...user, name });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Không thể cập nhật hồ sơ.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    try {
      await dbService.resetPassword(user.email);
      alert('Email khôi phục mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (err) {
      alert('Lỗi khi gửi email khôi phục mật khẩu.');
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-[#0e1015]">
      <header className="p-8 border-b border-[#2e3138] flex items-center justify-between bg-[#14151a]">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-indigo-500" />
            CÀI ĐẶT TÀI KHOẢN
          </h1>
          <p className="text-slate-400 text-sm mt-1">Quản lý thông tin cá nhân và bảo mật</p>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-8">
          <section className="bg-[#14151a] p-8 rounded-3xl border border-[#2e3138] shadow-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-inner overflow-hidden uppercase">
                {user.avatar ? <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{user.name}</h2>
                <p className="text-slate-500 text-sm">{user.email}</p>
                <div className="mt-1 inline-flex px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase rounded tracking-widest border border-indigo-500/20">
                  {user.role}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Họ và tên</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0e1015] border border-[#2e3138] text-white rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 hover:border-slate-600 outline-none transition-all placeholder:text-slate-700 font-bold"
                    placeholder="Nhập tên của bạn..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email (Không thể thay đổi)</label>
                <div className="relative opacity-50 grayscale">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                  <input
                    type="email"
                    value={user.email || ''}
                    disabled
                    className="w-full bg-[#0e1015] border border-[#2e3138] text-slate-400 rounded-2xl py-4 pl-12 pr-4 outline-none cursor-not-allowed font-bold"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-500 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <Check className="w-5 h-5" />
                  Cập nhật hồ sơ thành công!
                </div>
              )}

              <button
                type="submit"
                disabled={loading || name === user.name}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest"
              >
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </form>
          </section>

          <section className="bg-[#14151a] p-8 rounded-3xl border border-[#2e3138] shadow-xl">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-500" />
              Bảo mật
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Nếu bạn muốn thay đổi mật khẩu hoặc đã quên mật khẩu cũ, hãy nhấn nút bên dưới để nhận email khôi phục.
            </p>
            <button
              onClick={handleResetPassword}
              className="px-6 py-3 bg-[#0e1015] border border-[#2e3138] text-slate-300 font-bold rounded-xl hover:bg-[#1c1e23] hover:text-white transition-all text-xs uppercase tracking-widest"
            >
              Đặt lại mật khẩu qua Email
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
