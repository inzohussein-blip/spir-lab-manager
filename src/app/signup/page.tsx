import { SignupForm } from "./SignupForm";

export const metadata = { title: "تسجيل مختبر جديد" };

/** «التسجيل الذاتي»: a lab registers itself and starts a trial (only while the owner allows it). */
export default function SignupPage() {
  return <SignupForm />;
}
