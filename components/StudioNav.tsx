"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const NAV = [
  { href: "/studio",           label: "Today",           exact: true },
  { href: "/admin/quick-rent", label: "Quick Rent"                   },
  { href: "/studio/requests",  label: "Requests"                     },
  { href: "/studio/bookings",  label: "Bookings"                     },
  { href: "/studio/ops",       label: "Checkout/Return"              },
  { href: "/studio/receipts",  label: "Receipts"                     },
  { href: "/admin/sourcing",   label: "Hire-In"                      },
  { href: "/admin/calendar",   label: "Calendar"                     },
  { href: "/studio/inventory", label: "Inventory"                    },
  { href: "/studio/suppliers", label: "Suppliers"                    },
  { href: "/admin/setup",      label: "Setup"                        },
];

const ADMIN_ONLY = [
  { href: "/admin/deals", label: "Deals" },
];

const TOOLS = [
  { href: "/invest", label: "Investor portal" },
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
          {NAV.map(({ href, label, exact }) => (
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
        {NAV.slice(0, 6).map(({ href, label, exact }) => (
          <Link key={href} href={href} className={`studioBottomItem${active(href, exact) ? " active" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
