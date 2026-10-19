import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { showSnackbar } from '@/stores/snackbar-store';
import { radius, spacing, useTheme } from '@/theme';

import { permissionDenied } from '../actions';
import { formatDuration } from '../mime';
import { addAttachments } from '../repository';

/** Voz: mono y 64 kbps bastan (AAC/m4a en iOS y Android; WebM en web). */
const VOICE_PRESET: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64_000,
};

const MIME = process.env.EXPO_OS === 'web' ? 'audio/webm' : 'audio/mp4';

type VoiceRecorderSheetProps = {
  noteId: string;
  visible: boolean;
  onClose: () => void;
};

/** Hoja de grabación: empieza a grabar al abrirse; "Guardar" adjunta el audio a la nota. */
export function VoiceRecorderSheet({ noteId, visible, onClose }: VoiceRecorderSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Nota de voz">
      {/* El grabador solo existe mientras la hoja está abierta. */}
      {visible ? <Recorder noteId={noteId} onClose={onClose} /> : null}
    </Sheet>
  );
}

type Phase = 'starting' | 'recording' | 'saving';

function Recorder({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const { colors } = useTheme();
  const recorder = useAudioRecorder(VOICE_PRESET);
  const state = useAudioRecorderState(recorder, 200);
  const [phase, setPhase] = useState<Phase>('starting');
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        // Cerrada mientras se pedía el permiso: no se empieza a grabar.
        if (cancelled) return;
        if (!permission.granted) {
          onClose();
          await permissionDenied('el micrófono', permission.canAskAgain);
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        recorder.record();
        setPhase('recording');
      } catch (e) {
        if (cancelled) return;
        console.warn('Grabación: no se pudo empezar', e);
        showSnackbar('No se pudo empezar a grabar');
        onClose();
      }
    })();
    return () => {
      cancelled = true;
      // Cerrar sin guardar (deslizar, atrás, Cancelar): se descarta la grabación.
      if (!finished.current) void stopRecording(recorder);
    };
    // Solo al montar: la hoja se vuelve a montar en cada apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    finished.current = true;
    setPhase('saving');
    const durationMs = recorder.getStatus().durationMillis;
    await stopRecording(recorder);
    const uri = recorder.uri;
    try {
      if (!uri) throw new Error('La grabación no tiene fichero');
      await addAttachments(noteId, [
        { kind: 'audio', uri, mime: MIME, durationMs, temporary: true },
      ]);
    } catch (e) {
      console.warn('Grabación: no se pudo guardar', e);
      showSnackbar('No se pudo guardar la nota de voz');
    }
    onClose();
  };

  const recording = phase === 'recording';

  return (
    <View style={styles.body}>
      <View style={styles.timer}>
        <View
          style={[
            styles.dot,
            { backgroundColor: recording ? colors.danger : colors.textMuted },
            recording && Math.floor(state.durationMillis / 600) % 2 === 1 && styles.dotDim,
          ]}
        />
        <Text variant="largeTitle" accessibilityLiveRegion="polite">
          {formatDuration(state.durationMillis)}
        </Text>
      </View>
      <Text tone="secondary" style={styles.hint}>
        {phase === 'starting'
          ? 'Preparando el micrófono…'
          : phase === 'saving'
            ? 'Guardando…'
            : 'Grabando. Pulsa "Guardar" cuando termines.'}
      </Text>
      <View style={styles.actions}>
        <Button title="Cancelar" variant="secondary" onPress={onClose} style={styles.action} />
        {phase === 'saving' ? (
          <View style={[styles.action, styles.saving]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Button
            title="Guardar"
            icon="stop"
            disabled={!recording}
            onPress={() => void save()}
            style={styles.action}
          />
        )}
      </View>
    </View>
  );
}

async function stopRecording(recorder: ReturnType<typeof useAudioRecorder>) {
  try {
    if (recorder.isRecording) await recorder.stop();
  } catch (e) {
    console.warn('Grabación: error al detener', e);
  }
  // En iOS, con la grabación activa el audio sale por el auricular: se restablece.
  await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  dot: { width: 14, height: 14, borderRadius: radius.pill },
  dotDim: { opacity: 0.3 },
  hint: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  saving: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
