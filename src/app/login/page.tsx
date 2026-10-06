import { LoginForm } from "@/components/LoginForm";
import { SPLASH_SEEN_KEY } from "@/lib/brand";

// Runs before the first paint: if the intro already played this session (or
// the device asks for reduced motion), mark <html> so the dark splash never
// flashes. LoginForm repeats the same check after hydration.
const SPLASH_PRECHECK = `try{if(sessionStorage.getItem(${JSON.stringify(
  SPLASH_SEEN_KEY
)})==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.splash="skip"}catch(e){}`;

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
