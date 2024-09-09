import { namespaces } from '../../lib/registry';
import { RadarItem } from '../../lib/types';
import { parse } from 'tldts';
import fs from 'node:fs';
import path from 'node:path';
import toSource from 'tosource';

import { getCurrentPath } from '../../lib/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

const maintainers: Record<string, string[]> = {};
const radar: {
    [domain: string]: {
        _name: string;
        [subdomain: string]: RadarItem[] | string;
    };
} = {};

for (const namespace in namespaces) {
    let defaultCategory = namespaces[namespace].categories?.[0];
    if (!defaultCategory) {
        for (const path in namespaces[namespace].routes) {
            if (namespaces[namespace].routes[path].categories) {
                defaultCategory = namespaces[namespace].routes[path].categories[0];
                break;
            }
        }
    }
    if (!defaultCategory) {
        defaultCategory = 'other';
    }
    for (const path in namespaces[namespace].routes) {
        const realPath = `/${namespace}${path}`;
        const data = namespaces[namespace].routes[path];
        const categories = data.categories || namespaces[namespace].categories || [defaultCategory];
        // maintainers
        if (data.maintainers) {
            maintainers[realPath] = data.maintainers;
        }
        // radar
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
                    const parsedUrl = parse(new URL('https://' + radarItem.source[0]).hostname);
                    parsedDomain = parsedUrl.domain;
                    subdomain = parsedUrl.subdomain || '.';
                }

                if (parsedDomain) {
                    if (!radar[parsedDomain]) {
                        radar[parsedDomain] = {
                            _name: namespaces[namespace].name,
                        };
                    }
                    if (!radar[parsedDomain][subdomain]) {
                        radar[parsedDomain][subdomain] = [];
                    }
                    radar[parsedDomain][subdomain].push({
                        title: radarItem.title || data.name,
                        docs: `https://docs.rsshub.app/routes/${categories[0]}`,
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

fs.writeFileSync(path.join(__dirname, '../../assets/build/radar-rules.json'), JSON.stringify(radar, null, 2));
fs.writeFileSync(path.join(__dirname, '../../assets/build/radar-rules.js'), `(${toSource(radar)})`);
fs.writeFileSync(path.join(__dirname, '../../assets/build/maintainers.json'), JSON.stringify(maintainers, null, 2));
fs.writeFileSync(path.join(__dirname, '../../assets/build/routes.json'), JSON.stringify(namespaces, null, 2));
