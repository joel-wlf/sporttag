import type { Href } from 'expo-router';
import type { IconName } from '@/components/ui/Icon';

export type NavigationItem = {
  /** Route-Segment innerhalb von `app/(backoffice)`. */
  name: string;
  href: Href;
  label: string;
  tabLabel: string;
  icon: IconName;
  children?: NavigationItem[];
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

const events: NavigationItem = {
  name: 'index',
  href: '/',
  label: 'Event-Portfolio',
  tabLabel: 'Events',
  icon: 'overview',
};

const planningTeams: NavigationItem = {
  name: 'planning-teams',
  href: '/planning/teams',
  label: 'Teams',
  tabLabel: 'Teams',
  icon: 'user',
};

const planningGames: NavigationItem = {
  name: 'planning-games',
  href: '/planning/games',
  label: 'Spiele & Wertung',
  tabLabel: 'Spiele',
  icon: 'results',
};

const planningVenue: NavigationItem = {
  name: 'planning-venue',
  href: '/planning/venue',
  label: 'Gelände & Stationen',
  tabLabel: 'Gelände',
  icon: 'map-pin',
};

const planningSchedule: NavigationItem = {
  name: 'planning-schedule',
  href: '/planning/schedule',
  label: 'Zeitplan & Matches',
  tabLabel: 'Zeitplan',
  icon: 'clock',
};

const planningStaff: NavigationItem = {
  name: 'planning-staff',
  href: '/planning/staff',
  label: 'Betreuung',
  tabLabel: 'Betreuung',
  icon: 'shield',
};

const planning: NavigationItem = {
  name: 'planning',
  href: '/planning',
  label: 'Planung',
  tabLabel: 'Planung',
  icon: 'planning',
  children: [planningTeams, planningGames, planningVenue, planningSchedule, planningStaff],
};

const live: NavigationItem = {
  name: 'live',
  href: '/live',
  label: 'Live-Betrieb',
  tabLabel: 'Live',
  icon: 'live',
};

const results: NavigationItem = {
  name: 'results',
  href: '/results',
  label: 'Ergebnisse & Tabelle',
  tabLabel: 'Ergebnis',
  icon: 'results',
};

export const moreTab: NavigationItem = {
  name: 'more',
  href: '/more',
  label: 'Mehr',
  tabLabel: 'Mehr',
  icon: 'menu',
};

const overview: NavigationItem = {
  name: 'overview',
  href: '/more/overview',
  label: 'Übersicht',
  tabLabel: 'Übersicht',
  icon: 'overview',
};

const publish: NavigationItem = {
  name: 'publish',
  href: '/more/publish',
  label: 'Freigabe & Veröffentlichung',
  tabLabel: 'Freigabe',
  icon: 'upload',
};

const devices: NavigationItem = {
  name: 'devices',
  href: '/more/devices',
  label: 'Geräte & Synchronisierung',
  tabLabel: 'Geräte',
  icon: 'devices',
};

const settings: NavigationItem = {
  name: 'settings',
  href: '/more/settings',
  label: 'Event-Einstellungen',
  tabLabel: 'Event',
  icon: 'settings',
};

const gameTemplates: NavigationItem = {
  name: 'game-templates',
  href: '/more/game-templates',
  label: 'Spielvorlagen',
  tabLabel: 'Vorlagen',
  icon: 'package',
};

const account: NavigationItem = {
  name: 'account',
  href: '/more/account',
  label: 'Konto',
  tabLabel: 'Konto',
  icon: 'user',
};

/**
 * Backoffice-Navigation entlang des Event-Lebenszyklus:
 * konfigurieren → planen → veröffentlichen → betreiben → abgleichen.
 * Auf breiten Bildschirmen als gruppierte Sidebar, auf Smartphones als Tabs.
 */
export const sidebarGroups: NavigationGroup[] = [
  { title: 'Events', items: [events] },
  {
    title: 'Veranstaltung',
    items: [overview, planning, publish, live, results, devices, settings],
  },
  { title: 'Bibliothek', items: [gameTemplates] },
  { title: 'Konto', items: [account] },
];

/** In der Tab-Leiste sichtbare Hauptbereiche. */
export const tabItems: NavigationItem[] = [events, planning, live, results, moreTab];

/** Module, die auf Smartphones unter „Mehr“ gebündelt sind. */
export const moreLinks: NavigationItem[] = [
  overview,
  publish,
  devices,
  settings,
  gameTemplates,
  account,
];
