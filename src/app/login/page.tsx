import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { deactivated, noprofile } = await searchParams;
  const notice =
    deactivated === "1"
      ? "This account has been deactivated. Contact the council admin."
      : noprofile === "1"
      ? "This account isn't set up yet. Contact the council admin."
      : null;
  return <LoginForm notice={notice} />;
}
