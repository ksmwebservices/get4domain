import { Injectable } from '@nestjs/common';
import { buildDirectionsUrl, composeAddress, Location, MapLinkResult, parseMapLink } from '../core/location-core';
import { LiveProjector, ProjectionCtx } from '../projection/live-projector';
import { WebsiteService } from '../website.service';
import { SiteLocationRow, SiteLocationStore } from './site-location.store';

/** Writes the staff projection of the location when a version goes live. A site with no written location has no row. */
@Injectable()
export class LocationProjector extends LiveProjector {
  constructor(private readonly store: SiteLocationStore) { super(); }
  async project(c: ProjectionCtx): Promise<void> {
    const l = c.doc.location;
    await this.store.replace(c.vendorId, c.version, l ? {
      addressLine1: l.addressLine1 ?? null, addressLine2: l.addressLine2 ?? null, city: l.city ?? null, state: l.state ?? null, pincode: l.pincode ?? null,
      latitude: l.latitude ?? null, longitude: l.longitude ?? null, mapLinkInput: l.mapLinkInput ?? null, directionsUrl: buildDirectionsUrl(l),
    } : null);
  }
}

export interface LocationView { location: Location; address: string; directionsUrl: string | null }

/** The vendor's Location panel (from the draft), the pure map-link reader, and the staff read of what is live. Nothing here calls the network. */
@Injectable()
export class LocationService {
  constructor(private readonly web: WebsiteService, private readonly store: SiteLocationStore) {}

  async view(vendorId: string): Promise<LocationView> {
    const c = await this.web.seoContext(vendorId);
    const location = c.doc.location ?? {};
    return { location, address: composeAddress(location), directionsUrl: buildDirectionsUrl(location) };
  }

  /** Reads a full Google Maps link; short links are not expanded. */
  parse(url: string): MapLinkResult { return parseMapLink(String(url ?? '')); }

  staffGet(vendorId: string): Promise<SiteLocationRow | null> { return this.store.get(vendorId); }
}
