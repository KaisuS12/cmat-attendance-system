import { LoginForm } from "@/components/LoginForm";

// Runs before the first paint: on devices that ask for reduced motion, mark
// <html> so the dark intro never flashes. LoginForm repeats the check after
// hydration.
const SPLASH_PRECHECK = `try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.splash="skip"}catch(e){}`;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { deactivated, noprofile } = await searchParams;
  const notice =
    deactivated === "1"
      ? "This account has been deactivated. Contact the council admin."
      : noprofile === "1"
      ? "This account isn't set up yet. Contact the council admin."
      : null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_PRECHECK }} />
      <LoginForm notice={notice} />
    </>
  );
}
