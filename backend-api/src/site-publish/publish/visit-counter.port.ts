/**
 * Counts a page served for a host (Amendment 11 Q12). A port so the public page route does not depend on the module that stores the counts; with nothing bound the route counts nothing. Never throws,
 * never waits: it only adds one to an in-memory counter.
 */
export abstract class VisitCounterPort { abstract record(host: string): void }
