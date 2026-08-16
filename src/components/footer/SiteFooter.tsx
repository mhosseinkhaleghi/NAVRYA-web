import { APP_URL } from "@/config/site";
import { BrandMark } from "@/components/site/BrandMark";
import { LanguageMenu } from "@/components/site/LanguageMenu";
import { type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import {
  ArchetypeIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  JourneyIcon,
  MailIcon,
  SOCIAL_ICON,
} from "./FooterIcons";

import styles from "./SiteFooter.module.css";

/** Order is fixed by the design; the labels are the header's own. */
const NAV_KEYS = ["home", "feature", "psychology", "pricing", "academy"] as const;

const SOCIAL = ["x", "youtube", "instagram", "discord"] as const;

/** The ornamental diamond the comp puts on every rule and beside every title. */
function Node({ className }: { className?: string }) {
  return <span className={className} aria-hidden="true" />;
}

/**
 * The footer.
 *
 * Below the film and below the last section, so it is ordinary document: it
 * does not pin, does not scrub, and does not reveal. Everything above it that
 * arrives on scroll does so because the controller writes a progress onto it;
 * this deliberately reads nothing from the controller at all, so it is complete
 * with no JavaScript and stays complete if the script never boots.
 *
 * Two halves. The call to action is a band of its own — headline, two buttons,
 * ornament — and under a rule, the four columns, the bottom bar and the legal
 * line. On a narrow frame the columns stack in the order they are read rather
 * than being squeezed: brand, navigation, resources, then the newsletter.
 *
 * The navigation column takes its first five labels from `nav`, the same
 * strings the header sets, so the two lists cannot drift apart. Only what the
 * header does not have — Archetypes and Roadmap — is written in `footer`.
 *
 * The links that go nowhere are buttons, not anchors. Those destinations do not
 * exist yet, and an `<a href="#">` that silently does nothing is worse than a
 * control that is visibly inert; the header's own nav is buttons for the same
 * reason. The three that do have somewhere to go — the product, the language
 * menu, and the top of this page — are real links.
 */
export function SiteFooter({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const { footer, nav, a11y } = dictionary;

  // Prerendered, so this is the year the build ran. A rebuild moves it; a
  // hardcoded year in the copy would need a person to remember it every January.
  const year = new Date().getFullYear();

  const navLinks = [...NAV_KEYS.map((k) => nav[k]), ...footer.navExtra];

  return (
    <footer className={styles.footer} data-footer="">
      {/* The comp's brackets sit in the corners of the whole footer, not of the
          band inside it, so they hang off the footer rather than the call to
          action — otherwise they float in from the gutter on a wide frame. */}
      <Node className={styles.cornerStart} />
      <Node className={styles.cornerEnd} />

      {/* ── the call to action ──────────────────────────────────────────── */}
      <div className={styles.cta}>
        <div className={styles.ctaRule} aria-hidden="true">
          <span className={styles.ctaRuleLine} />
          <span className={styles.diamond} />
          <span className={styles.ctaRuleLine} />
        </div>

        <h2 className={styles.ctaHeadline}>{footer.cta.headline}</h2>

        <p className={styles.ctaSubline}>
          {footer.cta.subline.map((line) => (
            <span key={line} className={styles.ctaSublineLine}>
              {line}
            </span>
          ))}
        </p>

        <div className={styles.ctaActions}>
          <a className={styles.ctaPrimary} href={APP_URL} data-footer-cta="">
            <JourneyIcon className={styles.ctaIcon} />
            {footer.cta.primary}
          </a>
          <button type="button" className={styles.ctaSecondary}>
            <ArchetypeIcon className={styles.ctaIcon} />
            {footer.cta.secondary}
          </button>
        </div>
      </div>

      <div className={styles.divider} aria-hidden="true">
        <span className={styles.dividerLine} />
      </div>

      {/* ── the columns ─────────────────────────────────────────────────── */}
      <div className={styles.main}>
        <div className={styles.brandCol}>
          <div className={styles.lockup}>
            <BrandMark className={styles.mark} />
            <span className={styles.wordmark}>Navrya</span>
          </div>
          <div className={styles.brandRule} aria-hidden="true">
            <span className={styles.brandRuleLine} />
            <span className={styles.diamond} />
          </div>
          <p className={styles.blurb}>{footer.blurb}</p>
          <p className={styles.motto}>{footer.motto}</p>
        </div>

        <nav className={styles.col} aria-label={a11y.footerNav}>
          <h3 className={styles.colTitle}>{footer.navTitle}</h3>
          <ul className={styles.colList}>
            {navLinks.map((label) => (
              <li key={label}>
                <button type="button" className={styles.colLink}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.col}>
          <h3 className={styles.colTitle}>{footer.resourcesTitle}</h3>
          <ul className={styles.colList}>
            {footer.resources.map((label) => (
              <li key={label}>
                <button type="button" className={styles.colLink}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.stay}>
          <h3 className={styles.colTitle}>{footer.stayTitle}</h3>
          <p className={styles.stayBody}>{footer.stayBody}</p>

          {/*
           * A real form with a real email field, so the browser's own
           * validation and autofill work. It has no action yet — there is
           * nothing to post to — so it is left off rather than pointed at a
           * URL that would 404 on submit.
           */}
          <form className={styles.form} aria-label={a11y.newsletter}>
            <span className={styles.field}>
              <MailIcon className={styles.mail} />
              <input
                className={styles.input}
                type="email"
                name="email"
                autoComplete="email"
                placeholder={footer.emailPlaceholder}
                aria-label={footer.emailPlaceholder}
              />
            </span>
            <button type="submit" className={styles.submit}>
              {footer.subscribe}
              <ArrowRightIcon className={styles.submitArrow} />
            </button>
          </form>

          <h3 className={styles.colTitle}>{footer.socialTitle}</h3>
          <ul className={styles.socialRow} aria-label={a11y.social}>
            {SOCIAL.map((name) => (
              <li key={name}>
                <button type="button" className={styles.social} aria-label={name}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {SOCIAL_ICON[name]}
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── the bottom bar ──────────────────────────────────────────────── */}
      <div className={styles.bottom}>
        {/* Last row of the document: the panel has to rise, not drop. */}
        <LanguageMenu locale={locale} dictionary={dictionary} placement="up" />

        <div className={styles.bottomRule} aria-hidden="true">
          <span className={styles.dividerLine} />
        </div>

        {/* An empty fragment is the top of the document — no script needed. */}
        <a className={styles.backTop} href="#">
          {footer.backToTop}
          <ArrowUpIcon className={styles.backTopArrow} />
        </a>
      </div>

      <div className={styles.legal}>
        <p className={styles.copyright}>
          {footer.copyright.replace("{year}", String(year))}
        </p>
        <ul className={styles.legalList}>
          {footer.legal.map((item) => (
            <li key={item} className={styles.legalItem}>
              <button type="button" className={styles.legalLink}>
                {item}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
