import { Global, Module } from '@nestjs/common';
import { DirectoryModule } from '../directory/directory.module';
import { VendorDirectoryFactsPort } from '../site-publish/seo/vendor-directory-facts';
import { SeoVendorDirectoryFacts } from './backlinks/seo-vendor-facts.service';
import { SeoDirectoryModule } from './seo-directory.module';

/**
 * Makes ONE port of the SEO block visible to the site build and the staff SEO report without either of them importing the SEO module (and the directory behind it): the vendor's directory
 * facts (locality, city, backlink block). Consumers inject it @Optional(), so a build of the app, or a test, without this module simply has none of those facts.
 */
@Global()
@Module({ imports: [SeoDirectoryModule, DirectoryModule], providers: [{ provide: VendorDirectoryFactsPort, useClass: SeoVendorDirectoryFacts }], exports: [VendorDirectoryFactsPort] })
export class SeoVendorFactsModule {}
