/**
 * The product lives on its own subdomain; this site is the front door to it.
 *
 * One constant rather than three string literals, because three separate places
 * send a reader to the same place — the header's login, each archetype in
 * section 10, and the invitation printed under them — and the day that host
 * changes, it should change once.
 */
export const APP_URL = "https://app.navrya.com/";
