import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "../forms";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { notice } = await searchParams;
  return <LoginForm notice={notice} />;
}
