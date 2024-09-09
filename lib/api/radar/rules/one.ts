import { namespaces } from '@/registry';
import { parse } from 'tldts';
import { RadarItem } from '@/types';
import { createRoute, RouteHandler } from '@hono/zod-openapi';

const route = createRoute({
    method: 'get',
    path: '/radar/rules/:domain+',
    tags: ['Radar'],
    responses: {
        200: {
            description: 'Radar rules for a specific domain',
        },
    },
});

const handler: RouteHandler<typeof route> = (ctx) => {
    const domain = ctx.req.param('domain');
    const radar: RadarItem[] = [];

    for (const namespace in namespaces) {
        for (const path in namespaces[namespace].routes) {
            const realPath = `/${namespace}${path}`;
            const data = namespaces[namespace].routes[path];
            if (data.radar?.length) {
                for (const radarItem of data.radar) {
                    let parsedDomain, subdomain;

                    // 检查是否包含占位符
                    if (radarItem.source[0].includes(':')) {
                        // 对于包含占位符的情况，直接提取域名部分
                        const parts = radarItem.source[0].split('.');
                        parsedDomain = parts.at(-2) + '.' + parts.at(-1);
                        subdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : '.';
                    } else {
                        // 对于正常的 URL，使用之前的解析方法
                        const sourceUrl = radarItem.source[0].startsWith('http') ? radarItem.source[0] : `https://${radarItem.source[0]}`;
                        const parsed = parse(new URL(sourceUrl).hostname);
                        parsedDomain = parsed.domain;
                        subdomain = parsed.subdomain || '.';
                    }

                    if (parsedDomain === domain) {
                        radar.push({
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

    return ctx.json(radar);
};

export { route, handler };
