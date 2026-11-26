"use client";
import { useEffect } from "react";
import {
  subscribeAccessibilityPreferences,
  syncAllAccessibilityPreferences,
} from "@/modules/shared/preferences";

export default function ThemeSync() {
  useEffect(() => {
    syncAllAccessibilityPreferences();
    return subscribeAccessibilityPreferences(() => {
      syncAllAccessibilityPreferences();
    });
  }, []);

  return null;
}
