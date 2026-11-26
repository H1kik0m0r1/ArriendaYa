import { requirePageRole } from "@/lib/auth/server-guard";
import RoleSidebarShell from "@/components/layout/RoleSidebarShell";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["tenant"]);
  return <RoleSidebarShell requiredRole="tenant">{children}</RoleSidebarShell>;
}
