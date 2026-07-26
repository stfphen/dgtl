"use client";

import styles from "./FundingSurveyWidget.module.css";

export default function FundingProgressBar({ current = 0, total = 1, label = "" }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className={styles.progress} aria-hidden={!label}>
      <div className={styles.progressMeta}>
        <span>{label || `Step ${Math.min(current + 1, total)} of ${total}`}</span>
        <span>{pct}%</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
