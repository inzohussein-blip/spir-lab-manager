"use client";

import { useEffect } from "react";
import { startDoctorPublisher } from "@/lib/doctors/lab";

/** Keeps the doctors' copies up to date while the lab station or the sync station is open (on the
 *  computer that holds doctor codes; nothing happens elsewhere). */
export function DoctorPublisher() {
  useEffect(() => { startDoctorPublisher(); }, []);
  return null;
}
