'use client';
import { useEffect } from 'react';

export default function ScreenshotGuard() {
  useEffect(() => {
    // Disable right-click context menu
    const noContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', noContext);

    // Block keyboard shortcuts
    const noKeys = (e: KeyboardEvent) => {
      const blocked = [
        // Print
        (e.ctrlKey || e.metaKey) && e.key === 'p',
        // Save
        (e.ctrlKey || e.metaKey) && e.key === 's',
        // Print screen
        e.key === 'PrintScreen',
        e.key === 'F12',
        // Dev tools
        (e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()),
        // Inspect
        (e.ctrlKey || e.metaKey) && e.key === 'u',
        // Snipping tool shortcut
        e.metaKey && e.shiftKey && e.key === 's',
        // Windows Snip
        e.key === 'F13',
      ];
      if (blocked.some(Boolean)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    document.addEventListener('keydown', noKeys, true);

    // Detect visibility change - blur content when tab loses focus
    const handleVisibility = () => {
      const els = document.querySelectorAll('.pdf-protected, .protected-content');
      if (document.hidden) {
        els.forEach((el) => (el as HTMLElement).style.filter = 'blur(20px)');
      } else {
        els.forEach((el) => (el as HTMLElement).style.filter = '');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Detect window blur (e.g., Alt+Tab)
    const handleBlur = () => {
      const els = document.querySelectorAll('.pdf-protected, .protected-content');
      els.forEach((el) => (el as HTMLElement).style.filter = 'blur(20px)');
    };
    const handleFocus = () => {
      const els = document.querySelectorAll('.pdf-protected, .protected-content');
      els.forEach((el) => (el as HTMLElement).style.filter = '');
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Prevent drag-and-drop of elements
    const noDrag = (e: DragEvent) => e.preventDefault();
    document.addEventListener('dragstart', noDrag);

    return () => {
      document.removeEventListener('contextmenu', noContext);
      document.removeEventListener('keydown', noKeys, true);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('dragstart', noDrag);
    };
  }, []);

  return null;
}
