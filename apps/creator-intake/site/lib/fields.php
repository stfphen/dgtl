<?php
defined('APP') or exit;

/**
 * THE field registry — single source of truth for every application field.
 * Drives per-step and full validation (validate.php), the payload shape, and
 * the admin/export schema. Field names follow the build brief verbatim.
 *
 * Spec keys:
 *   step     1..5
 *   type     string|text|email|url|bool|int|number|enum|enum_multi|strings|press|socials|media_links
 *   max      max string length (string/text/url) or max rows (strings/press/media_links)
 *   values   allowed values (enum / enum_multi)
 *   required true = both types must supply at submit; 'creator'/'brand' = that type only
 *   who      'creator'|'brand' — field only exists for that type (default: both)
 */

const APPLICANT_TYPES = ['creator', 'brand'];

const CATEGORIES = ['music', 'fashion', 'sport', 'food', 'tech', 'lifestyle', 'comedy', 'other'];

const PLATFORMS = [
    'instagram', 'tiktok', 'youtube', 'x', 'spotify', 'apple_music', 'soundcloud',
    'twitch', 'linkedin', 'snapchat', 'facebook', 'threads', 'personal_site',
];

const LOOKING_FOR = [
    'brand_deals', 'editorial_coverage', 'podcast_guest', 'broadcast',
    'campaign_work', 'distribution',
];

// Fixed licence terms — displayed to the applicant, never chosen by them.
// submit.php writes these canonical strings into the payload itself.
const LICENCE_SCOPE = 'Non-exclusive, revocable licence for promotional use on DGTL-owned properties and channels.';
const LICENCE_TERRITORY = 'Worldwide';
const LICENCE_TERM = 'Until revoked by the applicant with 30 days written notice.';

const MAX_MEDIA_FILES = 10;
const MAX_MEDIA_BYTES = 209715200; // 200 MB
const MAX_ANALYTICS_SHOTS = 5;

const MIME_WHITELIST = [
    'image/jpeg' => ['jpg', 'jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp'],
    'image/gif' => ['gif'], 'image/heic' => ['heic'],
    'video/mp4' => ['mp4'], 'video/quicktime' => ['mov'], 'video/webm' => ['webm'],
    'audio/mpeg' => ['mp3'], 'audio/wav' => ['wav'], 'audio/x-m4a' => ['m4a'], 'audio/aac' => ['aac'],
];

