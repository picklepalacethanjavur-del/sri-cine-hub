import { requireInvestor } from "@/lib/auth";
import Link from "next/link";

export default async function InvestLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireInvestor();
  const isStaff = ["admin","manager","staff"].includes(profile.role);
  return (
    <div className="investShell">
      <header className="investHeader">
        <span className="investBrand">SRI CINE HUB</span>
        <span className="investRole">Investor Portal</span>
        <div className="investHeaderRight">
          <span className="investUser">{profile.full_name || "Investor"}</span>
          {isStaff && <Link href="/studio" className="investBackLink">← Studio</Link>}
        </div>
      </header>
      <main className="investMain">{children}</main>
    </div>
  );
}
