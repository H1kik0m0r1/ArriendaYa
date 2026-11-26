import { requirePageRole } from "@/lib/auth/server-guard";
import RoleSidebarShell from "@/components/layout/RoleSidebarShell";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["owner"]);
  return <RoleSidebarShell requiredRole="owner">{children}</RoleSidebarShell>;
}
