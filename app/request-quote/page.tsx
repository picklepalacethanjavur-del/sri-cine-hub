import QuoteForm from "./QuoteForm";

export default function QuotePage() {
  return (
    <>
      <section className="pageHero">
        <div className="eyebrow">AVAILABILITY & QUOTES</div>
        <h1>Build your rental request.</h1>
        <p>
          Choose your dates, search our equipment by category, and tell us anything else your production needs. Sri Cine Hub will confirm availability and pricing.
        </p>
      </section>
      <section className="section quotePageSection">
        <QuoteForm />
      </section>
    </>
  );
}
