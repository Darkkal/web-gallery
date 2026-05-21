"use client";

import nextDynamic from "next/dynamic";

const Navbar = nextDynamic(
  () => import("@/components/Navbar").then((mod) => mod.Navbar),
  { ssr: false },
);

export function DynamicNavbar() {
  return <Navbar />;
}