function fields_spec(): array
{
    static $spec = null;
    return $spec ??= [
        // ── Step 1 · Who you are ────────────────────────────────────────────
        'applicant_type' => ['step' => 1, 'type' => 'enum', 'values' => APPLICANT_TYPES, 'required' => true],
        'legal_name'     => ['step' => 1, 'type' => 'string', 'max' => 200, 'required' => true],
        'public_name'    => ['step' => 1, 'type' => 'string', 'max' => 200, 'required' => true],
        'email'          => ['step' => 1, 'type' => 'email', 'max' => 320, 'required' => true],
        'phone'          => ['step' => 1, 'type' => 'string', 'max' => 40, 'required' => true],
        'city'           => ['step' => 1, 'type' => 'string', 'max' => 120, 'required' => true],
        'country'        => ['step' => 1, 'type' => 'string', 'max' => 80, 'required' => true],
        'pronouns'       => ['step' => 1, 'type' => 'string', 'max' => 60],
        'entity_type'    => ['step' => 1, 'type' => 'enum', 'values' => ['individual', 'sole_prop', 'corp'], 'required' => true],
        'hst_gst_number' => ['step' => 1, 'type' => 'string', 'max' => 30],

        // ── Step 2 · What you do ────────────────────────────────────────────
        'primary_category'     => ['step' => 2, 'type' => 'enum', 'values' => CATEGORIES, 'required' => true],
        'secondary_categories' => ['step' => 2, 'type' => 'enum_multi', 'values' => CATEGORIES, 'max' => 5],
        'bio_short'            => ['step' => 2, 'type' => 'string', 'max' => 160, 'required' => true],
        'bio_long'             => ['step' => 2, 'type' => 'text', 'max' => 900],
        'career_highlights'    => ['step' => 2, 'type' => 'strings', 'max' => 10, 'item_max' => 300],
        'notable_press'        => ['step' => 2, 'type' => 'press', 'max' => 10],
        'looking_for'          => ['step' => 2, 'type' => 'enum_multi', 'values' => LOOKING_FOR, 'max' => 6, 'required' => true],

        // ── Step 3 · Socials & backlinks ────────────────────────────────────
        'socials'                => ['step' => 3, 'type' => 'socials', 'max' => 13, 'required' => 'creator'],
        'website_url'            => ['step' => 3, 'type' => 'url', 'max' => 500, 'required' => 'brand'],
        'preferred_anchor_text'  => ['step' => 3, 'type' => 'string', 'max' => 120],
        'reciprocal_link_agreed' => ['step' => 3, 'type' => 'bool'],
        'epk_url'                => ['step' => 3, 'type' => 'url', 'max' => 500],
        'press_kit_url'          => ['step' => 3, 'type' => 'url', 'max' => 500],
        'avg_views_30d'          => ['step' => 3, 'type' => 'int'],
        'avg_engagement_rate'    => ['step' => 3, 'type' => 'number'],
        'audience_top_geo'       => ['step' => 3, 'type' => 'string', 'max' => 120],
        'audience_age_bracket'   => ['step' => 3, 'type' => 'string', 'max' => 60],
        'audience_gender_split'  => ['step' => 3, 'type' => 'string', 'max' => 120],
        'analytics_connect_later' => ['step' => 3, 'type' => 'bool'],

        // ── Step 4 · Media & rights (uploads live in application_media) ─────
        'media_links'         => ['step' => 4, 'type' => 'media_links', 'max' => 10],
        'rights_confirmation' => ['step' => 4, 'type' => 'bool', 'required' => true],
        'derivative_ok'       => ['step' => 4, 'type' => 'bool', 'required' => true],
        'broadcast_ok'        => ['step' => 4, 'type' => 'bool', 'required' => true],
        'ai_training_optout'  => ['step' => 4, 'type' => 'bool'], // absent ⇒ true (default ON)
        'credit_line'         => ['step' => 4, 'type' => 'string', 'max' => 200, 'required' => true],
        'signature_name'      => ['step' => 4, 'type' => 'string', 'max' => 200, 'required' => true],
        'signature_date'      => ['step' => 4, 'type' => 'string', 'max' => 32, 'required' => true],

        // ── Step 5 · Rates & availability (creator only) + closing ──────────
        'rate_ig_post'             => ['step' => 5, 'type' => 'number', 'who' => 'creator'],
        'rate_ig_reel'             => ['step' => 5, 'type' => 'number', 'who' => 'creator'],
        'rate_tiktok'              => ['step' => 5, 'type' => 'number', 'who' => 'creator'],
        'rate_youtube_integration' => ['step' => 5, 'type' => 'number', 'who' => 'creator'],
        'rate_ugc_package'         => ['step' => 5, 'type' => 'number', 'who' => 'creator'],
        'rate_appearance'          => ['step' => 5, 'type' => 'number', 'who' => 'creator'],
        'rate_day'                 => ['step' => 5, 'type' => 'number', 'who' => 'creator'],
        'currency'                 => ['step' => 5, 'type' => 'string', 'max' => 8, 'who' => 'creator'],
        'open_to_gifted'           => ['step' => 5, 'type' => 'bool', 'who' => 'creator'],
        'exclusivity_conflicts'    => ['step' => 5, 'type' => 'strings', 'max' => 20, 'item_max' => 120, 'who' => 'creator'],
        'availability_window'      => ['step' => 5, 'type' => 'string', 'max' => 200, 'who' => 'creator'],
        'booking_contact'          => ['step' => 5, 'type' => 'enum', 'values' => ['self', 'manager'], 'who' => 'creator'],
        'manager_name'             => ['step' => 5, 'type' => 'string', 'max' => 200, 'who' => 'creator'],
        'manager_email'            => ['step' => 5, 'type' => 'email', 'max' => 320, 'who' => 'creator'],

        'how_did_you_hear'        => ['step' => 5, 'type' => 'string', 'max' => 200],
        'referred_by'             => ['step' => 5, 'type' => 'string', 'max' => 200],
        'consent_marketing_email' => ['step' => 5, 'type' => 'bool'], // CASL: separate, unticked
        'consent_survey_panel'    => ['step' => 5, 'type' => 'bool'], // separate, unticked
    ];
}

/** Field names visible to an applicant type at a given step (0 = all steps). */
function fields_for(string $type, int $step = 0): array
{
    $out = [];
    foreach (fields_spec() as $name => $f) {
        if (isset($f['who']) && $f['who'] !== $type) {
            continue;
        }
        if ($step !== 0 && $f['step'] !== $step) {
            continue;
        }
        $out[$name] = $f;
    }
    return $out;
}
