"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useOffline } from "@/components/offline/OfflineProvider";
import { FlagChip } from "@/components/ui/primitives";

const field = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export function ResultEntry({
  item,
  orderId,
  patientId,
}: {
  item: any;
  orderId: string;
  patientId: string;
}) {
  const { submitResult, online } = useOffline();
  const [pending, start] = useTransition();

  const [num, setNum] = useState(item.value_numeric ?? "");
  const [phys, setPhys] = useState({
    color: item.physical_inspection?.color ?? "",
    appearance: item.physical_inspection?.appearance ?? "",
    sediment: item.physical_inspection?.sediment ?? "",
  });
  const [mic, setMic] = useState({
    rbc: item.microscopic?.rbc ?? "",
    pus: item.microscopic?.pus_cells ?? "",
    epithelial: item.microscopic?.epithelial ?? "",
    crystals: item.microscopic?.crystals ?? "",
    mucus: item.microscopic?.mucus ?? "",
  });

  function save() {
    const fields: Record<string, string> = {
      order_item_id: item.item_id,
      order_id: orderId,
      patient_id: patientId,
      test_id: item.test_id,
    };
    if (item.is_special) {
      Object.assign(fields, {
        phys_color: phys.color,
        phys_appearance: phys.appearance,
        phys_sediment: phys.sediment,
        mic_rbc: mic.rbc,
        mic_pus: mic.pus,
        mic_epithelial: mic.epithelial,
        mic_crystals: mic.crystals,
        mic_mucus: mic.mucus,
      });
    } else {
      fields.value_numeric = String(num);
    }
    start(async () => {
      const r = await submitResult(fields, `نتيجة: ${item.name_ar}`);
      if (r === "queued") toast.info("حُفظت محلياً — ستُزامن عند عودة الاتصال");
      else toast.success("حُفظت النتيجة");
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">{item.name_ar}</div>
        <div className="text-sm"><FlagChip flag={item.flag} /></div>
      </div>

      {item.is_special ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="rounded-lg border border-line p-3">
            <legend className="px-1 text-xs text-muted">الفحص العيني</legend>
            <div className="flex flex-col gap-2">
              <input placeholder="اللون" value={phys.color} onChange={(e) => setPhys({ ...phys, color: e.target.value })} className={field} />
              <input placeholder="المظهر" value={phys.appearance} onChange={(e) => setPhys({ ...phys, appearance: e.target.value })} className={field} />
              <input placeholder="الرواسب" value={phys.sediment} onChange={(e) => setPhys({ ...phys, sediment: e.target.value })} className={field} />
            </div>
          </fieldset>
          <fieldset className="rounded-lg border border-line p-3">
            <legend className="px-1 text-xs text-muted">الفحص المجهري</legend>
            <div className="flex flex-col gap-2">
              <input placeholder="RBCs" value={mic.rbc} onChange={(e) => setMic({ ...mic, rbc: e.target.value })} className={field} />
              <input placeholder="Pus cells" value={mic.pus} onChange={(e) => setMic({ ...mic, pus: e.target.value })} className={field} />
              <input placeholder="الخلايا الطلائية" value={mic.epithelial} onChange={(e) => setMic({ ...mic, epithelial: e.target.value })} className={field} />
              <input placeholder="الأملاح/البلورات" value={mic.crystals} onChange={(e) => setMic({ ...mic, crystals: e.target.value })} className={field} />
              <input placeholder="المخاط" value={mic.mucus} onChange={(e) => setMic({ ...mic, mucus: e.target.value })} className={field} />
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="any"
            placeholder="النتيجة الرقمية"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            className={field}
          />
          <span className="whitespace-nowrap text-sm text-muted">
            {item.unit} · النطاق {item.normal_low ?? "—"}–{item.normal_high ?? "—"}
          </span>
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ…" : online ? "حفظ النتيجة" : "حفظ (دون اتصال)"}
        </button>
      </div>
    </div>
  );
}
