import * as cheerio from 'cheerio';
async function testIFSCA() {
    console.log("Fetching IFSCA...");
    const response = await fetch('https://ifsca.gov.in/Legal/Index/wF6kttc1JR8=');
    const html = await response.text();
    const $ = cheerio.load(html);
    console.log("Number of TRs:", $('tr').length);
    $('tr').each((i, el) => {
        if (i < 5) {
            console.log("TR", i, $(el).text().replace(/\s+/g, ' ').substring(0, 100));
            console.log("Link found:", $(el).find('a').attr('href'));
        }
    });
}
testIFSCA();
