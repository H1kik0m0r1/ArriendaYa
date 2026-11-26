"use client";
import { useEffect } from "react";
import { syncRenewalReminders } from "@/modules/notifications/service";

export default function ReminderChecker() {
  useEffect(() => {
    void syncRenewalReminders();
  }, []);
  return null;
}
