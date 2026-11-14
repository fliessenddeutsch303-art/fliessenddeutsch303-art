import { LoginScreen } from "@/app/login/login-form";
import { getCurrentLanguage } from "@/lib/i18n-server";

export default async function LoginPage() {
  return <LoginScreen lang={await getCurrentLanguage()} />;
}
