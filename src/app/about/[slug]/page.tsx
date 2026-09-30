import { notFound } from "next/navigation";
import { AboutView } from "@/components/about/AboutView";
import { ABOUT, aboutPage } from "@/lib/about/content";

export const dynamicParams = false;
export const generateStaticParams = () => ABOUT.filter((p) => p.slug).map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${aboutPage(slug)?.title ?? ""} — عن التطبيق` };
}

export default async function AboutSlug({ params }: { params: Promise<{ slug: string }> }) {
  const page = aboutPage((await params).slug);
  if (!page) notFound();
  return <AboutView page={page} />;
}
