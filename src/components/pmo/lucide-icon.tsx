'use client';

import * as React from 'react';
import {
  Boxes,
  Brush,
  Bug,
  Calendar,
  ChartBar,
  ChartLine,
  CircleAlert,
  CircleCheck,
  Cloud,
  Code2,
  Compass,
  Cpu,
  Database,
  Feather,
  FileCode2,
  Flag,
  Flame,
  Folder,
  Gauge,
  GanttChart,
  GitBranch,
  Globe,
  Hammer,
  Headphones,
  KanbanSquare,
  Layers,
  Lightbulb,
  Link as LinkIcon,
  ListTodo,
  Microscope,
  Monitor,
  Notebook,
  NotebookPen,
  Package,
  Palette,
  Paperclip,
  PencilRuler,
  Pin,
  Puzzle,
  Rocket,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Sticker,
  Target,
  Telescope,
  Terminal,
  TestTube2,
  Trophy,
  Users,
  UsersRound,
  Wand2,
  Wrench,
  Zap,
} from 'lucide-react';

/**
 * Whitelist of Lucide icons available to the task-list icon picker and
 * any read-only renderer (sidebar, navbar, etc.). Kept finite so we
 * don't ship the entire lucide-react tree. Keys are the kebab-case slugs
 * `iconName` is stored as on TaskList; values are the React components.
 *
 * To add an icon: import it at the top of this file and add an entry
 * here. Be conservative — every new entry costs bundle size.
 */
export const LUCIDE_ICON_MAP = {
  boxes: Boxes,
  brush: Brush,
  bug: Bug,
  calendar: Calendar,
  'chart-bar': ChartBar,
  'chart-line': ChartLine,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  cloud: Cloud,
  'code-2': Code2,
  compass: Compass,
  cpu: Cpu,
  database: Database,
  feather: Feather,
  'file-code-2': FileCode2,
  flag: Flag,
  flame: Flame,
  folder: Folder,
  gauge: Gauge,
  'gantt-chart': GanttChart,
  'git-branch': GitBranch,
  globe: Globe,
  hammer: Hammer,
  headphones: Headphones,
  'kanban-square': KanbanSquare,
  layers: Layers,
  lightbulb: Lightbulb,
  link: LinkIcon,
  'list-todo': ListTodo,
  microscope: Microscope,
  monitor: Monitor,
  notebook: Notebook,
  'notebook-pen': NotebookPen,
  package: Package,
  palette: Palette,
  paperclip: Paperclip,
  'pencil-ruler': PencilRuler,
  pin: Pin,
  puzzle: Puzzle,
  rocket: Rocket,
  search: Search,
  server: Server,
  'settings-2': Settings2,
  'shield-check': ShieldCheck,
  'shopping-cart': ShoppingCart,
  sparkles: Sparkles,
  star: Star,
  sticker: Sticker,
  target: Target,
  telescope: Telescope,
  terminal: Terminal,
  'test-tube-2': TestTube2,
  trophy: Trophy,
  users: Users,
  'users-round': UsersRound,
  'wand-2': Wand2,
  wrench: Wrench,
  zap: Zap,
} as const;

export type LucideIconKey = keyof typeof LUCIDE_ICON_MAP;

export const LUCIDE_ICON_KEYS = Object.keys(LUCIDE_ICON_MAP) as LucideIconKey[];

/**
 * Render a Lucide icon by its kebab-case key. Unknown keys fall back to
 * `list-todo` so the UI never breaks if the backend ships a new key
 * before the frontend is rebuilt.
 */
export function LucideIcon({
  name,
  className,
  strokeWidth = 2.25,
  size,
}: {
  name: string | null | undefined;
  className?: string;
  strokeWidth?: number;
  size?: number;
}) {
  const key = (name && name in LUCIDE_ICON_MAP ? name : 'list-todo') as LucideIconKey;
  const Cmp = LUCIDE_ICON_MAP[key];
  const sizeProp = size ? { width: size, height: size } : {};
  return <Cmp className={className} strokeWidth={strokeWidth} {...sizeProp} />;
}
