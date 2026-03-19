import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://leadclawai.vercel.app'
  const paths = [
    '/',
    '/pricing',
    '/how-it-works',
    '/apply',
    '/legal/terms',
    '/legal/privacy',
    '/legal/trial-waiver',
    '/legal/dpa',
    '/legal/compliance-checklist',
    '/seo/ai-agent-for-aesthetic-clinics-uk',
    '/seo/ai-agent-for-dental-clinics-uk',
    '/seo/missed-call-recovery-uk',
  ]

  return paths.map((path) => ({
    url: `${site}${path}`,
    lastModified: new Date(),
  }))
}
