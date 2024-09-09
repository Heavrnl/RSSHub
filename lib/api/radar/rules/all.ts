import { namespaces } from '@/registry';
import { parse } from 'tldts';
import { RadarDomain } from '@/types';
import { createRoute, RouteHandler } from '@hono/zod-openapi';

const radar: {
    [domain: string]: RadarDomain;
} = {};

for (const namespace in namespaces) {
    for (const path in namespaces[namespace].routes) {
        const realPath = `/${namespace}${path}`;
        const data = namespaces[namespace].routes[path];
        if (data.radar?.length) {
            for (const radarItem of data.radar) {
                let domain, subdomain;

                // 检查是否包含占位符
                if (radarItem.source[0].includes(':')) {
                    // 对于包含占位符的情况，直接提取域名部分
                    const parts = radarItem.source[0].split('.');
                    domain = parts.at(-2) + '.' + parts.at(-1);
                    subdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : '.';
                } else {
                    // 对于正常的 URL，使用之前的解析方法
                    const sourceUrl = radarItem.source[0].startsWith('http') ? radarItem.source[0] : `https://${radarItem.source[0]}`;
                    const parsedDomain = parse(new URL(sourceUrl).hostname);
                    subdomain = parsedDomain.subdomain || '.';
                    domain = parsedDomain.domain;
                }

                if (domain) {
                    if (!radar[domain]) {
                        radar[domain] = {
                            _name: namespaces[namespace].name,
                        } as RadarDomain;
                    }
                    if (!radar[domain][subdomain]) {
                        radar[domain][subdomain] = [];
                    }
                    radar[domain][subdomain].push({
                        title: radarItem.title || data.name,
                        docs: `https://docs.rsshub.app/routes/${data.categories?.[0] || 'other'}`,
                        source: radarItem.source.map((source) => {
                            // 对于包含占位符的 URL，不进行解析
                            if (source.includes(':')) {
                                return source;
                            }
                            const sourceURL = new URL('https://' + source);
                            return sourceURL.pathname + sourceURL.search + sourceURL.hash;
                        }),
                        target: radarItem.target ? `/${namespace}${radarItem.target}` : realPath,
                    });
                }
            }
        }
    }
}

const route = createRoute({
    method: 'get',
    path: '/radar/rules',
    tags: ['Radar'],
    responses: {
        200: {
            description: 'All Radar rules',
        },
    },
});

const handler: RouteHandler<typeof route> = (ctx) => ctx.json(radar);

export { route, handler };
