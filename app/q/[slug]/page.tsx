import { notFound } from "next/navigation";
import { allQuinielaSlugs, getQuiniela } from "@/lib/quinielas/registry";
import { QuinielaClient } from "./QuinielaClient";

export const dynamicParams = false;

export async function generateStaticParams() {
  return allQuinielaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const quiniela = getQuiniela(slug);
  if (!quiniela) return {};

  return {
    title: `${quiniela.title} - ${quiniela.subtitle} - Supergana`,
    description: `Juega la quiniela digital de Supergana para ${quiniela.title}.`,
  };
}

export default async function QuinielaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const quiniela = getQuiniela(slug);
  if (!quiniela) notFound();

  return <QuinielaClient quiniela={quiniela} />;
}
