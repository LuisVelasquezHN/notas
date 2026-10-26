import { Image } from 'expo-image';

import { APP_NAME } from '@/lib/app-info';

const LOGO = require('../../../assets/images/splash-icon.png');

/** Logo de LV Notes (la hoja con "LV", sin fondo). */
export function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size }}
      accessibilityLabel={APP_NAME}
      accessibilityIgnoresInvertColors
    />
  );
}
