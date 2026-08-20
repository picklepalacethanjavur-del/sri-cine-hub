import { redirect } from "next/navigation";

export default async function QuoteRequestRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/studio/requests/${id}`);
}
