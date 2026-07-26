"use client";

import styles from "./FundingSurveyWidget.module.css";
import FundingTrustNotice from "./FundingTrustNotice";

const FIT_LABELS = {
  high: "Strong funding-fit signal",
  medium: "Medium funding-fit signal",
  exploratory: "Worth exploring",
  not_enough_information: "Not enough information yet"
};

const CONFIDENCE_LABELS = {
  high: "Strong",
  medium: "Medium",
  exploratory: "Exploratory",
  not_enough_information: "Needs info",
  not_a_fit: "Not a fit"
};

function FitBadge({ fit }) {
  return <span className={`${styles.fitBadge} ${styles[`fit_${fit}`] || ""}`}>{FIT_LABELS[fit] || "Reviewed"}</span>;
}

function Lanes({ lanes = [] }) {
  if (!lanes.length) return null;
  return (
    <ul className={styles.lanes}>
      {lanes.map((lane) => (
        <li key={lane.id} className={styles.lane}>{lane.label}</li>
      ))}
    </ul>
  );
}

export default function FundingResultCard({ result, mode = "full", onUnlock, onBook, bookingLink }) {
  if (!result) return null;

  if (mode === "teaser") {
    return (
      <div className={styles.resultCard}>
        <div className={styles.resultHeader}>
          <FitBadge fit={result.overallFit} />
          <span className={styles.fitScore}>Fit score {result.fitScore}</span>
        </div>
        <p className={styles.resultLead}>
          {result.qualifiedProgramCount > 0
            ? `We mapped ${result.qualifiedProgramCount} potential funding ${result.qualifiedProgramCount === 1 ? "lane" : "lanes"} to investigate.`
            : "We could not confirm a current program match from these answers."}
        </p>
        <p className={styles.subtle}>Likely lanes:</p>
        <Lanes lanes={result.bestLanes} />
        <div className={styles.lockBox}>
          <p>Enter your details to unlock your full match: top program matches, an estimated funding range, what to verify, and your best next step.</p>
          <button type="button" className={styles.ctaPrimary} onClick={onUnlock}>
            Unlock my full result
          </button>
        </div>
        <FundingTrustNotice>{result.disclaimer}</FundingTrustNotice>
      </div>
    );
  }

  const range = result.estimatedFundingRange;
  return (
    <div className={styles.resultCard}>
      <div className={styles.resultHeader}>
        <FitBadge fit={result.overallFit} />
        <span className={styles.fitScore}>Fit score {result.fitScore}</span>
      </div>

      {range ? (
        <div className={styles.range}>
          <span className={styles.rangeLabel}>Estimated funding-aligned range</span>
          <strong className={styles.rangeValue}>{range.label}</strong>
        </div>
      ) : null}

      <p className={styles.subtle}>Likely funding lanes:</p>
      <Lanes lanes={result.bestLanes} />

      {result.topProgramMatches?.length ? (
        <div className={styles.programs}>
          <p className={styles.subtle}>Top potential program matches:</p>
          {result.topProgramMatches.map((m) => (
            <div key={m.programId} className={styles.program}>
              <div className={styles.programTop}>
                <strong>{m.name}</strong>
                <span className={`${styles.confidence} ${styles[`conf_${m.confidence}`] || ""}`}>
                  {CONFIDENCE_LABELS[m.confidence] || m.confidence}
                </span>
              </div>
              {m.estimatedRange?.label ? <p className={styles.programRange}>{m.estimatedRange.label}</p> : null}
              {m.recommendedNextStep ? <p className={styles.programNext}>Next: {m.recommendedNextStep}</p> : null}
              {m.missingRequirements?.length ? (
                <p className={styles.programGaps}>To verify: {m.missingRequirements.slice(0, 2).join(" ")}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.subtle}>
          No current program match for the identified location. Confirm your country/province and project details with us.
        </p>
      )}

      {result.reviewGaps?.length ? (
        <div className={styles.gaps}>
          <p className={styles.subtle}>What to confirm next:</p>
          <ul>{result.reviewGaps.slice(0, 4).map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      ) : null}

      {bookingLink ? (
        <a className={styles.ctaPrimary} href={bookingLink} target="_blank" rel="noreferrer">
          Book a Funding-Fit Strategy Call
        </a>
      ) : (
        <button type="button" className={styles.ctaPrimary} onClick={onBook}>
          Book a Funding-Fit Strategy Call
        </button>
      )}

      <FundingTrustNotice>{result.disclaimer}</FundingTrustNotice>
    </div>
  );
}
