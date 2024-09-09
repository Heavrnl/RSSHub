import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import puppeteer from '@/utils/puppeteer';
import { Route, Data, DataItem } from '@/types';

export const route: Route = {
    path: '/:subdomain',
    categories: ['shopping'],
    example: '/booth/kmyym',
    parameters: { subdomain: '商店子域名' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: [':subdomain.booth.pm/'],
            target: '/:subdomain',
        },
    ],
    name: '商店最新商品',
    maintainers: ['Heavrnl'],
    handler,
};

async function handler(ctx): Promise<Data> {
    const { subdomain } = ctx.req.param();
    const url = `https://${subdomain}.booth.pm/`;

    const browser = await puppeteer();
    const page = await browser.newPage();

    try {
        // 设置 Cookie 来绕过年龄限制
        await page.setCookie({
            name: 'adult',
            value: 't',
            domain: `${subdomain}.booth.pm`,
            path: '/',
        });

        await page.setRequestInterception(true);
        page.on('request', (request) => {
            request.resourceType() === 'document' || request.resourceType() === 'script' ? request.continue() : request.abort();
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });

        await page.waitForSelector('.js-mount-point-shop-item-card', { timeout: 60000 });

        const content = await page.content();

        const $ = load(content);

        const list: DataItem[] = $('.js-mount-point-shop-item-card')
            .toArray()
            .map((item): DataItem | null => {
                const dataAttr = $(item).attr('data-item');
                if (dataAttr === undefined) {
                    return null;
                }
                const data = JSON.parse(dataAttr);
                return {
                    title: data.name,
                    link: data.url,
                    pubDate: parseDate(data.published_at),
                    author: data.shop.name,
                    category: data.category?.name?.en,
                    description: `<img src="${data.thumbnail_image_urls[0]}"><br>${data.price}`,
                };
            })
            .filter((item): item is DataItem => item !== null);

        return {
            title: $('title').text(),
            link: url,
            item: list,
        };
    } catch (error) {
        throw error;
    } finally {
        await page.close();
        await browser.close();
    }
}
