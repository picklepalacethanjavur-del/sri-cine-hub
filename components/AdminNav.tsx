"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin",             label: "Today",      exact: true },
  { href: "/admin/quick-rent",  label: "Quick Rent"             },
  { href: "/admin/deals",       label: "Deals"                  },
  { href: "/admin/sourcing",    label: "Sourcing"               },
  { href: "/admin/calendar",    label: "Calendar"               },
  { href: "/admin/setup",       label: "Setup"                  },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="adminNav">
      {NAV.map(({ href, label, exact }) => (
        <Link
          key={href}
          href={href}
          className={exact ? (path === href ? "active" : "") : (path.startsWith(href) ? "active" : "")}
        >
          {label}
        </Link>
      ))}
      <Link href="/studio" className="adminNavStudio">Studio →</Link>
    </nav>
  );
}
