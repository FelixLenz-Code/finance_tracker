import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isRegistrationEnabled } from "@/lib/settings";
import { LoginForm } from "../forms";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { notice } = await searchParams;
  const registrationOpen = await isRegistrationEnabled();
  return <LoginForm notice={notice} registrationOpen={registrationOpen} />;
}
