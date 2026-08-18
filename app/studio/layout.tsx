import { requireStaff } from "@/lib/auth";
import { StudioNav } from "@/components/StudioNav";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireStaff();
  return (
    <div className="studioShell">
      <StudioNav name={profile.full_name || user.email || "Manager"} />
      <main className="studioMain">
        {children}
      </main>
      <div className="studioBottomSpacer" />
    </div>
  );
}
