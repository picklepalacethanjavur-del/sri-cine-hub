import { notFound } from "next/navigation";
import { requireInvestor } from "@/lib/auth";
import Link from "next/link";

const money = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const date = (v: string) => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default async function InvestorReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireInvestor();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*,bookings(booking_code,project_name,start_at,end_at,quoted_total_inr),customers(name,company_name,phone,email)")
    .eq("id", id)
    .single();

  if (!receipt) notFound();

  const customer = receipt.customers;
  const booking = receipt.bookings;

  return (
    <div className="investPage">
      <div style={{ marginBottom: 20 }}>
        <Link href="/invest" className="investBackLink">← Back to Portfolio</Link>
      </div>
      <section className="quotationPaper" style={{ maxWidth: 680, margin: "0 auto" }}>
        <header className="quotationHeader">
          <div>
            <h1>SRI CINE HUB PVT. LTD.</h1>
            <p>Camera Rental · Lenses · Lights · Grip · Transport · Production Services</p>
          </div>
          <div className="quoteNumber">
            <span>RECEIPT</span>
            <b>{receipt.receipt_code}</b>
            <small>Date: {receipt.issued_at ? date(receipt.issued_at) : "—"}</small>
          </div>
        </header>

        <div className="quotationParties">
          <div>
            <span>Customer</span>
            <b>{customer?.company_name || customer?.name || "—"}</b>
            {customer?.phone && <p>{customer.phone}</p>}
            {customer?.email && <p>{customer.email}</p>}
          </div>
          {booking && (
            <div>
              <span>Booking</span>
              <b>{booking.booking_code}</b>
              {booking.project_name && <p>{booking.project_name}</p>}
            </div>
          )}
        </div>

        <table className="printQuoteTable" style={{ marginTop: 24 }}>
          <thead>
            <tr><th>Description</th><th style={{ textAlign: "right" }}>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{booking?.project_name || "Camera rental"}</td>
              <td style={{ textAlign: "right" }}>{money(booking?.quoted_total_inr)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="printSubtotalRow">
              <td>Amount paid</td>
              <td>{money(receipt.amount_paid_inr)}</td>
            </tr>
            {Number(receipt.balance_inr) > 0 && (
              <tr className="printAdjRow">
                <td>Balance due</td>
                <td>{money(receipt.balance_inr)}</td>
              </tr>
            )}
            <tr className="printGrandTotalRow">
              <td>Payment mode</td>
              <td>{receipt.payment_mode || "—"}</td>
            </tr>
          </tfoot>
        </table>

        {receipt.notes && (
          <div className="quoteTerms" style={{ marginTop: 20 }}>
            <p>{receipt.notes}</p>
          </div>
        )}
      </section>
    </div>
  );
}
