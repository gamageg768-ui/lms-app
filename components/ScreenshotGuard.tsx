'use client';
import { useEffect } from 'react';

interface Props {
  screenshotGuard?: boolean;
  tabBlur?: boolean;
  screenCaptureBlock?: boolean;
}

export default function ScreenshotGuard({
  screenshotGuard = true,
  tabBlur = true,
  screenCaptureBlock = true,
}: Props) {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    if (screenshotGuard) {
      const noContext = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', noContext);

      const noKeys = (e: KeyboardEvent) => {
        const blocked = [
          (e.ctrlKey || e.metaKey) && e.key === 'p',
          (e.ctrlKey || e.metaKey) && e.key === 's',
          e.key === 'PrintScreen',
          e.key === 'F12',
          (e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()),
          (e.ctrlKey || e.metaKey) && e.key === 'u',
          e.metaKey && e.shiftKey && e.key === 's',
          e.key === 'F13',
        ];
        if (blocked.some(Boolean)) { e.preventDefault(); e.stopPropagation(); }
      };
      document.addEventListener('keydown', noKeys, true);

      const noDrag = (e: DragEvent) => e.preventDefault();
      document.addEventListener('dragstart', noDrag);

      cleanups.push(() => {
        document.removeEventListener('contextmenu', noContext);
        document.removeEventListener('keydown', noKeys, true);
        document.removeEventListener('dragstart', noDrag);
      });
    }

    if (tabBlur) {
      const blur = (els: NodeListOf<Element>) =>
        els.forEach((el) => ((el as HTMLElement).style.filter = 'blur(20px)'));
      const unblur = (els: NodeListOf<Element>) =>
        els.forEach((el) => ((el as HTMLElement).style.filter = ''));

      const handleVisibility = () => {
        const els = document.querySelectorAll('.pdf-protected, .protected-content');
        document.hidden ? blur(els) : unblur(els);
      };

      const onBlur = () => blur(document.querySelectorAll('.pdf-protected, .protected-content'));
      const onFocus = () => unblur(document.querySelectorAll('.pdf-protected, .protected-content'));

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);

      cleanups.push(() => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
      });
    }

    if (screenCaptureBlock) {
      let originalGetDisplayMedia: typeof navigator.mediaDevices.getDisplayMedia | null = null;
      if (navigator.mediaDevices?.getDisplayMedia) {
        originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = async () => {
          document.dispatchEvent(new CustomEvent('lms-capture-detected'));
          throw new DOMException('Screen capture is not permitted on this platform.', 'NotAllowedError');
        };
      }

      const handleCaptureDetected = () => {
        const overlay = document.createElement('div');
        overlay.id = 'lms-capture-warning';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#dc2626;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:bold;text-align:center;padding:2rem;';
        overlay.textContent = '⚠ Screen capture is not permitted on this platform. Your session has been flagged.';
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 4000);
      };
      document.addEventListener('lms-capture-detected', handleCaptureDetected);

      cleanups.push(() => {
        document.removeEventListener('lms-capture-detected', handleCaptureDetected);
        if (originalGetDisplayMedia && navigator.mediaDevices) {
          navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
        }
      });
    }

    return () => cleanups.forEach(fn => fn());
  }, [screenshotGuard, tabBlur, screenCaptureBlock]);

  return null;
}
