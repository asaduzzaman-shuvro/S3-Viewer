import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import LoginForm from "./LoginForm";

// Always evaluate auth at request time — never serve a stale static login page.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // An already-authenticated visitor (e.g. via the browser Back button) should be sent
  // to the app instead of seeing the login form. This server-side check backs up the
  // middleware redirect and covers any path that reaches the page directly.
  if (await isAuthed()) redirect("/browse");
  return <LoginForm />;
}
