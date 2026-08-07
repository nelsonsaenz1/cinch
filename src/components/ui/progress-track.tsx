import { View } from 'react-native';

export type ProgressTrackProps = {
  /** Fraction complete, 0–1. */
  value: number;
  /**
   * `accentWarm` is a ratio of data (a wear count against its own maximum);
   * `accent` is a task in flight (an import, a learning threshold). The bar
   * means one thing per colour rather than whatever the screen felt like.
   */
  tone?: 'accent' | 'accentWarm';
  /**
   * Track height. Every track in the app is 5pt except the capture importer's,
   * which runs at 6 — preserved as a real prop rather than folded into one
   * number, since normalising it would be a visible height change there.
   */
  height?: 5 | 6;
  className?: string;
};

/**
 * The sand track with a coloured fill — three call sites hand-typed this at
 * 5/5/6pt with two different fill colours before this existed.
 */
export function ProgressTrack({ value, tone = 'accent', height = 5, className = '' }: ProgressTrackProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <View className={`overflow-hidden rounded-full bg-sand ${className}`} style={{ height }}>
      <View
        className={`h-full rounded-full ${tone === 'accentWarm' ? 'bg-accent-warm' : 'bg-accent'}`}
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
