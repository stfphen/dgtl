import { NextResponse } from "next/server";
import { getAdminSession } from "../../../../../lib/auth";

const INVOICE_API_URL = "https://invoice-generator.com";
const DGTL_INVOICE_DEFAULTS = Object.freeze({
  logo: "https://os.dgtl.ltd/assets/brand/dgtl-logo-invoice.svg",
  from: "DGTL Group\nToronto, Ontario, Canada",
  currency: "CAD",
  tax: 13,
  header: "INVOICE",
  notes: "Thank you for your business.",
  terms: "Payment due by the due date shown above.",
});

function withDgtlDefaults(payload) {
  const clean = payload && typeof payload === "object" ? payload : {};
  return {
    ...DGTL_INVOICE_DEFAULTS,
    ...clean,
    // Branding is intentionally canonical so every DGTL-generated PDF carries
    // the approved invoice-safe wordmark even if a browser omits the field.
    logo: DGTL_INVOICE_DEFAULTS.logo,
    from: clean.from || DGTL_INVOICE_DEFAULTS.from,
    currency: clean.currency || DGTL_INVOICE_DEFAULTS.currency,
    header: clean.header || DGTL_INVOICE_DEFAULTS.header,
    notes: clean.notes ?? DGTL_INVOICE_DEFAULTS.notes,
    terms: clean.terms ?? DGTL_INVOICE_DEFAULTS.terms,
  };
}

export async function POST(request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.INVOICE_GENERATOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Invoice Generator is not configured." }, { status: 503 });
  }

  let payload;
  try {
    payload = withDgtlDefaults(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload?.from || !payload?.to || !Array.isArray(payload?.items) || !payload.items.length) {
    return NextResponse.json({ error: "From, bill-to, and at least one line item are required." }, { status: 400 });
  }

  try {
    const upstream = await fetch(INVOICE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { error: "Invoice Generator rejected the request.", detail: detail.slice(0, 500) },
        { status: upstream.status >= 500 ? 502 : upstream.status }
      );
    }

    const pdf = await upstream.arrayBuffer();
    const invoiceNumber = String(payload.number || "invoice").replace(/[^a-zA-Z0-9_-]/g, "-");
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="DGTL-${invoiceNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to reach Invoice Generator.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 }
    );
  }
}
