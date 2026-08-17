import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessDocumentsService, BusinessDocTemplateDef } from './business-documents.service';
import { RenderBusinessDocumentDto } from './dto/render-business-document.dto';

@ApiTags('business-documents')
@ApiBearerAuth()
@Controller('business-documents')
export class BusinessDocumentsController {
  constructor(private readonly service: BusinessDocumentsService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List the coded business-document templates + their field definitions' })
  templates(): BusinessDocTemplateDef[] {
    return this.service.templates();
  }

  @Post('render')
  @ApiOperation({ summary: 'Render a business document (letterhead/visiting-card/id-card) to printable HTML' })
  render(@Body() dto: RenderBusinessDocumentDto): { html: string } {
    return this.service.render(dto);
  }
}
