import Link from "next/link";
import styles from "./GlassBadgeLab.module.css";

/** The lab uses the exact global CSS classes rendered by the dashboard. */
export default function GlassBadgeLab() {
  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/dashboard">
          ← Dashboard
        </Link>
        <div>
          <h1 className={styles.title}>Frosted glass badges</h1>
          <p className={styles.subtitle}>The production CSS badge system</p>
        </div>
      </header>

      <section className={styles.stage} aria-label="Glass badge examples">
        <div className={`${styles.clientBadge} glass-client-badge`}>
          MaYe
        </div>

        <div className={`${styles.providerBadge} glass-provider-badge`}>
          <strong>Kristine</strong>
          <span>O.T.</span>
          <i className="glass-badge-action">+</i>
        </div>
      </section>
    </main>
  );
}
