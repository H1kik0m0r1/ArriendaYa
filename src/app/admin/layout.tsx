import { requirePageRole } from "@/lib/auth/server-guard";
import RoleSidebarShell from "@/components/layout/RoleSidebarShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["admin"]);
  return <RoleSidebarShell requiredRole="admin">{children}</RoleSidebarShell>;
}
