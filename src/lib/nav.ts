import {
  LayoutDashboard,
  Users,
  FlaskConical,
  ClipboardList,
  Boxes,
  ShoppingCart,
  CalendarDays,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Ordered to match the PDF specification sections, lab-management only.
export const NAV: NavItem[] = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/patients", label: "المرضى", icon: Users },
  { href: "/orders", label: "الفحوصات والنتائج", icon: ClipboardList },
  { href: "/tests", label: "كتالوج الفحوصات", icon: FlaskConical },
  { href: "/inventory", label: "المخزون والكواشف", icon: Boxes },
  { href: "/orders-expenses", label: "الطلبيات والمصروفات", icon: ShoppingCart },
  { href: "/calendar", label: "التقويم اليومي", icon: CalendarDays },
  { href: "/staff", label: "الكادر والبدلاء", icon: UserCog },
];
