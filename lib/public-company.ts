import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { COLLECTIONS, db } from "@/lib/firebase"

export function normalizeCompanySlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function resolveOwnerIdFromCompanySlug(companySlug: string): Promise<string | null> {
  if (!db || !companySlug) return null

  const slug = normalizeCompanySlug(companySlug)

  // New public contract: config document contains a public slug
  const configQuery = query(
    collection(db, COLLECTIONS.CONFIG),
    where("publicSlug", "==", slug),
    limit(1)
  )
  const configSnapshot = await getDocs(configQuery)
  if (!configSnapshot.empty) {
    return configSnapshot.docs[0].id
  }

  // Backward compatibility: allow ownerId as path segment while migrating
  return slug || null
}
