import { requireInvestor } from "@/lib/auth";

export default async function InvestLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireInvestor();
  return (
    <div className="investShell">
      <header className="investHeader">
        <span className="investBrand">SRI CINE HUB</span>
        <span className="investRole">Investor Portal</span>
        <span className="investUser">{profile.full_name || "Investor"}</span>
      </header>
      <main className="investMain">{children}</main>
    </div>
  );
}
