import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  DIAGNOSTICS_FOOTNOTE,
  diagnosticLines,
  type SupportDiagnostics,
} from '@/features/help/diagnostics';

/**
 * "Sent with your note" — HS-04's tray panel.
 *
 * The atlas writes the contents as one run-on sentence ("Your handle, app
 * version 2.4.1, iPhone 15 Pro, iOS 19.2"). This sets them as a list, for a
 * reason the atlas's own rule implies: a comma-separated string is scanned, and
 * the panel exists to be READ. Four short lines are four things a person can
 * check; one sentence is a shrug.
 *
 * Every line comes from `diagnosticLines`, which is generated from the object
 * that is actually sent — so the panel cannot drift from the payload by anyone
 * editing copy here.
 *
 * `note` / `noteSmall` throughout, never `label` / `caption`: both of those
 * carry `font-medium`, and the whole panel is a murmur.
 */
export function DiagnosticsPanel({
  diagnostics,
  /** Named only once a file is really attached. */
  attachmentName = null,
}: {
  diagnostics: SupportDiagnostics;
  attachmentName?: string | null;
}) {
  const lines = diagnosticLines(diagnostics);

  return (
    <View
      className="rounded-lg bg-tray p-4"
      accessible
      accessibilityLabel={`Sent with your note. ${lines.join(' ')} ${
        attachmentName ? 'The screenshot you attached. ' : ''
      }${DIAGNOSTICS_FOOTNOTE}`}>
      <Text variant="body">Sent with your note</Text>

      <View className="mt-2" style={{ gap: 4 }}>
        {lines.map((line) => (
          <Text key={line} variant="note">
            {line}
          </Text>
        ))}
        {attachmentName ? (
          <Text variant="note">The screenshot you attached, {attachmentName}.</Text>
        ) : null}
      </View>

      {/* The line that makes both halves true at once — nothing is taken from
          the closet, and a file the reader chose is obviously in the note.
          Separated by a hairline so it reads as the panel's terms rather than
          as a fifth item in the list. */}
      <Text variant="noteSmall" className="mt-3 border-t border-hairline pt-3">
        {DIAGNOSTICS_FOOTNOTE}
      </Text>
    </View>
  );
}
