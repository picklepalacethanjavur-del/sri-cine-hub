import { requireStaff } from "@/lib/auth";
import { StudioNav } from "@/components/StudioNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireStaff();
  return (
    <div className="studioShell">
      <StudioNav name={profile.full_name || user.email || "Manager"} role={profile.role} />
      <main className="studioMain">
        {children}
      </main>
      <div className="studioBottomSpacer" />
    </div>
  );
}
