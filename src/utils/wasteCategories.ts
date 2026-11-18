import React from 'react';
import {
  Biohazard,
  FlaskConical,
  HelpCircle,
  Package,
  Syringe,
} from 'lucide-react';

export interface WasteCategoryDescriptor {
  streamLabel: string;
  colorHex: string;
  textHex: string;
  borderHex: string;
  bgTintHex: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STREAM_PRESETS: Record<'yellow' | 'red' | 'white' | 'blue' | 'neutral', WasteCategoryDescriptor> = {
  yellow: {
    streamLabel: 'Yellow (Infectious)',
    colorHex: '#D97706',
    textHex: '#92400E',
    borderHex: '#FCD34D',
    bgTintHex: '#FFFBEB',
    icon: Biohazard,
  },
  red: {
    streamLabel: 'Red (Contaminated)',
    colorHex: '#DC2626',
    textHex: '#991B1B',
    borderHex: '#FCA5A5',
    bgTintHex: '#FEF2F2',
    icon: Package,
  },
  white: {
    streamLabel: 'White / Sharps',
    colorHex: '#475569',
    textHex: '#334155',
    borderHex: '#CBD5E1',
    bgTintHex: '#F8FAFC',
    icon: Syringe,
  },
  blue: {
    streamLabel: 'Blue (Glassware / Pharma)',
    colorHex: '#2563EB',
    textHex: '#1E40AF',
    borderHex: '#93C5FD',
    bgTintHex: '#EFF6FF',
    icon: FlaskConical,
  },
  neutral: {
    streamLabel: 'Configured Class',
    colorHex: '#4338CA',
    textHex: '#3730A3',
    borderHex: '#E5E5E5',
    bgTintHex: '#FCFBF9',
    icon: HelpCircle,
  },
};

export function resolveWasteCategoryVisual(
  classCode: string | null | undefined,
  configuredHex?: string | null
): WasteCategoryDescriptor {
  const normalized = (classCode || '').toLowerCase();

  if (
    normalized.includes('yellow') ||
    normalized.includes('infect') ||
    normalized.includes('gauze') ||
    normalized.includes('swab') ||
    normalized.includes('patholog') ||
    normalized.includes('anatom') ||
    normalized.includes('glove')
  ) {
    return {
      ...STREAM_PRESETS.yellow,
      colorHex: configuredHex || STREAM_PRESETS.yellow.colorHex,
    };
  }

  if (
    normalized.includes('red') ||
    normalized.includes('tubing') ||
    normalized.includes('iv_') ||
    normalized.includes('catheter') ||
    normalized.includes('plastic') ||
    normalized.includes('bag')
  ) {
    return {
      ...STREAM_PRESETS.red,
      colorHex: configuredHex || STREAM_PRESETS.red.colorHex,
    };
  }

  if (
    normalized.includes('white') ||
    normalized.includes('sharp') ||
    normalized.includes('needle') ||
    normalized.includes('scalpel') ||
    normalized.includes('syringe') ||
    normalized.includes('lancet')
  ) {
    return {
      ...STREAM_PRESETS.white,
      colorHex: configuredHex || STREAM_PRESETS.white.colorHex,
    };
  }

  if (
    normalized.includes('blue') ||
    normalized.includes('glass') ||
    normalized.includes('vial') ||
    normalized.includes('ampoule') ||
    normalized.includes('metal')
  ) {
    return {
      ...STREAM_PRESETS.blue,
      colorHex: configuredHex || STREAM_PRESETS.blue.colorHex,
    };
  }

  return {
    ...STREAM_PRESETS.neutral,
    colorHex: configuredHex || STREAM_PRESETS.neutral.colorHex,
  };
}
