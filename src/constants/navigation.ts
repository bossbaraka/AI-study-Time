import {
  Award,
  Bell,
  BrainCircuit,
  BookOpen,
  CalendarCheck,
  ChartLine,
  CreditCard,
  Crosshair,
  Flame,
  GraduationCap,
  LifeBuoy,
  Lightbulb,
  Map,
  MessageSquareText,
  ScrollText,
  Settings,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
}

/**
 * Sidebar information architecture — mirrors the product philosophy:
 * Today → Journey → Learning → Intelligence → Support → Achievement → System.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "today",
    labelKey: "nav.section.today",
    items: [
      { href: "/app", labelKey: "nav.myDay", icon: CalendarCheck },
      { href: "/app/mission", labelKey: "nav.currentMission", icon: Crosshair },
    ],
  },
  {
    id: "journey",
    labelKey: "nav.section.journey",
    items: [
      { href: "/app/goal", labelKey: "nav.myGoal", icon: Target },
      { href: "/app/roadmap", labelKey: "nav.roadmap", icon: Map },
      { href: "/app/progress", labelKey: "nav.progress", icon: ChartLine },
    ],
  },
  {
    id: "learning",
    labelKey: "nav.section.learning",
    items: [
      { href: "/app/learning", labelKey: "nav.learning", icon: BookOpen },
      { href: "/app/recall", labelKey: "nav.recall", icon: BrainCircuit },
      { href: "/app/tests", labelKey: "nav.tests", icon: ScrollText },
      { href: "/app/mastery", labelKey: "mastery.title", icon: Flame },
    ],
  },
  {
    id: "intelligence",
    labelKey: "nav.section.intelligence",
    items: [
      { href: "/app/profile", labelKey: "nav.profile", icon: GraduationCap },
      { href: "/app/behavior", labelKey: "nav.behavior", icon: Timer },
      { href: "/app/insights", labelKey: "nav.insights", icon: Lightbulb },
    ],
  },
  {
    id: "support",
    labelKey: "nav.section.support",
    items: [
      { href: "/app/mentor", labelKey: "nav.mentor", icon: MessageSquareText },
      { href: "/app/recovery", labelKey: "nav.recovery", icon: LifeBuoy },
    ],
  },
  {
    id: "achievement",
    labelKey: "nav.section.achievement",
    items: [
      { href: "/app/achievements", labelKey: "nav.achievements", icon: Award },
      { href: "/app/certificates", labelKey: "nav.certificates", icon: ScrollText },
    ],
  },
  {
    id: "system",
    labelKey: "nav.section.system",
    items: [
      { href: "/app/notifications", labelKey: "nav.notifications", icon: Bell },
      { href: "/app/settings", labelKey: "nav.settings", icon: Settings },
      { href: "/app/subscription", labelKey: "nav.subscription", icon: CreditCard },
    ],
  },
];

/** Bottom navigation for mobile — the five most important destinations. */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/app", labelKey: "nav.myDay", icon: CalendarCheck },
  { href: "/app/mission", labelKey: "nav.currentMission", icon: Crosshair },
  { href: "/app/roadmap", labelKey: "nav.roadmap", icon: Map },
  { href: "/app/recall", labelKey: "nav.recall", icon: BrainCircuit },
  { href: "/app/mentor", labelKey: "nav.mentor", icon: MessageSquareText },
];
