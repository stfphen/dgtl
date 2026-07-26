"use client";

import styles from "./FundingSurveyWidget.module.css";

export default function FundingTrustNotice({ children }) {
  return (
    <p className={styles.trust} role="note">
      {children ||
        "This is a preliminary match indicator, not a funding guarantee. Program rules, intake dates, and eligible expenses must be verified before applying."}
    </p>
  );
}
