import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const site = 'https://www.leadclaw.uk'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/portal/', '/admin/'],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
