import { AboutView } from "@/components/about/AboutView";
import { ABOUT } from "@/lib/about/content";

export default function AboutHome() {
  return <AboutView page={ABOUT[0]} />;
}
