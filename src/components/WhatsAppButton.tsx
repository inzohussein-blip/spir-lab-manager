"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { sendReportWhatsApp } from "@/app/actions/whatsapp";

export function WhatsAppButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const res = await sendReportWhatsApp(orderId);
      if (!res.ok) {
        toast.error(res.error ?? "تعذّر الإرسال");
        return;
      }
      if (res.via === "wa_link" && res.link) {
        window.open(res.link, "_blank");
      } else {
        toast.success("تم إرسال التقرير عبر واتساب");
      }
    });
  }

  return (
    <button
      onClick={send}
      disabled={pending}
      className="no-print inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
    >
      <MessageCircle className="size-4" />
      {pending ? "…" : "إرسال عبر واتساب"}
    </button>
  );
}
