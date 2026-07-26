import { domainFromUrl } from "../leadUtils.js";
import { providerFailure, providerNotConfigured, providerSuccess } from "./providerResponse.js";

export async function searchGooglePlaces({ query, maxResults = 20 }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return withGoogleAliases(providerNotConfigured("google_places", "GOOGLE_PLACES_API_KEY"), []);
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.types,places.businessStatus,places.rating,places.userRatingCount"
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: Math.min(Number(maxResults || 20), 20) })
  });

  if (!response.ok) {
    return withGoogleAliases(
      providerFailure("google_places", `Google Places returned ${response.status}.`, {
        status: response.status
      }),
      []
    );
  }

  const data = await response.json();
  const prospects = (data.places || []).map(mapGooglePlace);
  return withGoogleAliases(providerSuccess("google_places", prospects, { query, count: prospects.length }), prospects);
}

export function mapGooglePlace(place) {
  const address = addressParts(place);
  const website = place.websiteUri || "";
  return {
    businessName: place.displayName?.text || "",
    business: place.displayName?.text || "",
    phone: place.nationalPhoneNumber || "",
    website,
    url: website,
    domain: domainFromUrl(website),
    address: place.formattedAddress || "",
    city: address.city,
    region: address.region,
    country: address.country,
    category: readableCategory(place.types?.[0] || ""),
    googlePlaceId: place.id || "",
    googleRating: place.rating || 0,
    googleReviewCount: place.userRatingCount || 0,
    notes: [
      place.formattedAddress,
      place.rating ? `Rating: ${place.rating}` : "",
      place.userRatingCount ? `Reviews: ${place.userRatingCount}` : ""
    ]
      .filter(Boolean)
      .join(" | "),
    sourceType: "google_places",
    source: "google_places",
    sourceUrl: place.googleMapsUri || "",
    metadata: place,
    sourceMetadata: place
  };
}

function withGoogleAliases(response, prospects) {
  return {
    ...response,
    prospects,
    reason: response.error || response.reason || ""
  };
}

function addressParts(place) {
  const components = place.addressComponents || [];
  const find = (type) => components.find((component) => component.types?.includes(type))?.longText || "";
  const city =
    find("locality") ||
    find("postal_town") ||
    find("administrative_area_level_3") ||
    find("administrative_area_level_2");

  return {
    city,
    region: find("administrative_area_level_1"),
    country: find("country")
  };
}

function readableCategory(value) {
  return String(value || "").replaceAll("_", " ");
}
