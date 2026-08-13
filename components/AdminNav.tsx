import Link from "next/link";

export function AdminNav(){
  return <nav className="adminNav">
    <Link href="/admin">Dashboard</Link><Link href="/admin/calendar">Calendar</Link><Link href="/admin/bookings">Bookings</Link><Link href="/admin/inventory">Inventory</Link><Link href="/investors">Investors</Link>
  </nav>
}
