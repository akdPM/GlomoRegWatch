import * as cheerio from 'cheerio';
async function test() {
    const response = await fetch('https://ifsca.gov.in/Legal/Index/wF6kttc1JR8=');
    const html = await response.text();
    const $ = cheerio.load(html);
    console.log("Number of internal links:", $('a').length);
    let count = 0;
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.toLowerCase().includes('.pdf')) {
            console.log("PDF Link:", $(el).text().trim(), href);
            count++;
        }
    });
    if (count === 0) {
        console.log("No PDFs found in static DOM. The content is loaded via JavaScript.");
    }
}
test();
