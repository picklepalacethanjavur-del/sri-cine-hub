"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const MAIN = [
  { href: "/studio",          label: "Today",      exact: true },
  { href: "/admin/quick-rent",label: "Quick Rent"             },
  { href: "/studio/requests", label: "Requests"               },
  { href: "/studio/bookings", label: "Bookings"               },
  { href: "/studio/ops",      label: "Checkout/Return"        },
  { href: "/studio/receipts", label: "Receipts"               },
];

const ADMIN_ONLY = [
  { href: "/admin/deals",      label: "Deals"      },
  { href: "/admin/quotations", label: "Quotations" },
  { href: "/admin/sourcing",   label: "Sourcing"   },
  { href: "/admin/calendar",   label: "Calendar"   },
];

const TOOLS = [
  { href: "/studio/inventory", label: "Inventory"       },
  { href: "/studio/suppliers", label: "Suppliers"       },
  { href: "/admin/setup",      label: "Setup"           },
  { href: "/invest",           label: "Investor portal" },
];

export function StudioNav({ name, role }: { name: string; role?: string }) {
  const path = usePathname();
  const isAdmin = role === "admin";

  function active(href: string, exact = false) {
    return exact ? path === href : path.startsWith(href);
  }

  return (
    <>
      <aside className="studioSidebar">
        <div className="studioSidebarBrand">
          <Link href="/" className="studioBrandLink">SRI CINE HUB</Link>
          <span>Studio</span>
        </div>
        <nav className="studioSidebarNav">
          {MAIN.map(({ href, label, exact }) => (
            <Link key={href} href={href} className={`studioNavItem${active(href, exact) ? " active" : ""}`}>{label}</Link>
          ))}
        </nav>
        {isAdmin && (
          <>
            <div className="studioSidebarDivider" />
            <p className="studioSidebarSection">Admin</p>
            <nav className="studioSidebarNav">
              {ADMIN_ONLY.map(({ href, label }) => (
                <Link key={href} href={href} className={`studioNavItem${active(href) ? " active" : ""}`}>{label}</Link>
              ))}
            </nav>
          </>
        )}
        <div className="studioSidebarDivider" />
        <nav className="studioSidebarTools">
          {TOOLS.map(({ href, label }) => (
            <Link key={href} href={href} className="studioNavItem dim">{label}</Link>
          ))}
        </nav>
        <div className="studioSidebarFooter">
          <span className="studioUserName">{name}</span>
          <SignOutButton />
        </div>
      </aside>
      <nav className="studioBottomBar">
        {MAIN.map(({ href, label, exact }) => (
          <Link key={href} href={href} className={`studioBottomItem${active(href, exact) ? " active" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
