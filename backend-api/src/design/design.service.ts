import { Injectable } from '@nestjs/common';
import { SAMPLE_DESIGN_TEMPLATES, DesignTemplateDef } from './design.templates';

@Injectable()
export class DesignService {
  /** Built-in sample templates (metadata + Fabric scene JSON). The editor is
   *  Fabric.js — MIT-licensed, client-side, no API key or subscription needed. */
  templates(): DesignTemplateDef[] {
    return SAMPLE_DESIGN_TEMPLATES;
  }
}
