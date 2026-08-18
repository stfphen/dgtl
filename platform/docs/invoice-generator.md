# DGTL Core Invoice Generator

The authenticated invoice surface lives at `/admin/invoices` and generates PDF invoices through Invoice-Generator.com.

## Configuration

Set this server-side environment variable in the DGTL Core deployment:

```bash
INVOICE_GENERATOR_API_KEY=your_invoice_generator_api_key
```

Do not prefix it with `NEXT_PUBLIC_` and do not commit the real value. The browser posts invoice fields only to `/api/admin/invoices/generate`; the Next.js route adds the Bearer credential server-side and streams the returned PDF back to the authenticated operator.

## Security

- Requires a valid DGTL admin session.
- The API key never reaches browser JavaScript.
- Generated PDFs are returned with `Cache-Control: no-store`.
- Invoice-Generator.com is used only for rendering; invoice data is not persisted by this module.
