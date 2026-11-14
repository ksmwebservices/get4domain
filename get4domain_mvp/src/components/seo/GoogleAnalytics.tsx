import Script from 'next/script';

// A GA4 measurement ID looks like G-XXXXXXXXXX. Anything else is ignored, because the value is placed in an inline script.
const GA_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

/**
 * Loads GA4 with next/script, only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set to a valid ID.
 * With the variable missing or malformed it renders nothing, so no tag, no request and no cookie.
 * NEXT_PUBLIC_ values are read at BUILD time, so set the variable before `next build`.
 */
export default function GoogleAnalytics() {
  const id = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();
  if (!GA_ID_PATTERN.test(id)) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
