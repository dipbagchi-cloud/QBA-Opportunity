import {useState, useCallback, useRef} from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
};

const DEFAULTS: ToastState = {
  visible: false,
  message: '',
  type: 'info',
  duration: 3000,
};

export function useToast() {
  const [toast, setToast] = useState<ToastState>(DEFAULTS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration = 3000) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setToast({visible: true, message, type, duration});
      timerRef.current = setTimeout(() => {
        setToast(prev => ({...prev, visible: false}));
      }, duration);
    },
    [],
  );

  const success = useCallback((msg: string, duration?: number) => show(msg, 'success', duration), [show]);
  const error = useCallback((msg: string, duration?: number) => show(msg, 'error', duration), [show]);
  const warning = useCallback((msg: string, duration?: number) => show(msg, 'warning', duration), [show]);
  const info = useCallback((msg: string, duration?: number) => show(msg, 'info', duration), [show]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(prev => ({...prev, visible: false}));
  }, []);

  return {
    toast,
    show,
    success,
    error,
    warning,
    info,
    hide,
  };
}
