"use client";

import { useEffect, useMemo, useState } from "react";
import { FUNDING_SURVEY_QUESTIONS, getVisibleQuestions } from "../../lib/funding/surveyQuestions.js";
import FundingProgressBar from "./FundingProgressBar";
import FundingQuestionStep from "./FundingQuestionStep";
import FundingResultCard from "./FundingResultCard";
import FundingTrustNotice from "./FundingTrustNotice";
import styles from "./FundingSurveyWidget.module.css";

const CONTACT_QUESTIONS = FUNDING_SURVEY_QUESTIONS.filter((q) => q.group === "contact");

function isAnswered(question, value) {
  if (!question?.required) return true;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export default function FundingSurveyWidget({ tenant = {}, onLead }) {
  const storageKey = `funding-survey:${tenant.slug || "default"}`;
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("intro"); // intro | questions | teaser | contact | result
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Restore partial answers (client-only; avoids hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setAnswers(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [answers, storageKey]);

  const visibleQuestions = useMemo(() => getVisibleQuestions(answers, { includeContact: false }), [answers]);
  const safeStep = Math.min(stepIndex, Math.max(0, visibleQuestions.length - 1));
  const currentQuestion = visibleQuestions[safeStep];

  const bookingLink = useMemo(() => {
    const pkg = (tenant.packages || []).find((p) => p.bookingLink);
    return pkg?.bookingLink || tenant.routing?.bookingLink || "";
  }, [tenant]);

  function setAnswer(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function postSurvey(body) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/funding/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: tenant.slug, tenantId: tenant.id, ...body })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      return data;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSeeResult() {
    try {
      const data = await postSurvey({ answers });
      setResult(data.result);
      setPhase("teaser");
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleUnlock() {
    const contactAnswers = CONTACT_QUESTIONS.filter((q) => q.required);
    const missing = contactAnswers.find((q) => !isAnswered(q, answers[q.id]));
    if (missing) {
      setError(`Please add your ${missing.label.toLowerCase()}.`);
      return;
    }
    try {
      const data = await postSurvey({
        answers,
        contact: {
          businessName: answers.businessName,
          name: answers.name,
          email: answers.email,
          phone: answers.phone
        }
      });
      setResult(data.result);
      setPhase("result");
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      if (onLead) onLead(data);
    } catch (e) {
      setError(e.message);
    }
  }

  function next() {
    setError("");
    if (currentQuestion && !isAnswered(currentQuestion, answers[currentQuestion.id])) {
      setError("This question is required.");
      return;
    }
    if (safeStep >= visibleQuestions.length - 1) {
      handleSeeResult();
      return;
    }
    setStepIndex(safeStep + 1);
  }

  function back() {
    setError("");
    if (phase === "contact") {
      setPhase("teaser");
      return;
    }
    if (safeStep === 0) {
      setPhase("intro");
      return;
    }
    setStepIndex(safeStep - 1);
  }

  return (
    <div className={styles.widget} data-tenant={tenant.slug}>
      {phase === "intro" ? (
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Funding Fit Scan</p>
          <h2 className={styles.introHeadline}>See if your business may qualify for funded digital growth support.</h2>
          <p className={styles.introSub}>
            Answer a few questions. We will estimate likely funding lanes, show what to verify, and recommend the clearest next step.
          </p>
          <button type="button" className={styles.ctaPrimary} onClick={() => { setPhase("questions"); setStepIndex(0); }}>
            Start the scan
          </button>
          <FundingTrustNotice />
        </div>
      ) : null}

      {phase === "questions" ? (
        <div className={styles.step}>
          <FundingProgressBar current={safeStep} total={visibleQuestions.length} />
          <FundingQuestionStep question={currentQuestion} value={answers[currentQuestion?.id]} onChange={setAnswer} />
          {error ? <p className={styles.error} role="alert" aria-live="polite">{error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.ctaSecondary} onClick={back}>Back</button>
            <button type="button" className={styles.ctaPrimary} onClick={next} disabled={submitting} aria-busy={submitting}>
              {safeStep >= visibleQuestions.length - 1
                ? submitting
                  ? (<><span className="spinner" aria-hidden="true" />Scoring…</>)
                  : "See my result"
                : "Next"}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "teaser" ? (
        <FundingResultCard result={result} mode="teaser" onUnlock={() => { setError(""); setPhase("contact"); }} />
      ) : null}

      {phase === "contact" ? (
        <div className={styles.step}>
          <p className={styles.eyebrow}>Almost there</p>
          <h3 className={styles.contactHeadline}>Where should we send your full funding-fit result?</h3>
          {CONTACT_QUESTIONS.map((q) => (
            <FundingQuestionStep key={q.id} question={q} value={answers[q.id]} onChange={setAnswer} />
          ))}
          {error ? <p className={styles.error} role="alert" aria-live="polite">{error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.ctaSecondary} onClick={back}>Back</button>
            <button type="button" className={styles.ctaPrimary} onClick={handleUnlock} disabled={submitting} aria-busy={submitting}>
              {submitting ? (<><span className="spinner" aria-hidden="true" />Unlocking…</>) : "Unlock my full result"}
            </button>
          </div>
          <FundingTrustNotice />
        </div>
      ) : null}

      {phase === "result" ? (
        <FundingResultCard
          result={result}
          mode="full"
          bookingLink={bookingLink}
          onBook={() => document.querySelector("#packages")?.scrollIntoView({ behavior: "smooth" })}
        />
      ) : null}
    </div>
  );
}
