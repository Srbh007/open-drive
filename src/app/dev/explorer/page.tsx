import { notFound } from "next/navigation";
import { ExplorerDemo } from "./ExplorerDemo";

export default function ExplorerDemoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ExplorerDemo />;
}
