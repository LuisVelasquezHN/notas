import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

type KeyboardAvoiderProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Distancia desde arriba de la pantalla hasta esta vista (p. ej. la cabecera). */
  offset?: number;
};

/**
 * Deja sitio al teclado en pantalla para que no tape los campos. En iOS y Android usa
 * react-native-keyboard-controller: el `KeyboardAvoidingView` de React Native no hace nada en
 * Android de borde a borde (SDK 54+), donde la ventana ya no se redimensiona con el teclado, y
 * este también funciona dentro de un `Modal` (las hojas). En web, ver `keyboard-avoider.web.tsx`.
 */
export function KeyboardAvoider({ children, style, offset = 0 }: KeyboardAvoiderProps) {
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={offset} style={style}>
      {children}
    </KeyboardAvoidingView>
  );
}
