import { firstRunNeeded } from "@/app/actions/auth";
import { labTarget } from "@/lib/db/lab";
import { getLabIdentity, labLogo, labName } from "@/lib/lab-identity";
import { LoginForm } from "./LoginForm";
import { FirstRunForm } from "./FirstRunForm";

export const dynamic = "force-dynamic";

/** Sign in — or, on a lab's new database or section with no accounts yet, create its first admin. */
export default async function LoginPage() {
  if (await firstRunNeeded()) return <FirstRunForm />;
  const identity = await getLabIdentity();
  return <LoginForm demo={!(await labTarget().catch(() => null))} name={labName(identity)} logo={identity.logo ? labLogo(identity) : ""} />;
}
