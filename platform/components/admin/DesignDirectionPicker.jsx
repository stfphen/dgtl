"use client";

import { listDesignDirections } from "../../lib/tenantBuilder/designDirections";

// Mini hero-layout glyphs per variant — pure CSS shapes, no assets.
function LayoutThumb({ variant }) {
  return (
    <span className={`direction-card__thumb direction-card__thumb--${variant}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * Radio-card grid over the design-direction catalog. Fully data-driven from
 * lib/tenantBuilder/designDirections.js — adding a direction there adds a card
 * here with zero UI changes.
 */
export default function DesignDirectionPicker({ value, onChange, idPrefix = "direction" }) {
  return (
    <div className="direction-picker" role="radiogroup" aria-label="Design direction">
      {listDesignDirections().map((direction) => {
        const inputId = `${idPrefix}-${direction.id}`;
        const selected = value === direction.id;
        return (
          <label
            key={direction.id}
            htmlFor={inputId}
            className={`direction-card ${selected ? "is-selected" : ""}`}
          >
            <input
              id={inputId}
              type="radio"
              name={idPrefix}
              value={direction.id}
              checked={selected}
              onChange={() => onChange(direction.id)}
            />
            <span className="direction-card__preview">
              <span
                className="direction-card__sample"
                style={{
                  fontFamily: direction.preview.fontStack,
                  background: direction.preview.swatches[0],
                  color: direction.preview.swatches[2]
                }}
              >
                {direction.preview.fontSample}
              </span>
              <span className="direction-card__swatches">
                {direction.preview.swatches.map((swatch) => (
                  <i key={swatch} style={{ background: swatch }} />
                ))}
              </span>
              <LayoutThumb variant={direction.heroVariant} />
            </span>
            <span className="direction-card__label">{direction.label}</span>
            <span className="direction-card__blurb">{direction.blurb}</span>
          </label>
        );
      })}
    </div>
  );
}
