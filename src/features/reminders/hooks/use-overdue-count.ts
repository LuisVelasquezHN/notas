import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { useNow } from '@/lib/use-now';

import { overdueCount } from '../groups';
import { activeRemindersQuery } from '../repository';

/** Recordatorios vencidos (badge de la pestaña Recordatorios). */
export function useOverdueCount(): number {
  const { data } = useLiveQuery(activeRemindersQuery());
  return overdueCount(data, useNow());
}
