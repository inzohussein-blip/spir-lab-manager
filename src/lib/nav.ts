import {
  LayoutDashboard,
  BarChart3,
  Users,
  ClipboardList,
  FlaskConical,
  CalendarDays,
  Boxes,
  ShoppingCart,
  ReceiptText,
  PackagePlus,
  Scale,
  ScrollText,
  Building2,
  UserCog,
  ShieldCheck,
  Wrench,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped workspaces (Spir-Margin "desk" style), also feeding the command
// palette. Lab-management only.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "الرئيسية",
    items: [
      { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
      { href: "/insights", label: "لوحة التحليلات", icon: BarChart3 },
    ],
  },
  {
    label: "المرضى والفحوصات",
    items: [
      { href: "/patients", label: "المرضى", icon: Users },
      { href: "/orders", label: "سجل العيّنات", icon: ClipboardList },
      { href: "/tests", label: "كتالوج الفحوصات", icon: FlaskConical },
      { href: "/calendar", label: "التقويم اليومي", icon: CalendarDays },
    ],
  },
  {
    label: "المالية والمخزون",
    items: [
      { href: "/invoices", label: "الفواتير", icon: ReceiptText },
      { href: "/inventory", label: "المخزون والكواشف", icon: Boxes },
      { href: "/reorder", label: "إعادة الطلب", icon: PackagePlus },
      { href: "/stock-balance", label: "أرصدة المخزون", icon: Scale },
      { href: "/orders-expenses", label: "المصروفات", icon: ShoppingCart },
    ],
  },
  {
    label: "المشتريات",
    items: [
      { href: "/purchase-orders", label: "أوامر الشراء", icon: ScrollText },
      { href: "/suppliers", label: "الموردون", icon: Building2 },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { href: "/staff", label: "الكادر والبدلاء", icon: UserCog },
      { href: "/audit", label: "سجل التدقيق", icon: ShieldCheck },
      { href: "/tools", label: "الأدوات", icon: Wrench },
      { href: "/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

// Flat list (command palette, breadcrumbs, etc.).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
