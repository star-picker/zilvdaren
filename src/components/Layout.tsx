import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore, captureUrlToken, setUrlToken } from '@/store';
import { useDebugMode } from '@/hooks/useDebugMode';
import DebugPanel from '@/components/DebugPanel';
import {
  Home, Target, CheckSquare, User, Users, MessageSquare, Settings,
  LogOut, Sun, Moon, Bug, Shield,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/habits', label: '习惯', icon: Target },
  { path: '/checkin', label: '打卡', icon: CheckSquare },
  { path: '/character', label: '角色', icon: User },
  { path: '/circles', label: '圈子', icon: Users },
  { path: '/quotes', label: '语录', icon: MessageSquare },
];

const authPaths = ['/login', '/register', '/forgot-password'];

export default function Layout() {
  const { user, character, darkMode, debugMode, toggleDarkMode, setDebugMode, setUser, setTimezone, logout } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const debugPanelRef = useRef<HTMLDivElement>(null);
  const [initializing, setInitializing] = useState(true);

  // Register debug mode hook
  useDebugMode();

  // Sync dark mode with <html> element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // ─── URL Token 检测：优先使用 URL 中的 token，支持多标签页多用户同时登录 ───
  useEffect(() => {
    const urlToken = captureUrlToken();
    if (urlToken) {
      // 使用 URL token 验证身份
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${urlToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUser({ id: data.data.id, username: data.data.username, token: urlToken, isAdmin: data.data.isAdmin });
            if (data.data.timezone) setTimezone(data.data.timezone);
          } else {
            setUrlToken(null);
          }
        })
        .catch(() => setUrlToken(null))
        .finally(() => setInitializing(false));
    } else {
      setInitializing(false);
    }
  }, []);

  // 登录状态检查：仅在初始化完成后执行
  useEffect(() => {
    if (initializing) return;
    if (!user && !authPaths.includes(location.pathname)) {
      navigate('/login');
    }
  }, [initializing, user, location.pathname, navigate]);

  // Close debug panel on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (debugPanelRef.current && !debugPanelRef.current.contains(e.target as Node)) {
        setShowDebugPanel(false);
      }
    };
    if (showDebugPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDebugPanel]);

  // 初始化中（正在验证 URL token）
  if (initializing) {
    return (
      <div className="min-h-screen bg-md-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-md-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-md-on-surface-variant">正在验证身份...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Outlet />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-md-surface transition-colors duration-300">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 px-4 py-2">
        <div className="max-w-6xl mx-auto md-nav">
          {/* Brand */}
          <div className="flex items-center gap-2 pr-2">
            <div className="w-8 h-8 rounded-xl bg-md-primary-container flex items-center justify-center">
              <Target className="w-4 h-4 text-md-on-primary-container" />
            </div>
            <span className="text-md-on-surface font-medium text-sm hidden sm:inline">自律达人</span>
          </div>

          {/* Nav Items */}
          <div className="flex items-center gap-0.5 flex-1 justify-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`md-nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 pl-2">
            {/* User Info */}
            <div className="text-right hidden sm:block mr-1">
              <div className="text-xs font-medium text-md-on-surface">{user.username}</div>
              <div className="text-[10px] text-md-on-surface-variant">
                Lv.{character?.level || 1} {character?.title || '初心者'}
              </div>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="md-btn md-btn-icon text-md-on-surface-variant hover:text-md-on-surface"
              title={darkMode ? '切换到日间模式' : '切换到夜间模式'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Debug Toggle - only visible after debug mode is activated */}
            {debugMode && (
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="md-btn md-btn-icon text-md-tertiary hover:text-md-on-surface"
                title="调试面板"
              >
                <Bug className="w-4 h-4" />
              </button>
            )}

            {/* Settings */}
            <Link
              to="/user-center"
              className="md-btn md-btn-icon text-md-on-surface-variant hover:text-md-on-surface"
              title="用户中心"
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* Admin - only for admins */}
            {user?.isAdmin && (
              <Link
                to="/admin"
                className="md-btn md-btn-icon text-md-error hover:bg-md-error-container"
                title="全局管理后台"
              >
                <Shield className="w-4 h-4" />
              </Link>
            )}

            {/* Logout */}
            <button onClick={handleLogout} className="md-btn md-btn-icon text-md-on-surface-variant hover:text-md-error">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Debug Panel */}
      {showDebugPanel && (
        <div ref={debugPanelRef} className="fixed top-20 right-4 z-[100] w-[420px] max-h-[80vh] overflow-y-auto animate-scale-in">
          <DebugPanel onClose={() => setShowDebugPanel(false)} />
        </div>
      )}

      {/* Debug Mode Indicator */}
      {debugMode && (
        <div className="debug-indicator">
          DEBUG
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}