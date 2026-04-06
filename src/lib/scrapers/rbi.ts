import * as cheerio from 'cheerio';
import { fetchPdfText } from '../pdf';

export const scrapeRBI = async (): Promise<any[]> => {
    try {
        const response = await fetch('https://www.rbi.org.in/scripts/bs_circularindexdisplay.aspx', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 GlomoRegWatch/1.0',
            }
        });
        
        if (!response.ok) {
            console.error(`RBI Fetch failed: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const items: any[] = [];

        // Selecting standard RBI table links
        $('table.tablebg a.link2').each((i, el) => {
            if (i >= 15) return; 
            const title = $(el).text().trim();
            const href = $(el).attr('href');

            if (title && href) {
                const url = href.startsWith('http') ? href : `https://www.rbi.org.in/Scripts/${href}`;
                items.push({
                    source: 'RBI',
                    title: title,
                    source_url: url,
                    pdf_url: url,
                    published_at: new Date().toISOString(),
                    raw_text: title,
                    status: 'fetched'
                });
            }
        });

        // Fallback for different DOM structures
        if (items.length === 0) {
            $('a').each((i, el) => {
                if (i >= 15) return;
                const href = $(el).attr('href');
                if (href?.toLowerCase().includes('notificationuser.aspx')) {
                    const title = $(el).text().trim();
                    if (!title) return;
                    const url = href.startsWith('http') ? href : `https://www.rbi.org.in/Scripts/${href}`;
                    items.push({
                        source: 'RBI',
                        title: title,
                        source_url: url,
                        pdf_url: url,
                        published_at: new Date().toISOString(),
                        raw_text: title,
                        status: 'fetched'
                    });
                }
            });
        }

        // For each RBI circular, try to extract the actual PDF text
        // RBI circular pages contain a link to the actual PDF
        const enriched = await Promise.all(items.map(async (doc) => {
            try {
                // First fetch the circular HTML page to find the actual PDF link
                const pageResp = await fetch(doc.source_url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 GlomoRegWatch/1.0' }
                });
                if (!pageResp.ok) return doc;

                const pageHtml = await pageResp.text();
                const $page = cheerio.load(pageHtml);
                
                // RBI circular pages have a link to the PDF
                let pdfLink: string | null = null;
                $page('a').each((_, el) => {
                    const href = $page(el).attr('href') || '';
                    if (href.toLowerCase().endsWith('.pdf') || href.toLowerCase().includes('.pdf')) {
                        pdfLink = href.startsWith('http') ? href : `https://www.rbi.org.in${href}`;
                        return false; // break
                    }
                });

                if (pdfLink) {
                    const pdfText = await fetchPdfText(pdfLink);
                    if (pdfText) {
                        return { ...doc, raw_text: pdfText, pdf_url: pdfLink };
                    }
                }

                // If no PDF found, extract text content from the circular HTML page itself
                const bodyText = $page('div.fleft, div.content, .tablerotate, table').text()
                    .replace(/\s\s+/g, ' ')
                    .trim()
                    .substring(0, 8000);
                if (bodyText.length > 100) {
                    return { ...doc, raw_text: bodyText };
                }
            } catch (e) {
                console.warn(`RBI page text extraction failed for ${doc.source_url}`);
            }
            return doc;
        }));

        return enriched;
    } catch (err) {
        console.error('RBI Scraper failed', err);
        return [];
    }
};
