import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Kaizen Dokümantasyonu | OPEX Lean Tool",
  description: "Kaizen ve standart operasyon dokümanlarının yönetimi",
};

export default function KaizenDocumentationPage() {
  return (
    <main className={styles.page}>
      <iframe
        className={styles.application}
        src="/kaizen-docs/index.html?v=2"
        title="Kaizen ve Operasyon Standartları Doküman Sistemi"
      />
    </main>
  );
}
