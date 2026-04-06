import * as cheerio from 'cheerio';
async function test() {
    const response = await fetch('https://ifsca.gov.in/Legal/Index/wF6kttc1JR8=');
    const html = await response.text();
    const $ = cheerio.load(html);
    $('script').each((i, el) => {
        const text = $(el).html();
        if (text && text.includes('Data')) {
            console.log("Found Data script:", text.substring(0, 800));
        }
    });
}
test();
