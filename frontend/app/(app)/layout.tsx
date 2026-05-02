import AppSidebar from "@/shared/components/layout/AppSidebar";
import Background from "@/shared/components/ui/Background";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Background />
      <AppSidebar />
      <div className="relative min-h-screen lg:ml-64">{children}</div>
    </div>
  );
}
