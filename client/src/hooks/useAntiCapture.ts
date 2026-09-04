import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { reportSecurityEvent, type SecurityEventType } from '@/lib/securityEvents';

export function useAntiCapture() {
  const [location] = useLocation();
  const lastReportedAt = useRef<Record<string, number>>({});
  const isAdminOrAuth = location.startsWith('/admin') || location.startsWith('/members') || location.startsWith('/login') || location.startsWith('/register') || location.startsWith('/pending');

  useEffect(() => {
    if (isAdminOrAuth) {
      document.body.classList.add('allow-select');
      return () => {
        document.body.classList.remove('allow-select');
      };
    }
    document.body.classList.remove('allow-select');

    const report = (eventType: SecurityEventType) => {
      const now = Date.now();
      if (now - (lastReportedAt.current[eventType] || 0) < 30_000) return;
      lastReportedAt.current[eventType] = now;
      void reportSecurityEvent(eventType, window.location.pathname);
    };

    // 우클릭 방지
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      report('context_menu');
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      report('copy_shortcut');
    };

    const handleSelectStart = (e: Event) => e.preventDefault();

    // 드래그 방지
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      report('drag_attempt');
    };

    // 단축키 차단 (Ctrl+C, Ctrl+P, Ctrl+S, F12 등)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifierPressed = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        report('print_screen_key');
        return;
      }
      if (isModifierPressed && ['c', 'p', 's', 'a'].includes(key)) {
        e.preventDefault();
        if (key === 'c') report('copy_shortcut');
        if (key === 'p') report('print_requested');
        if (key === 's') report('save_shortcut');
      }
      if (e.key === 'F12' || (isModifierPressed && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
        e.preventDefault();
        report('developer_tools_shortcut');
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('selectstart', handleSelectStart);

    const handleBlur = () => {
      report('focus_lost');
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        report('tab_hidden');
      }
    };
    const handleBeforePrint = () => {
      report('print_requested');
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('selectstart', handleSelectStart);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [isAdminOrAuth]);
}
