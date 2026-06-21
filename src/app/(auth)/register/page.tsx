import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "../forms";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return <RegisterForm />;
}
