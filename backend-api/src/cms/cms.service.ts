import { Injectable, NotFoundException } from '@nestjs/common';
import { VendorCMS, VendorProduct } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformCmsDto } from './dto/update-platform-cms.dto';
import { UpdateVendorCmsDto } from './dto/update-vendor-cms.dto';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformCms(): Promise<Record<string, string>> {
    const rows = await this.prisma.platformCMS.findMany();
    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async getLogo(): Promise<string | null> {
    const row = await this.prisma.platformCMS.findUnique({ where: { key: 'logo' } });
    return row?.value ?? null;
  }

  async getFavicon(): Promise<string | null> {
    const row = await this.prisma.platformCMS.findUnique({ where: { key: 'favicon' } });
    return row?.value ?? null;
  }

  async getSEO(): Promise<{ title: string | null; description: string | null; keywords: string | null }> {
    const [title, description, keywords] = await Promise.all([
      this.prisma.platformCMS.findUnique({ where: { key: 'seoTitle' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'seoDescription' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'seoKeywords' } }),
    ]);
    return {
      title: title?.value ?? null,
      description: description?.value ?? null,
      keywords: keywords?.value ?? null,
    };
  }

  async getContactDetails(): Promise<{ phone: string | null; email: string | null; address: string | null }> {
    const [phone, email, address] = await Promise.all([
      this.prisma.platformCMS.findUnique({ where: { key: 'phone' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'email' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'address' } }),
    ]);
    return {
      phone: phone?.value ?? null,
      email: email?.value ?? null,
      address: address?.value ?? null,
    };
  }

  async updatePlatformCms(dto: UpdatePlatformCmsDto): Promise<Record<string, string>> {
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined) as [string, string][];

    await Promise.all(
      entries.map(([key, value]) =>
        this.prisma.platformCMS.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );

    return this.getPlatformCms();
  }

  async getVendorCMS(vendorId: string): Promise<VendorCMS | null> {
    return this.prisma.vendorCMS.findUnique({ where: { vendorId } });
  }

  async updateVendorCMS(vendorId: string, dto: UpdateVendorCmsDto): Promise<VendorCMS> {
    return this.prisma.vendorCMS.upsert({
      where: { vendorId },
      create: { vendorId, ...dto },
      update: dto,
    });
  }

  getVendorProducts(vendorId: string): Promise<VendorProduct[]> {
    return this.prisma.vendorProduct.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  addProduct(vendorId: string, dto: CreateProductDto): Promise<VendorProduct> {
    return this.prisma.vendorProduct.create({ data: { vendorId, ...dto } });
  }

  async updateProduct(productId: string, dto: UpdateProductDto): Promise<VendorProduct> {
    const product = await this.prisma.vendorProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.prisma.vendorProduct.update({ where: { id: productId }, data: dto });
  }

  async deleteProduct(productId: string): Promise<VendorProduct> {
    const product = await this.prisma.vendorProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.prisma.vendorProduct.delete({ where: { id: productId } });
  }

  async getProductOwner(productId: string): Promise<string> {
    const product = await this.prisma.vendorProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product.vendorId;
  }
}
