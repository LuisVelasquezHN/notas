import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import type { Attachment } from '@/db/schema';
import { radius, spacing, useTheme } from '@/theme';

import { deleteAttachment } from '../actions';
import { formatDuration } from '../mime';
import { resolveUri } from '../storage';

type AudioListProps = {
  audios: Attachment[];
  editable: boolean;
};

/** Notas de voz de la nota: reproducir/pausar, progreso y borrar. */
export function AudioList({ audios, editable }: AudioListProps) {
  const { t } = useTranslation();
  if (audios.length === 0) return null;
  return (
    <View style={styles.list}>
      {audios.map((audio, i) => (
        <AudioRow
          key={audio.id}
          audio={audio}
          label={
            audios.length > 1
              ? t('attachments.voiceNoteN', { n: i + 1 })
              : t('attachments.voiceNote')
          }
          editable={editable}
        />
      ))}
    </View>
  );
}

function AudioRow({
  audio,
  label,
  editable,
}: {
  audio: Attachment;
  label: string;
  editable: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const player = useAudioPlayer(resolveUri(audio.localUri), { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  // En web, las grabaciones WebM de Chrome no traen duración: se usa la medida al grabar.
  const durationMs =
    status.duration && Number.isFinite(status.duration) ? status.duration * 1000 : audio.durationMs;
  const positionMs = status.currentTime * 1000;
  const progress = durationMs ? Math.min(1, positionMs / durationMs) : 0;
  const atEnd = status.didJustFinish || (durationMs ? positionMs >= durationMs - 50 : false);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    // Reproducir aunque el iPhone esté en silencio (es una acción explícita del usuario).
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    if (atEnd) await player.seekTo(0);
    player.play();
  };

  return (
    <View style={[styles.row, { backgroundColor: colors.surfaceMuted }]}>
      <IconButton
        icon={status.playing ? 'pause' : 'play'}
        accessibilityLabel={
          status.playing ? t('attachments.pause', { label }) : t('attachments.play', { label })
        }
        color={colors.text}
        onPress={() => void toggle()}
      />
      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
        <Text variant="caption" tone="secondary">
          {status.playing || positionMs > 0
            ? `${formatDuration(positionMs)} / ${formatDuration(durationMs)}`
            : `${label} · ${formatDuration(durationMs)}`}
        </Text>
      </View>
      {editable ? (
        <IconButton
          icon="close"
          size={18}
          accessibilityLabel={t('attachments.deleteNamed', { label })}
          color={colors.textSecondary}
          onPress={() => {
            player.pause();
            void deleteAttachment(audio);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
  },
  body: { flex: 1, gap: spacing.xs },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
});
