/**
 * Force dynamic rendering for all dashboard routes.
 * These pages query the database and can't be statically prerendered.
 */
export const dynamic = "force-dynamic";
