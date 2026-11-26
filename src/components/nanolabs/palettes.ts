export interface ColorPalette {
  id: string;
  name: string;
  badge: string;
  primary: string;
  hover: string;
  subtle: string;
  subtlest: string;
  darkSubtlest: string;
  gradient: string;
  glow: string;
}

export const PALETTES: Record<string, ColorPalette> = {
  orange: {
    id: 'orange',
    name: 'NanoLabs Sunset',
    badge: 'Naranja',
    primary: '#FF6600',
    hover: '#E25700',
    subtle: '#FFAD75',
    subtlest: '#FFF4EA',
    darkSubtlest: '#381A05',
    gradient: 'linear-gradient(135deg, #FF8A2B, #E25700)',
    glow: 'rgba(226, 87, 0, 0.35)',
  },
  blue: {
    id: 'blue',
    name: 'Orion Royal',
    badge: 'Azul',
    primary: '#2563EB',
    hover: '#1D4ED8',
    subtle: '#60A5FA',
    subtlest: '#EFF6FF',
    darkSubtlest: '#0F2347',
    gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
    glow: 'rgba(37, 99, 235, 0.35)',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Racing',
    badge: 'Verde',
    primary: '#059669',
    hover: '#047857',
    subtle: '#34D399',
    subtlest: '#ECFDF5',
    darkSubtlest: '#062E20',
    gradient: 'linear-gradient(135deg, #10B981, #047857)',
    glow: 'rgba(16, 185, 129, 0.35)',
  },
  purple: {
    id: 'purple',
    name: 'Purple Nebula',
    badge: 'Violeta',
    primary: '#7C3AED',
    hover: '#6D28D9',
    subtle: '#A78BFA',
    subtlest: '#F5F3FF',
    darkSubtlest: '#2B124C',
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    glow: 'rgba(124, 58, 237, 0.35)',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Sport',
    badge: 'Rojo',
    primary: '#DC2626',
    hover: '#B91C1C',
    subtle: '#F87171',
    subtlest: '#FEF2F2',
    darkSubtlest: '#3B0F0F',
    gradient: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    glow: 'rgba(220, 38, 38, 0.35)',
  },
  amber: {
    id: 'amber',
    name: 'Cyber Gold',
    badge: 'Ámbar',
    primary: '#D97706',
    hover: '#B45309',
    subtle: '#FBBF24',
    subtlest: '#FFFBEB',
    darkSubtlest: '#3D2405',
    gradient: 'linear-gradient(135deg, #F59E0B, #B45309)',
    glow: 'rgba(217, 119, 6, 0.35)',
  },
  slate: {
    id: 'slate',
    name: 'Titanium Stealth',
    badge: 'Carbón',
    primary: '#475569',
    hover: '#334155',
    subtle: '#94A3B8',
    subtlest: '#F8FAFC',
    darkSubtlest: '#1E293B',
    gradient: 'linear-gradient(135deg, #64748B, #334155)',
    glow: 'rgba(71, 85, 105, 0.35)',
  },
};

export const DEFAULT_PALETTE_ID = 'orange';

export function getPalette(id?: string | null): ColorPalette {
  if (id && PALETTES[id]) return PALETTES[id];
  return PALETTES[DEFAULT_PALETTE_ID];
}

export function applyPaletteToDOM(palette: ColorPalette, isDark = false) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const subtlest = isDark ? palette.darkSubtlest : palette.subtlest;
  const bold = isDark ? palette.subtle : palette.hover;
  const primary = palette.primary;

  root.style.setProperty('--or', primary);
  root.style.setProperty('--or-dark', bold);
  root.style.setProperty('--or-tint', subtlest);
  root.style.setProperty('--or-ring', palette.glow);

  root.style.setProperty('--bg-primary-default', primary);
  root.style.setProperty('--bg-primary-bold', bold);
  root.style.setProperty('--bg-primary-subtle', palette.subtle);
  root.style.setProperty('--bg-primary-subtlest', subtlest);
  root.style.setProperty('--bg-accent-default', primary);
  root.style.setProperty('--bg-accent-subtle', palette.subtle);
  root.style.setProperty('--bg-accent-subtlest', subtlest);

  root.style.setProperty('--text-primary-default', isDark ? palette.subtle : primary);
  root.style.setProperty('--text-primary-subtle', bold);
  root.style.setProperty('--text-primary-on-subtlest', isDark ? palette.subtle : palette.hover);
  root.style.setProperty('--icon-primary-default', isDark ? palette.subtle : primary);
  root.style.setProperty('--icon-primary-on-subtlest', isDark ? palette.subtle : palette.hover);
  root.style.setProperty('--border-primary-default', primary);
  root.style.setProperty('--border-primary-bold', bold);

  root.style.setProperty('--btn-bg-enabled', primary);
  root.style.setProperty('--btn-bg-hover', palette.hover);
  root.style.setProperty('--btn-bg-hover-subtle', subtlest);
  root.style.setProperty('--btn-border-enabled', primary);
  root.style.setProperty('--btn-border-hover', bold);
  root.style.setProperty('--btn-text-enabled', isDark ? palette.subtle : primary);
  root.style.setProperty('--btn-text-hover', bold);
  root.style.setProperty('--btn-icon-enabled', isDark ? palette.subtle : primary);
  root.style.setProperty('--btn-icon-hover', bold);

  root.style.setProperty('--color-brand', primary);
  root.style.setProperty('--color-brand-hover', palette.hover);
  root.style.setProperty('--color-brand-ring', palette.glow);
  root.style.setProperty('--nl-mark-gradient', palette.gradient);
  root.style.setProperty('--nl-mark-glow', palette.glow);
}
