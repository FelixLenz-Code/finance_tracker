import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isRegistrationEnabled } from "@/lib/settings";
import { RegisterForm } from "../forms";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  // Bootstrap-Admin (noch kein Nutzer) darf sich immer registrieren.
  const isFirst = (await prisma.user.count()) === 0;
  if (!isFirst && !(await isRegistrationEnabled())) redirect("/login?notice=registration-off");
  return <RegisterForm />;
}
