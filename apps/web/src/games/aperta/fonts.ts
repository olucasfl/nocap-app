const HREF =
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap';
const LINK_ID = 'aperta-space-fonts';

/** Chakra Petch e Space Grotesk só pesam quando o Aperta! abre; o resto do app não as carrega. */
export function loadSpaceFonts(): void {
  if (typeof document === 'undefined' || document.getElementById(LINK_ID)) return;
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = HREF;
  document.head.appendChild(link);
}
