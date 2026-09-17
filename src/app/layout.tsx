import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccess } from "@/lib/permissions";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spir Lab Manager — إدارة مختبر التحاليل",
  description:
    "تطبيق احترافي لإدارة مختبرات التحاليل الطبية: المرضى، النتائج، مخزون الكواشف، والكادر.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = headers().get("x-pathname") ?? "";
  const isBare = pathname === "/login" || pathname.startsWith("/login/");
  const user = isBare ? null : await getCurrentUser();

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* No-flash theme: apply the saved (or system) theme before paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('lab-theme');if(t==='dark'||(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <Toaster position="top-center" richColors />
        {isBare || !user ? (
          children
        ) : (
          <OfflineProvider>
          <div className="flex min-h-screen">
            <Sidebar role={user.role} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar user={user} />
              <main className="flex-1 p-5 md:p-7">
                {canAccess(pathname, user.role) ? (
                  children
                ) : (
                  <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
                    <div className="mb-2 text-lg font-bold">لا تملك صلاحية الوصول</div>
                    <p className="text-sm text-muted">
                      هذه الصفحة مقيّدة بدورك الحالي ({user.role}). راجع مدير النظام.
                    </p>
                  </div>
                )}
              </main>
            </div>
          </div>
          </OfflineProvider>
        )}
      </body>
    </html>
  );
}
