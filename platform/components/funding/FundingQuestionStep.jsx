"use client";

import styles from "./FundingSurveyWidget.module.css";

function toggleMulti(values = [], value) {
  const set = new Set(Array.isArray(values) ? values : []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

/**
 * Renders a single survey question. Controlled: value + onChange(id, value).
 */
export default function FundingQuestionStep({ question, value, onChange }) {
  if (!question) return null;
  const { id, type, label, helper, options = [] } = question;

  return (
    <div className={styles.question}>
      <label className={styles.questionLabel} htmlFor={`q-${id}`}>
        {label}
        {question.required ? <span className={styles.req} aria-hidden> *</span> : null}
      </label>
      {helper ? <p className={styles.helper}>{helper}</p> : null}

      {type === "single_select" ? (
        <div className={styles.options} role="radiogroup" aria-label={label}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={value === opt.value}
              className={`${styles.option} ${value === opt.value ? styles.optionSelected : ""}`}
              onClick={() => onChange(id, opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {type === "multi_select" ? (
        <div className={styles.options} role="group" aria-label={label}>
          {options.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                onClick={() => onChange(id, toggleMulti(value, opt.value))}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {type === "boolean" ? (
        <div className={styles.options} role="radiogroup" aria-label={label}>
          {[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" }
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={value === opt.value}
              className={`${styles.option} ${value === opt.value ? styles.optionSelected : ""}`}
              onClick={() => onChange(id, opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {["text", "url", "email", "phone", "number"].includes(type) ? (
        <input
          id={`q-${id}`}
          className={styles.input}
          type={type === "phone" ? "tel" : type === "number" ? "number" : type === "url" ? "url" : type}
          inputMode={type === "number" ? "numeric" : undefined}
          value={value ?? ""}
          placeholder={question.placeholder || ""}
          autoComplete={type === "email" ? "email" : type === "phone" ? "tel" : type === "url" ? "url" : "off"}
          onChange={(e) => onChange(id, e.target.value)}
        />
      ) : null}
    </div>
  );
}
