import {
  AudioLines,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileText,
  HardDrive,
  Layers,
  Languages,
  LayoutDashboard,
  Library,
  MessagesSquare,
  Mic,
  RefreshCw,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Explicit map rather than a dynamic lucide lookup: this keeps the bundle to
 * the icons the sidebar actually uses instead of pulling in the whole
 * icon set, which matters on a tablet over a slow rural connection.
 */
const ICONS: Record<string, LucideIcon> = {
  HardDrive,
  LayoutDashboard,
  Languages,
  MessagesSquare,
  Mic,
  BookOpen,
  Library,
  FileText,
  Layers,
  ClipboardCheck,
  AudioLines,
  RefreshCw,
  BarChart3,
  Settings,
  ShieldCheck,
};

export function NavIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden />;
}
