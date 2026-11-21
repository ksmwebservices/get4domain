/** S1.7: the public signup now checks the category against the active V3 pack categories. Tests that build AuthService with a hand-made prisma add this stub: every key is "listed". */
export const withCats = <T extends object>(prisma: T): T & { v3PackCategory: { findFirst: (a: { where: { categoryKey: string } }) => Promise<{ categoryKey: string }> } } =>
  ({ v3PackCategory: { findFirst: async (a: { where: { categoryKey: string } }) => ({ categoryKey: a.where.categoryKey }) }, ...prisma });
