-- Wave 2 Part G (1): the profile now feeds the site's location, opening hours and Offerings. No new table or column: the opening hours are a new optional key in the managed site document (JSON), the services go to the
-- existing Offerings (VendorProduct) and the address parts to the document's location (which projects into g4d_site_locations when a version goes live).
-- Only two CHECKs are WIDENED (a profile field type 'hours'; a map kind LOCATION, HOURS or OFFERINGS). No value is removed. NOT applied by this commit: the owner runs migrate-deploy on staging.

ALTER TABLE "g4d_category_profile_fields" DROP CONSTRAINT "g4d_category_profile_fields_type_check";
ALTER TABLE "g4d_category_profile_fields" ADD CONSTRAINT "g4d_category_profile_fields_type_check" CHECK ("type" IN ('text', 'longtext', 'number', 'money', 'date', 'datetime', 'select', 'multiselect', 'bool', 'phone', 'email', 'url', 'image', 'status', 'textlist', 'servicelist', 'imagelist', 'hours'));

ALTER TABLE "g4d_profile_site_map" DROP CONSTRAINT "g4d_profile_site_map_kind_check";
ALTER TABLE "g4d_profile_site_map" ADD CONSTRAINT "g4d_profile_site_map_kind_check" CHECK ("targetKind" IN ('FIELD', 'LIST', 'LOCATION', 'HOURS', 'OFFERINGS', 'NONE'));
