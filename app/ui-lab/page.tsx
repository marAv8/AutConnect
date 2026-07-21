import type { Metadata } from "next";
import OrbitMaterialPrototype from "./OrbitMaterialPrototype";

export const metadata: Metadata = {
  title: "AutConnect Spatial UI Study",
};

/**
 * Isolated visual study for the dashboard's future Three.js orbit.
 * It deliberately uses sample data and does not touch notes, authentication,
 * or any production dashboard state while the material language is reviewed.
 */
export default function UiLabPage() {
  return <OrbitMaterialPrototype />;
}
