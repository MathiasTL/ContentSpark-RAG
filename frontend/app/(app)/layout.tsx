import AppSidebar from "@/shared/components/layout/AppSidebar";
import MobileNav from "@/shared/components/layout/MobileNav";
import Background from "@/shared/components/ui/Background";
import { SidebarProvider } from "@/shared/components/layout/SidebarProvider";
import SidebarShell from "@/shared/components/layout/SidebarShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="relative h-dvh overflow-hidden">
        <Background />
        <AppSidebar />
        <SidebarShell>{children}</SidebarShell>
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}
