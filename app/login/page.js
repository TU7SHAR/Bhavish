import { redirect } from "next/navigation";

// This page exists to catch any stray redirects to /login
// The actual login happens via Google OAuth in the Header component
export default function LoginPage() {
  redirect("/");
}
