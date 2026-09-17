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
  Stethoscope,
  CalendarClock,
  UserCog,
  ShieldCheck,
  Wrench,
  Settings,
  ClipboardCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type Role = "admin" | "technician" | "reception";
export const ALL_ROLES: Role[] = ["admin", "technician", "reception"];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // Roles allowed to see/use this item; omitted = all roles.
  roles?: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const LAB = ["admin", "technician"] as Role[]; // lab bench + management
const FIN = ["admin", "reception"] as Role[]; // front-office / billing

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "الرئيسية",
    items: [
      { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
      { href: "/insights", label: "لوحة التحليلات", icon: BarChart3, roles: FIN },
    ],
  },
  {
    label: "المرضى والفحوصات",
    items: [
      { href: "/patients", label: "المرضى", icon: Users },
      { href: "/orders", label: "سجل العيّنات", icon: ClipboardList },
      { href: "/worklist", label: "طاولة المختبر", icon: FlaskConical, roles: LAB },
      { href: "/release", label: "تسليم النتائج", icon: ClipboardCheck, roles: FIN },
      { href: "/tests", label: "كتالوج الفحوصات", icon: FlaskConical, roles: LAB },
      { href: "/quality", label: "مراقبة الجودة", icon: ClipboardCheck, roles: LAB },
      { href: "/calendar", label: "التقويم اليومي", icon: CalendarDays },
    ],
  },
  {
    label: "المالية والمخزون",
    items: [
      { href: "/invoices", label: "الفواتير", icon: ReceiptText, roles: FIN },
      { href: "/inventory", label: "المخزون والكواشف", icon: Boxes, roles: LAB },
      { href: "/reorder", label: "إعادة الطلب", icon: PackagePlus, roles: LAB },
      { href: "/stock-balance", label: "أرصدة المخزون", icon: Scale, roles: LAB },
      { href: "/orders-expenses", label: "المصروفات", icon: ShoppingCart, roles: FIN },
    ],
  },
  {
    label: "المشتريات",
    items: [
      { href: "/purchase-orders", label: "أوامر الشراء", icon: ScrollText, roles: LAB },
      { href: "/suppliers", label: "الموردون", icon: Building2, roles: LAB },
    ],
  },
  {
    label: "العلاقات والمواعيد",
    items: [
      { href: "/appointments", label: "المواعيد", icon: CalendarClock },
      { href: "/referrers", label: "الأطباء المُحيلون", icon: Stethoscope },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { href: "/staff", label: "الكادر والبدلاء", icon: UserCog, roles: ["admin"] },
      { href: "/users", label: "المستخدمون", icon: UsersRound, roles: ["admin"] },
      { href: "/audit", label: "سجل التدقيق", icon: ShieldCheck, roles: ["admin"] },
      { href: "/tools", label: "الأدوات", icon: Wrench },
      { href: "/settings", label: "الإعدادات", icon: Settings, roles: ["admin"] },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Items visible to a given role (undefined roles = allowed). */
export function navForRole(role: string): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((it) => !it.roles || it.roles.includes(role as Role)),
  })).filter((g) => g.items.length > 0);
}
