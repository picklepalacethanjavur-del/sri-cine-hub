import Link from "next/link";

export function AdminNav(){
  return <nav className="adminNav">
    <Link href="/admin">Dashboard</Link>
    <Link href="/admin/calendar">Calendar</Link>
    <Link href="/admin/quote-requests">Quote Requests</Link>
    <Link href="/admin/quotations">Quotations</Link>
    <Link href="/admin/bookings">Bookings</Link>
    <Link href="/admin/operations">Checkout / Return</Link>
    <Link href="/admin/sub-rentals">Sub-Rentals</Link>
    <Link href="/admin/inventory">Inventory</Link>
    <Link href="/admin/kits">Kits</Link>
    <Link href="/admin/rates">Internal Rates</Link>
    <Link href="/admin/receipts">Receipts</Link>
    <Link href="/investors">Investors</Link>
  </nav>;
}
