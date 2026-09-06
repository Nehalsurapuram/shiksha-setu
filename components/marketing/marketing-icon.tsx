import {
  ArrowRight,
  BookHeart,
  BookOpen,
  Braces,
  CloudDownload,
  CloudOff,
  FileInput,
  FileText,
  GraduationCap,
  HardDrive,
  Languages,
  Layers,
  MessageSquareOff,
  Mic,
  School,
  Sparkles,
  User,
  Users,
  Volume2,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

/** Explicit map so only the icons the site uses reach the bundle. */
const ICONS: Record<string, LucideIcon> = {
  ArrowRight,
  BookHeart,
  BookOpen,
  Braces,
  CloudDownload,
  CloudOff,
  FileInput,
  FileText,
  GraduationCap,
  HardDrive,
  Languages,
  Layers,
  MessageSquareOff,
  Mic,
  School,
  Sparkles,
  User,
  Users,
  Volume2,
  WifiOff,
};

export function MarketingIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
