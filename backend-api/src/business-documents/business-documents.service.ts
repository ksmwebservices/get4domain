import { Injectable } from '@nestjs/common';
import { RenderBusinessDocumentDto } from './dto/render-business-document.dto';
import { renderBusinessDocument, BusinessDocValues } from './templates/business-document.template';

/** The coded business-document templates available today. Kept here (not in the DB)
 *  because each is a real coded layout — new ones are a dev task, per the dispatch.
 *  `fields` mirrors the cmsSchema field-definition shape so the AI Studio form and,
 *  later, the Template-Driven CMS can render from the same definitions. */
export interface BusinessDocFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  required?: boolean;
  maxLength?: number;
  /** Which known vendor value to prefill from (frontend maps this to profile data). */
  prefillFrom?: 'businessName' | 'name' | 'email';
}

export interface BusinessDocTemplateDef {
  key: 'letterhead' | 'visiting_card' | 'id_card';
  label: string;
  description: string;
  fields: BusinessDocFieldDef[];
}

const BUSINESS: BusinessDocFieldDef = { key: 'business', label: 'Business name', type: 'text', required: true, maxLength: 60, prefillFrom: 'businessName' };
const PERSON: BusinessDocFieldDef = { key: 'person', label: 'Person name', type: 'text', required: true, maxLength: 50, prefillFrom: 'name' };
const DESIGNATION: BusinessDocFieldDef = { key: 'designation', label: 'Designation', type: 'text', maxLength: 40 };
const PHONE: BusinessDocFieldDef = { key: 'phone', label: 'Phone', type: 'text', maxLength: 30 };
const EMAIL: BusinessDocFieldDef = { key: 'email', label: 'Email', type: 'text', maxLength: 60, prefillFrom: 'email' };
const ADDRESS: BusinessDocFieldDef = { key: 'address', label: 'Address', type: 'text', maxLength: 120 };
const WEBSITE: BusinessDocFieldDef = { key: 'website', label: 'Website', type: 'text', maxLength: 60 };
const TAGLINE: BusinessDocFieldDef = { key: 'tagline', label: 'Tagline', type: 'text', maxLength: 60 };

export const BUSINESS_DOC_TEMPLATES: BusinessDocTemplateDef[] = [
  {
    key: 'letterhead',
    label: 'Letterhead',
    description: 'Branded company header — print or save as PDF.',
    fields: [BUSINESS, TAGLINE, PHONE, EMAIL, WEBSITE, ADDRESS],
  },
  {
    key: 'visiting_card',
    label: 'Visiting Card',
    description: 'Double-sided business card with your details.',
    fields: [BUSINESS, PERSON, DESIGNATION, PHONE, EMAIL, WEBSITE, ADDRESS, TAGLINE],
  },
  {
    key: 'id_card',
    label: 'ID Card',
    description: 'Employee / staff identity card.',
    fields: [BUSINESS, PERSON, DESIGNATION, PHONE, EMAIL, ADDRESS],
  },
];

@Injectable()
export class BusinessDocumentsService {
  /** Registry of coded templates (for the AI Studio picker + Content Library). */
  templates(): BusinessDocTemplateDef[] {
    return BUSINESS_DOC_TEMPLATES;
  }

  /** Stateless render — takes posted values, returns branded HTML. Never reads or
   *  writes vendor/payment data; the caller supplies the values + brand. */
  render(dto: RenderBusinessDocumentDto): { html: string } {
    const values = dto.values as BusinessDocValues;
    return { html: renderBusinessDocument(dto.type, values, dto.brand ?? {}) };
  }
}
