/**
 * Subdomains that are ALWAYS reserved (Wave 3 Part G), whatever the editable `reservedSubdomains` setting says: the platform's own host names and the names of the existing Version 2 client sites.
 * The setting can add to this list but can never take a name off it, because the resolver unions the two. A name here is matched after look-alike folding (confusableKeys), like every reserved name.
 */
export const MANDATORY_RESERVED_SUBDOMAINS: readonly string[] = Object.freeze([
  // the platform's own hosts
  'www', 'app', 'admin', 'api', 'gapi', 'directory', 'media', 'partner', 'mail', 'send',
  // the existing Version 2 client sites (they keep their own hosts; nobody may register a look-alike)
  'allwintours', 'deebiphotography', 'indianambulance', 'ksmquantum', 'stepnrock', 'jscomputersmobiles', 'unicatherapy', 'mrtravels', 's2travels',
]);
