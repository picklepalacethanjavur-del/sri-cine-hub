import { requireStaff } from "@/lib/auth";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage() {
  await requireStaff();
  return <NewRequestForm />;
}
