import { useEffect, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type KeyboardAvoiderProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  offset?: number;
};

/**
 * Alto del teclado en pantalla en el navegador del móvil. Chrome para Android encoge la página
 * con el teclado (`interactive-widget=resizes-content` en `+html.tsx`) y aquí da 0; Safari en
 * iPhone no lo hace: solo encoge el `visualViewport`, y la diferencia es lo que tapa el teclado.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

/** Versión web de `KeyboardAvoider`: deja abajo el hueco que ocupa el teclado. */
export function KeyboardAvoider({ children, style }: KeyboardAvoiderProps) {
  const inset = useKeyboardInset();
  return <View style={[style, inset > 0 && { paddingBottom: inset }]}>{children}</View>;
}
