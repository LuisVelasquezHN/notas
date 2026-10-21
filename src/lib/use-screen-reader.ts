import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** `true` con VoiceOver/TalkBack activos (p. ej. para dar más tiempo a los mensajes temporales). */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return enabled;
}
