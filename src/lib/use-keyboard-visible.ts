import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Si el teclado en pantalla está abierto (en web, siempre `false`). */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // En iOS "will" llega antes de la animación; en Android solo existen los eventos "did".
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, () => setVisible(true)),
      Keyboard.addListener(hide, () => setVisible(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return visible;
}
